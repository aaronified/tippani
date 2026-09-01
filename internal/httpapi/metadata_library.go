package httpapi

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// handleMetadataLibrary powers the Metadata tab's review lists: every book and
// film/show with compact "what's missing" flags so the UI can surface the ones
// that still need a cover / cast / source link. Purpose-built (not the CRUD list
// endpoints) so it can carry the gap flags without perturbing those shapes.
func (s *Server) handleMetadataLibrary(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataLibrary uid=%v", uid)

	type bookItem struct {
		ID              int64  `json:"id"`
		Title           string `json:"title"`
		Author          string `json:"author"`
		Series          string `json:"series"`
		ISBN            string `json:"isbn"` // passed to the look-up picker to seed a stronger match
		ASIN            string `json:"asin"`
		HasCover        bool   `json:"has_cover"`
		LowResCover     bool   `json:"low_res_cover"` // stored cover narrower than the refetch threshold
		HasIDs          bool   `json:"has_ids"`       // linked to a source (isbn/asin/google/openlibrary)
		HasAuthor       bool   `json:"has_author"`
		HasSeries       bool   `json:"has_series"`
		HasYear         bool   `json:"has_year"`
		HasGenre        bool   `json:"has_genre"`
		HasDescription  bool   `json:"has_description"`
		AnnotationCount int    `json:"annotation_count"`
	}
	books := []bookItem{}
	brows, err := s.Store.DB.Query(`
		SELECT b.id, b.title, COALESCE(b.author, ''), COALESCE(b.series, ''), COALESCE(b.isbn, ''), COALESCE(b.asin, ''),
		       COALESCE(b.cover_path, ''),
		       (b.isbn IS NOT NULL OR b.asin IS NOT NULL OR b.google_id IS NOT NULL OR b.openlibrary_id IS NOT NULL),
		       (b.author IS NOT NULL AND b.author <> ''),
		       (b.series IS NOT NULL AND b.series <> ''),
		       (b.published_year IS NOT NULL AND b.published_year <> 0),
		       EXISTS(SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id),
		       (b.description IS NOT NULL AND b.description <> ''),
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
		var cover string
		if err := brows.Scan(&it.ID, &it.Title, &it.Author, &it.Series, &it.ISBN, &it.ASIN,
			&cover, &it.HasIDs, &it.HasAuthor, &it.HasSeries, &it.HasYear, &it.HasGenre,
			&it.HasDescription, &it.AnnotationCount); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] library book row scan failed: %v", err)
			continue
		}
		it.HasCover = cover != ""
		// coverWidth reads only the image header; 0 (webp/svg/missing) is
		// treated as unknown, not low-res, so it isn't flagged falsely.
		if cover != "" {
			if wpx := s.coverWidth(cover); wpx > 0 && wpx < lowResCoverWidth {
				it.LowResCover = true
			}
		}
		books = append(books, it)
	}
	if err := brows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] library book row iteration failed: %v", err)
	}

	type movieItem struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		MediaType   string `json:"media_type"`
		ReleaseYear int    `json:"release_year"`
		// The supplier ids, like the book row's isbn/asin above: the console's
		// look-up picker passes them on so a search here pins the same record
		// the work page would.
		TMDBID        int64 `json:"tmdb_id"`
		TVDBID        int64 `json:"tvdb_id"`
		HasPoster     bool  `json:"has_poster"`
		LowResPoster  bool  `json:"low_res_poster"`
		HasCast       bool  `json:"has_cast"`
		HasSource     bool  `json:"has_source"` // tmdb_id or tvdb_id
		HasDirector   bool  `json:"has_director"`
		HasYear       bool  `json:"has_year"`
		HasGenre      bool  `json:"has_genre"`
		DialogueCount int   `json:"dialogue_count"`
	}
	movies := []movieItem{}
	mrows, err := s.Store.DB.Query(`
		SELECT m.id, m.title, m.media_type, COALESCE(m.release_year, 0),
		       COALESCE(m.tmdb_id, 0), COALESCE(m.tvdb_id, 0),
		       COALESCE(m.poster_path, ''),
		       -- A cast is now a table (0048), so "has a cast" is a row test rather
		       -- than a blob test — which is what makes the console honest about a
		       -- game whose voice actors the reader typed in by hand. Tombstones do
		       -- not count: a row somebody deleted is not a cast.
		       EXISTS(SELECT 1 FROM work_cast wc
		              WHERE wc.kind = 'movie' AND wc.work_id = m.id AND wc.origin <> 'removed'),
		       (m.tmdb_id IS NOT NULL OR m.tvdb_id IS NOT NULL),
		       (m.director IS NOT NULL AND m.director <> ''),
		       (m.release_year IS NOT NULL AND m.release_year <> 0),
		       EXISTS(SELECT 1 FROM movie_genres mg WHERE mg.movie_id = m.id),
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
		var poster string
		if err := mrows.Scan(&it.ID, &it.Title, &it.MediaType, &it.ReleaseYear,
			&it.TMDBID, &it.TVDBID,
			&poster, &it.HasCast, &it.HasSource, &it.HasDirector, &it.HasYear, &it.HasGenre,
			&it.DialogueCount); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] library movie row scan failed: %v", err)
			continue
		}
		it.HasPoster = poster != ""
		if poster != "" {
			if wpx := s.coverWidth(poster); wpx > 0 && wpx < lowResCoverWidth {
				it.LowResPoster = true
			}
		}
		movies = append(movies, it)
	}
	if err := mrows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] library movie row iteration failed: %v", err)
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
// renames the character COMPONENT matching `from` to `character` and sets `actor`
// (auto-filled from the cast when the mapping leaves it blank). This is how an
// imported label ("Evey Hammond") gets reconciled with the supplier's cast
// character ("Evey") so the actor fills in. `refill` additionally re-runs the cast
// auto-fill across the whole movie for any still-empty actors.
//
// COMPONENT, not whole label. A line spoken by two characters is stored as
// "V, Evey", and matching the whole string meant mapping "V" changed nothing while
// reporting success. An ensemble is now rewritten in place through
// metadata.ReplaceCredit, so separators, spacing and co-credits survive byte for
// byte and only the matched name moves. A single-speaker line keeps the old
// behaviour exactly: both fields are set outright, which is the path that fills a
// missing actor from the cast.
//
// On an ensemble the actor is spliced at the SAME INDEX as the character it
// belongs to, and only when the two lists line up. Imported rows routinely carry a
// different number of actors than characters, or carry them in another order, with
// nothing in the row to say which is which — so an unaligned row keeps its actor
// rather than pairing the wrong actor with the wrong character invisibly.
//
// Matching is done against each dialogue's ORIGINAL components (read once up
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
	olog.Tracef("[meta] handleRemapSpeakers uid=%v movie=%v mappings=%d refill=%v", uid, id, len(req.Mappings), req.Refill)
	// The ownership check. It used to bring the cast blob back with it; the cast is
	// its own table now and is read per mapping below.
	var one int
	err := s.Store.DB.QueryRow(
		`SELECT 1 FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&one)
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
	// Who plays the character a mapping renames TO, for the actor auto-fill — read
	// from the cast MAPPING (0048) and not from the blob, so that this endpoint and
	// the refill below cannot disagree about who plays somebody. They are two halves
	// of one request, and they used to read two different sources.
	//
	// castActorFor rather than a hand-rolled scan: the fold, the tombstone
	// exclusion and the billing tie-break are then the same three rules the quote
	// form's own auto-fill applies, in one implementation.
	findActor := func(character string) string {
		return castActorFor(s.Store.DB, "movie", id, character)
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

	// Snapshot (id, original character, original actor) before any write. The actor
	// is read now because an ENSEMBLE line needs it: splicing one name into a
	// compound actor string requires knowing what the other slots hold.
	type dlg struct {
		id    int64
		ch    string
		actor string
	}
	var dials []dlg
	rows, err := tx.Query(`SELECT id, COALESCE(character, ''), COALESCE(actor, '') FROM dialogues WHERE movie_id = ?`, id)
	if err != nil {
		internalError(w, r, "remap speakers: scan dialogues", err)
		return
	}
	for rows.Next() {
		var d dlg
		if err := rows.Scan(&d.id, &d.ch, &d.actor); err != nil {
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

	// AN ENSEMBLE LINE IS REMAPPED COMPONENT BY COMPONENT.
	//
	// This used to be `lookup[strings.TrimSpace(d.ch)]` — an exact match against the
	// WHOLE stored label. A line spoken by two characters is stored as "V, Evey", so
	// mapping "V" matched nothing and the remap reported success having changed no
	// rows. The screen offering "V, Evey" as one remappable label was the visible
	// half of the same bug; listing the individuals without this would have made the
	// silence worse, because then the label you picked would look right and still do
	// nothing.
	//
	// metadata.ReplaceCredit is the existing in-place component rewrite — the one
	// the person rename uses. It keeps separators, spacing and every co-credit
	// byte-for-byte, which is the whole requirement here: "V, Evey" must come back
	// as "V, Evey" with only the matched part touched.
	seps := s.creditSeps(uid)
	remapped := 0
	for _, d := range dials {
		charParts := metadata.SplitCredits(d.ch, seps)
		newChar, newActor := d.ch, d.actor
		hit := false

		if len(charParts) <= 1 {
			// The single-speaker case, unchanged from before: both fields are set
			// outright. This is the common path and the one that fills in a missing
			// actor from the cast, so it must not acquire the compound rules below.
			if t, ok := lookup[strings.TrimSpace(d.ch)]; ok {
				newChar, newActor, hit = t.character, t.actor, true
			}
		} else {
			// Matching is against the ORIGINAL components, read once, so a chained
			// rename (A→B, B→C) cannot cascade — the same guarantee the whole-string
			// version gave.
			actorParts := metadata.SplitCredits(d.actor, seps)
			aligned := len(actorParts) == len(charParts)
			for i, part := range charParts {
				t, ok := lookup[strings.TrimSpace(part)]
				if !ok {
					continue
				}
				rewritten, changed := metadata.ReplaceCredit(newChar, part, t.character, seps)
				if !changed {
					continue
				}
				newChar = rewritten
				hit = true
				// THE ACTOR IS SPLICED AT THE SAME POSITION, and only when the two
				// lists line up. Imported data routinely carries a different number
				// of actors than characters, or carries them in another order, and
				// there is nothing in the row that says which is which — so an
				// unaligned row leaves the actor exactly as it was rather than
				// pairing the wrong actor with the wrong character silently. That
				// failure would be invisible and would look like data you had
				// entered yourself.
				if t.actor == "" || !aligned || i >= len(actorParts) || strings.TrimSpace(actorParts[i]) == "" {
					if t.actor != "" && !aligned {
						olog.Warnf(olog.CodeMetaRemapUnaligned,
							"[meta] remap movie %d dialogue %d: %d characters vs %d actors, leaving the actor alone",
							id, d.id, len(charParts), len(actorParts))
					}
					continue
				}
				if spliced, ok := metadata.ReplaceCredit(newActor, actorParts[i], t.actor, seps); ok {
					newActor = spliced
				}
			}
		}
		if !hit || (newChar == d.ch && newActor == d.actor) {
			continue
		}
		if _, err := tx.Exec(
			`UPDATE dialogues SET character = ?, actor = ?, updated_at = datetime('now') WHERE id = ?`,
			nullable(newChar), nullable(newActor), d.id); err != nil {
			internalError(w, r, "remap speakers: update", err)
			return
		}
		// A remap is the ONE path that deliberately rewrites an actor the reader
		// already had, so it is also the one that can leave a link pointing at the
		// person the line no longer names. See 0059.
		if err := store.SyncQuotePerson(tx, uid, store.KindScreen, d.id, seps); err != nil {
			internalError(w, r, "remap speakers: link actor", err)
			return
		}
		remapped++
	}

	refilled := 0
	if req.Refill {
		if refilled, err = refillMovieActors(tx, uid, id, seps); err != nil {
			internalError(w, r, "remap speakers: refill", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "remap speakers: commit", err)
		return
	}
	log.Printf("[metadata] remap movie %d: %d remapped, %d refilled", id, remapped, refilled)
	s.gcOrphanPeople(uid, "actor") // remapping speaker labels can retire an actor name
	writeJSON(w, http.StatusOK, map[string]any{"remapped": remapped, "refilled": refilled})
}
