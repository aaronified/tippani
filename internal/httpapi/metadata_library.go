package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"tippani/internal/metadata"
)

// handleMetadataLibrary powers the Metadata tab's review lists: every book and
// film/show with compact "what's missing" flags so the UI can surface the ones
// that still need a cover / cast / source link. Purpose-built (not the CRUD list
// endpoints) so it can carry the gap flags without perturbing those shapes.
func (s *Server) handleMetadataLibrary(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)

	type bookItem struct {
		ID              int64  `json:"id"`
		Title           string `json:"title"`
		Author          string `json:"author"`
		ISBN            string `json:"isbn"` // passed to the look-up picker to seed a stronger match
		ASIN            string `json:"asin"`
		HasCover        bool   `json:"has_cover"`
		HasIDs          bool   `json:"has_ids"` // linked to a source (isbn/asin/google/openlibrary)
		AnnotationCount int    `json:"annotation_count"`
	}
	books := []bookItem{}
	brows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.isbn, ''), COALESCE(b.asin, ''),
		       b.cover_path IS NOT NULL,
		       (b.isbn IS NOT NULL OR b.asin IS NOT NULL OR b.google_id IS NOT NULL OR b.openlibrary_id IS NOT NULL),
		       (SELECT count(*) FROM annotations a WHERE a.book_id = b.id)
		FROM books b WHERE b.user_id = ?
		ORDER BY b.created_at DESC, b.id DESC`, uid)
	if err != nil {
		internalError(w, r, "metadata library: books", err)
		return
	}
	defer brows.Close()
	for brows.Next() {
		var it bookItem
		if err := brows.Scan(&it.ID, &it.Title, &it.Author, &it.ISBN, &it.ASIN, &it.HasCover, &it.HasIDs, &it.AnnotationCount); err == nil {
			books = append(books, it)
		}
	}

	type movieItem struct {
		ID            int64  `json:"id"`
		Title         string `json:"title"`
		MediaType     string `json:"media_type"`
		ReleaseYear   int    `json:"release_year"`
		HasPoster     bool   `json:"has_poster"`
		HasCast       bool   `json:"has_cast"`
		HasSource     bool   `json:"has_source"` // tmdb_id or tvdb_id
		DialogueCount int    `json:"dialogue_count"`
	}
	movies := []movieItem{}
	mrows, err := s.Store.DB.Query(`
		SELECT m.id, m.title, m.media_type, COALESCE(m.release_year, 0),
		       m.poster_path IS NOT NULL,
		       (m.cast_json IS NOT NULL AND m.cast_json <> '[]' AND m.cast_json <> ''),
		       (m.tmdb_id IS NOT NULL OR m.tvdb_id IS NOT NULL),
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id)
		FROM movies m WHERE m.user_id = ?
		ORDER BY m.created_at DESC, m.id DESC`, uid)
	if err != nil {
		internalError(w, r, "metadata library: movies", err)
		return
	}
	defer mrows.Close()
	for mrows.Next() {
		var it movieItem
		if err := mrows.Scan(&it.ID, &it.Title, &it.MediaType, &it.ReleaseYear,
			&it.HasPoster, &it.HasCast, &it.HasSource, &it.DialogueCount); err == nil {
			movies = append(movies, it)
		}
	}

	// Dialogue coverage (for the stats strip): missing_actor counts only lines
	// that COULD be filled — i.e. those with a character to match against the cast.
	// Speakerless lines (narration) are unfillable and would otherwise inflate the
	// warning tile with work no action can clear.
	var dlgTotal, dlgMissingActor int
	if err := s.Store.DB.QueryRow(`
		SELECT count(*),
		       COALESCE(SUM(CASE WHEN (d.actor IS NULL OR d.actor = '')
		                          AND d.character IS NOT NULL AND d.character <> '' THEN 1 ELSE 0 END), 0)
		FROM dialogues d JOIN movies m ON m.id = d.movie_id WHERE m.user_id = ?`, uid).
		Scan(&dlgTotal, &dlgMissingActor); err != nil {
		internalError(w, r, "metadata library: dialogue stats", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"books":  books,
		"movies": movies,
		"dialogue_stats": map[string]int{
			"total":         dlgTotal,
			"missing_actor": dlgMissingActor,
		},
	})
}

// handleRemapSpeakers bulk-remaps a movie's dialogue speaker labels: each mapping
// renames every dialogue whose character equals `from` to `character` and sets
// `actor` (auto-filled from the cast when the mapping leaves it blank). This is
// how an imported label ("Evey Hammond") gets reconciled with the supplier's
// cast character ("Evey") so the actor fills in. `refill` additionally re-runs
// the cast auto-fill across the whole movie for any still-empty actors.
//
// Matching is done against each dialogue's ORIGINAL character (read once up
// front), so chained renames (A→B, B→C) can't cascade.
func (s *Server) handleRemapSpeakers(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	var req struct {
		Mappings []struct {
			From      string `json:"from"`
			Character string `json:"character"`
			Actor     string `json:"actor"`
		} `json:"mappings"`
		Refill bool `json:"refill"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	var castJSON string
	err := s.Store.DB.QueryRow(
		`SELECT cast_json FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&castJSON)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		internalError(w, r, "remap speakers: fetch movie", err)
		return
	}

	if len(req.Mappings) > 500 {
		writeErr(w, http.StatusBadRequest, "too many mappings (max 500)")
		return
	}
	// Parse the cast once (not per mapping), for actor auto-fill.
	var cast []metadata.CastMember
	_ = json.Unmarshal([]byte(castJSON), &cast)
	findActor := func(character string) string {
		for _, c := range cast {
			if strings.EqualFold(strings.TrimSpace(c.Character), character) {
				return strings.TrimSpace(c.Actor)
			}
		}
		return ""
	}
	// Build the exact-from -> {character, actor} lookup. `from` is an exact stored
	// label from the UI, so match exactly (case-folding would collapse "Evey" and
	// "EVEY" into one, last-write-wins). Mappings whose target character is empty
	// are SKIPPED — remap renames a speaker, it must never erase one (that would be
	// silent, unrecoverable data loss).
	type target struct{ character, actor string }
	lookup := map[string]target{}
	for _, m := range req.Mappings {
		from, okf := trimCap(m.From, 128)
		ch, okc := trimCap(m.Character, 128)
		actor, oka := trimCap(m.Actor, 128)
		if !okf || !okc || !oka {
			writeErr(w, http.StatusBadRequest, "mapping field too long (max 128 characters)")
			return
		}
		if from == "" || ch == "" {
			continue
		}
		if actor == "" {
			actor = findActor(ch)
		}
		lookup[from] = target{ch, actor}
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "remap speakers: begin tx", err)
		return
	}
	defer tx.Rollback()

	// Snapshot (id, original character) before any write.
	type dlg struct {
		id int64
		ch string
	}
	var dials []dlg
	rows, err := tx.Query(`SELECT id, COALESCE(character, '') FROM dialogues WHERE movie_id = ?`, id)
	if err != nil {
		internalError(w, r, "remap speakers: scan dialogues", err)
		return
	}
	for rows.Next() {
		var d dlg
		if err := rows.Scan(&d.id, &d.ch); err != nil {
			rows.Close()
			internalError(w, r, "remap speakers: scan dialogue", err)
			return
		}
		dials = append(dials, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		internalError(w, r, "remap speakers: rows", err)
		return
	}

	remapped := 0
	for _, d := range dials {
		t, ok := lookup[strings.TrimSpace(d.ch)]
		if !ok {
			continue
		}
		if _, err := tx.Exec(
			`UPDATE dialogues SET character = ?, actor = ?, updated_at = datetime('now') WHERE id = ?`,
			nullable(t.character), nullable(t.actor), d.id); err != nil {
			internalError(w, r, "remap speakers: update", err)
			return
		}
		remapped++
	}

	refilled := 0
	if req.Refill {
		if refilled, err = refillMovieActors(tx, id); err != nil {
			internalError(w, r, "remap speakers: refill", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "remap speakers: commit", err)
		return
	}
	log.Printf("[metadata] remap movie %d: %d remapped, %d refilled", id, remapped, refilled)
	writeJSON(w, http.StatusOK, map[string]any{"remapped": remapped, "refilled": refilled})
}
