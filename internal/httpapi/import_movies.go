package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"tippani/internal/importer"
	"tippani/internal/store"
)

// handleImportIMDb imports a saved IMDb quotes page into movies/dialogues.
// Unlike the books import (handleImport → books/annotations), quotes are
// film/show dialogue, so this owns its own upsert + insert path. Idempotent:
// duplicate dialogues (same dedupe_hash within the movie) are counted skipped.
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
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	movieID, created, err := upsertImportMovie(tx, uid, res.Movie)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	added := 0
	for _, d := range res.Dialogues {
		ins, err := tx.Exec(`
			INSERT OR IGNORE INTO dialogues (movie_id, quote, character, dedupe_hash)
			VALUES (?, ?, ?, ?)`,
			movieID, d.Quote, nullable(d.Character), store.DedupeHash(d.Quote))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		if n, _ := ins.RowsAffected(); n > 0 {
			added++
		}
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"movie_id":   movieID,
		"media_type": res.Movie.MediaType,
		"title":      res.Movie.Title,
		"created":    created,
		"added":      added,
		"skipped":    len(res.Dialogues) - added,
	})
}

// upsertImportMovie finds or creates the film/show to attach dialogues to,
// matching on (user_id, lower(title), release_year) — imported titles carry no
// tmdb/tvdb id, so title+year is the identity. A created row can be enriched
// later via a TMDB/TVDB lookup in the edit view.
func upsertImportMovie(tx *sql.Tx, uid int64, m importer.MovieHeader) (int64, bool, error) {
	mediaType := m.MediaType
	if mediaType != "show" {
		mediaType = "movie"
	}
	var id int64
	err := tx.QueryRow(`
		SELECT id FROM movies
		WHERE user_id = ? AND lower(title) = lower(?) AND COALESCE(release_year, 0) = ?`,
		uid, m.Title, m.Year).Scan(&id)
	if err == nil {
		return id, false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, false, err
	}
	res, err := tx.Exec(
		`INSERT INTO movies (user_id, title, release_year, media_type) VALUES (?, ?, ?, ?)`,
		uid, m.Title, nullableInt(m.Year), mediaType)
	if err != nil {
		return 0, false, err
	}
	id, err = res.LastInsertId()
	return id, true, err
}
