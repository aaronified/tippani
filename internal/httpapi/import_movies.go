package httpapi

import (
	"database/sql"
	"log"
	"net/http"

	"tippani/internal/importer"
	"tippani/internal/store"
)

// handleImportIMDb imports a saved IMDb quotes page into movies/dialogues.
// Unlike the books import (handleImport → books/annotations), quotes are
// film/show dialogue, so this owns its own upsert + insert path. Idempotent:
// duplicate dialogues (same dedupe_hash within the movie) are counted skipped.
//
// Anchoring (PLAN §5, user request): a page's title rarely matches a title the
// user already curated on the year alone (IMDb's release year and TMDB's often
// differ by one), so dialogues attach to a pre-existing same-title film when
// there is one, rather than spawning a poster-less duplicate. What happened —
// created vs anchored, any year mismatch, and whether the match was ambiguous —
// is returned so the import review UI can surface it for confirmation.
func (s *Server) handleImportIMDb(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImportBody) // before parsing
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, http.StatusBadRequest, `multipart "file" field required (max 5 MB)`)
		return
	}
	defer f.Close()
	res, err := importer.IMDbQuotes(f)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "imdb import: begin tx", err)
		return
	}
	defer tx.Rollback()
	m, err := upsertImportMovie(tx, uid, res.Movie)
	if err != nil {
		internalError(w, r, "imdb import: upsert movie", err)
		return
	}
	added := 0
	for _, d := range res.Dialogues {
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO dialogues (movie_id, quote, character, dedupe_hash)
			VALUES (?, ?, ?, ?)`,
			m.ID, d.Quote, nullable(d.Character), store.DedupeHash(d.Quote))
		if err != nil {
			internalError(w, r, "imdb import: insert dialogue", err)
			return
		}
		if n, _ := ins.RowsAffected(); n > 0 {
			added++
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "imdb import: commit", err)
		return
	}
	log.Printf("[import] imdb %q (%s, year %d) -> movie %d created=%t anchored=%t matched_year=%d ambiguous=%t: %d added, %d skipped",
		res.Movie.Title, res.Movie.MediaType, res.Movie.Year, m.ID, m.Created, m.Anchored,
		m.MatchedYear, m.Ambiguous, added, len(res.Dialogues)-added)
	writeJSON(w, http.StatusOK, map[string]any{
		"movie_id":      m.ID,
		"media_type":    res.Movie.MediaType,
		"title":         res.Movie.Title,
		"created":       m.Created,
		"anchored":      m.Anchored,
		"year_imported": res.Movie.Year,
		"matched_year":  m.MatchedYear,
		"ambiguous":     m.Ambiguous,
		"alternatives":  m.Alternatives,
		"added":         added,
		"skipped":       len(res.Dialogues) - added,
	})
}

// importMovieResult reports how an imported title resolved: which movie the
// dialogues attach to, whether it was newly created or anchored to a pre-existing
// same-title row, the anchor's own year (to flag a mismatch), and whether the
// match was ambiguous (more than one same-title film existed).
type importMovieResult struct {
	ID           int64
	Created      bool
	Anchored     bool
	MatchedYear  int
	Ambiguous    bool
	Alternatives int
}

// upsertImportMovie finds or creates the film/show to attach dialogues to.
// Imported titles carry no tmdb/tvdb id, so identity is a fuzzy title match
// within the same media_type: when one or more already exist it anchors to the
// best of them (preferring an exact year match, then the most-curated row);
// otherwise it creates a bare row that a later TMDB/TVDB lookup can enrich.
func upsertImportMovie(tx *sql.Tx, uid int64, m importer.MovieHeader) (importMovieResult, error) {
	mediaType := m.MediaType
	if mediaType != "show" {
		mediaType = "movie"
	}
	matches, err := findSimilarMovies(tx, uid, m.Title, mediaType, 0)
	if err != nil {
		return importMovieResult{}, err
	}
	if len(matches) > 0 {
		best := matches[0]
		for _, cand := range matches[1:] {
			if anchorScore(cand, m.Year) > anchorScore(best, m.Year) {
				best = cand
			}
		}
		return importMovieResult{
			ID:           best.ID,
			Anchored:     true,
			MatchedYear:  best.ReleaseYear,
			Ambiguous:    len(matches) > 1,
			Alternatives: len(matches) - 1,
		}, nil
	}
	res, err := tx.Exec(
		`INSERT INTO movies (user_id, title, release_year, media_type) VALUES (?, ?, ?, ?)`,
		uid, m.Title, nullableInt(m.Year), mediaType)
	if err != nil {
		return importMovieResult{}, err
	}
	id, err := res.LastInsertId()
	return importMovieResult{ID: id, Created: true}, err
}

// anchorScore ranks a same-title candidate for imported dialogues: an exact
// release-year match dominates, then a curated poster, then existing dialogues,
// then recency (higher id). Higher wins.
func anchorScore(h movieDupHint, importedYear int) int {
	score := 0
	if importedYear != 0 && h.ReleaseYear == importedYear {
		score += 8
	}
	if h.HasPoster {
		score += 4
	}
	if h.DialogueCount > 0 {
		score += 2
	}
	return score
}

// persistMovies writes a parsed catalogue-export batch (one or many titles) into
// the store in one transaction — the catalogue round-trip counterpart to
// persistBooks. Titles anchor to an existing same-name row when there is one
// (idempotent re-import); director/genres backfill fills only what's missing.
func (s *Server) persistMovies(w http.ResponseWriter, r *http.Request, results []*importer.MovieResult) {
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "movie md import: begin tx", err)
		return
	}
	defer tx.Rollback()

	type movieSummary struct {
		MovieID  int64  `json:"movie_id"`
		Title    string `json:"title"`
		Created  bool   `json:"created"`
		Added    int    `json:"added"`
		Skipped  int    `json:"skipped"`
		Enriched int    `json:"enriched"`
	}
	var movies []movieSummary
	var movieIDs []int64
	tAdd, tEn, tTot := 0, 0, 0
	for _, res := range results {
		id, added, enriched, created, err := s.importOneMovie(tx, uid, res)
		if err != nil {
			internalError(w, r, "movie md import: persist", err)
			return
		}
		movies = append(movies, movieSummary{id, res.Movie.Title, created, added, len(res.Dialogues) - added, enriched})
		movieIDs = append(movieIDs, id)
		tAdd += added
		tEn += enriched
		tTot += len(res.Dialogues)
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "movie md import: commit", err)
		return
	}
	resp := map[string]any{
		"added":     tAdd,
		"skipped":   tTot - tAdd,
		"enriched":  tEn,
		"movie_ids": movieIDs,
		"movies":    movies,
	}
	if len(movies) > 0 { // back-compat with the IMDb single-title response shape
		resp["movie_id"] = movies[0].MovieID
		resp["title"] = movies[0].Title
		resp["created"] = movies[0].Created
	}
	writeJSON(w, http.StatusOK, resp)
}

// importOneMovie upserts one parsed title and inserts/enriches its dialogues in
// the caller's transaction. Director/genres backfill fill-empty (curated data
// wins); dialogues dedupe by hash and enrich the fields an existing copy lacks.
func (s *Server) importOneMovie(tx *sql.Tx, uid int64, res *importer.MovieResult) (int64, int, int, bool, error) {
	m, err := upsertImportMovie(tx, uid, res.Movie)
	if err != nil {
		return 0, 0, 0, false, err
	}
	if res.Movie.Director != "" {
		if _, err := tx.Exec(`UPDATE movies SET director = COALESCE(director, ?) WHERE id = ?`,
			nullable(res.Movie.Director), m.ID); err != nil {
			return 0, 0, 0, false, err
		}
	}
	if len(res.Movie.Genres) > 0 { // only when the row has no genres (don't clobber a curated set)
		var hasGenres bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM movie_genres WHERE movie_id = ?)`, m.ID).Scan(&hasGenres); err != nil {
			return 0, 0, 0, false, err
		}
		if !hasGenres {
			if err := setGenres(tx, "movie", uid, m.ID, res.Movie.Genres); err != nil {
				return 0, 0, 0, false, err
			}
		}
	}
	var castJSON string
	_ = tx.QueryRow(`SELECT COALESCE(cast_json, '') FROM movies WHERE id = ?`, m.ID).Scan(&castJSON)

	added, enriched := 0, 0
	for _, d := range res.Dialogues {
		actor := autofillActor(castJSON, d.Character, d.Actor)
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO dialogues
			  (movie_id, quote, note, character, actor, timestamp, favorite, dedupe_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			m.ID, d.Quote, nullable(d.Note), nullable(d.Character), nullable(actor),
			nullable(d.Timestamp), d.Favorite, store.DedupeHash(d.Quote))
		if err != nil {
			return 0, 0, 0, false, err
		}
		if n, _ := ins.RowsAffected(); n == 0 {
			upd, err := tx.Exec(`
				UPDATE dialogues SET
				  note      = COALESCE(note, ?),
				  character = COALESCE(character, ?),
				  actor     = COALESCE(actor, ?),
				  timestamp = COALESCE(timestamp, ?),
				  favorite  = MAX(favorite, ?),
				  updated_at = datetime('now')
				WHERE movie_id = ? AND dedupe_hash = ?
				  AND (   (note IS NULL AND ? IS NOT NULL)
				       OR (character IS NULL AND ? IS NOT NULL)
				       OR (actor IS NULL AND ? IS NOT NULL)
				       OR (timestamp IS NULL AND ? IS NOT NULL)
				       OR (favorite = 0 AND ?))`,
				nullable(d.Note), nullable(d.Character), nullable(actor), nullable(d.Timestamp), d.Favorite,
				m.ID, store.DedupeHash(d.Quote),
				nullable(d.Note), nullable(d.Character), nullable(actor), nullable(d.Timestamp), d.Favorite)
			if err != nil {
				return 0, 0, 0, false, err
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				enriched++
			}
			if len(d.Tags) > 0 {
				var did int64
				if err := tx.QueryRow(`SELECT id FROM dialogues WHERE movie_id = ? AND dedupe_hash = ?`,
					m.ID, store.DedupeHash(d.Quote)).Scan(&did); err == nil {
					if err := addTags(tx, "dialogue", uid, did, d.Tags); err != nil {
						return 0, 0, 0, false, err
					}
				}
			}
			continue
		}
		added++
		if len(d.Tags) > 0 {
			did, _ := ins.LastInsertId()
			if err := setTags(tx, "dialogue", uid, did, d.Tags); err != nil {
				return 0, 0, 0, false, err
			}
		}
	}
	return m.ID, added, enriched, m.Created, nil
}
