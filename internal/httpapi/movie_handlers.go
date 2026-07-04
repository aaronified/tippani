package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"tippani/internal/metadata"
)

// tmdbKeyMissing: manual movie entry still works without a key (PLAN §6).
const tmdbKeyMissing = "TMDB API key not configured (set TIPPANI_TMDB_API_KEY or save a key in Settings)"

type movieReq struct {
	TMDBID      int64    `json:"tmdb_id"`
	Title       string   `json:"title"`
	Director    string   `json:"director"`
	ReleaseYear int      `json:"release_year"`
	Description string   `json:"description"`
	Genres      []string `json:"genres"`
	PosterURL   string   `json:"poster_url"`  // update: set/replace the poster
	ClearCover  bool     `json:"clear_cover"` // update: drop the current poster
}

func (m *movieReq) validate() string {
	m.Title = strings.TrimSpace(m.Title)
	m.Director = strings.TrimSpace(m.Director)
	m.Description = strings.TrimSpace(m.Description)
	if m.Title == "" {
		return "title is required"
	}
	if !validYear(m.ReleaseYear) {
		return "release_year must be between 1000 and 3000"
	}
	return ""
}

// movieDetail is the single-movie response shape (POST/GET/PUT /movies).
type movieDetail struct {
	ID          int64                 `json:"id"`
	Title       string                `json:"title"`
	Director    string                `json:"director"`
	ReleaseYear int                   `json:"release_year"`
	TMDBID      int64                 `json:"tmdb_id"`
	PosterPath  string                `json:"poster_path"`
	Description string                `json:"description"`
	Genres      []string              `json:"genres"`
	Cast        []metadata.CastMember `json:"cast"`
	CreatedAt   string                `json:"created_at"`
}

func (s *Server) fetchMovie(uid, id int64) (*movieDetail, error) {
	var m movieDetail
	var castJSON string
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(director, ''), COALESCE(release_year, 0), COALESCE(tmdb_id, 0),
		       COALESCE(poster_path, ''), COALESCE(description, ''), cast_json, created_at
		FROM movies WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&m.ID, &m.Title, &m.Director, &m.ReleaseYear, &m.TMDBID,
			&m.PosterPath, &m.Description, &castJSON, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	m.Cast = []metadata.CastMember{}
	_ = json.Unmarshal([]byte(castJSON), &m.Cast) // bad stored JSON -> empty cast
	if m.Cast == nil {
		m.Cast = []metadata.CastMember{}
	}
	m.Genres = []string{}
	rows, err := s.Store.DB.Query(`
		SELECT g.name FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
		WHERE mg.movie_id = ? ORDER BY g.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			m.Genres = append(m.Genres, n)
		}
	}
	return &m, nil
}

// handleCreateMovie: with tmdb_id the server fetches details+credits itself
// (PLAN §6, one call); otherwise it is a manual entry with an empty cast.
func (s *Server) handleCreateMovie(w http.ResponseWriter, r *http.Request) {
	var req movieReq
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TMDBID != 0 {
		s.createMovieFromTMDB(w, r, req.TMDBID)
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO movies (user_id, title, director, release_year, description)
		VALUES (?, ?, ?, ?, ?)`,
		uid, req.Title, nullable(req.Director), nullableInt(req.ReleaseYear),
		nullable(req.Description))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	id, _ := res.LastInsertId()
	if err := setGenres(tx, "movie", uid, id, req.Genres); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

func (s *Server) createMovieFromTMDB(w http.ResponseWriter, r *http.Request, tmdbID int64) {
	tmdb, _ := s.resolveTMDB() // env > settings custom > built-in (PLAN §6)
	if tmdb == nil {
		writeErr(w, http.StatusServiceUnavailable, tmdbKeyMissing)
		return
	}
	d, err := tmdb.Details(r.Context(), tmdbID)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "TMDB lookup failed")
		return
	}
	// Poster fetch is non-fatal, same rule as book covers.
	var posterPath string
	if d.PosterURL != "" {
		if name, err := s.fetchImage(r.Context(), d.PosterURL, s.coversDir()); err == nil {
			posterPath = name
		}
	}
	castJSON := "[]"
	if len(d.Cast) > 0 {
		if b, err := json.Marshal(d.Cast); err == nil {
			castJSON = string(b)
		}
	}

	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO movies (user_id, title, director, release_year, tmdb_id,
		                    poster_path, description, cast_json, source_metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		uid, d.Title, nullable(d.Director), nullableInt(d.ReleaseYear), tmdbID,
		nullable(posterPath), nullable(d.Overview), castJSON, string(d.Raw))
	if err != nil {
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // (user_id, tmdb_id) collision
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusConflict, "movie already in your library")
		return
	}
	id, _ := res.LastInsertId()
	if err := setGenres(tx, "movie", uid, id, d.Genres); err != nil {
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

func (s *Server) handleListMovies(w http.ResponseWriter, r *http.Request) {
	type item struct {
		ID            int64    `json:"id"`
		Title         string   `json:"title"`
		Director      string   `json:"director"`
		ReleaseYear   int      `json:"release_year"`
		PosterPath    string   `json:"poster_path"`
		Genres        []string `json:"genres"`
		DialogueCount int      `json:"dialogue_count"`
	}
	uid := userID(r)
	rows, err := s.Store.DB.Query(`
		SELECT m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0),
		       COALESCE(m.poster_path, ''),
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id)
		FROM movies m WHERE m.user_id = ?
		ORDER BY m.created_at DESC, m.id DESC`, uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Director, &it.ReleaseYear,
			&it.PosterPath, &it.DialogueCount); err == nil {
			items = append(items, it)
		}
	}
	byMovie, err := s.genreNames(uid, "movie")
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	for i := range items {
		if gs := byMovie[items[i].ID]; gs != nil {
			items[i].Genres = gs
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"movies": items})
}

func (s *Server) handleGetMovie(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	m, err := s.fetchMovie(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
	default:
		writeJSON(w, http.StatusOK, m)
	}
}

func (s *Server) handleUpdateMovie(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	var req movieReq
	if !decodeBody(w, r, &req) {
		return
	}
	// A non-zero tmdb_id re-syncs everything (poster, cast, genres, details)
	// from TMDB — the "look up on TMDB" action in the edit view.
	if req.TMDBID != 0 {
		s.resyncMovieFromTMDB(w, r, id, req.TMDBID)
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)

	// Poster: explicit clear wins; else a provided poster_url is fetched
	// (user-typed, any host) and replaces the stored file; else left as-is.
	var oldPoster sql.NullString
	if err := s.Store.DB.QueryRow(
		`SELECT poster_path FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&oldPoster); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusNotFound, "movie not found")
		} else {
			writeErr(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	changePoster, newPoster := false, ""
	if req.ClearCover {
		changePoster = true
	} else if req.PosterURL != "" {
		name, ferr := s.fetchUserImage(r.Context(), req.PosterURL, s.coversDir())
		if ferr != nil {
			writeErr(w, http.StatusBadGateway,
				"couldn't fetch that poster image — check the URL points directly at a JPG/PNG/WebP/GIF under 2 MB")
			return
		}
		newPoster, changePoster = name, true
	}
	fail := func(code int, msg string) {
		s.removeCoverFile(newPoster)
		writeErr(w, code, msg)
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		UPDATE movies SET title = ?, director = ?, release_year = ?, description = ?
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Director), nullableInt(req.ReleaseYear),
		nullable(req.Description), id, uid)
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "movie not found")
		return
	}
	if changePoster {
		if _, err := tx.Exec(`UPDATE movies SET poster_path = ? WHERE id = ? AND user_id = ?`,
			nullable(newPoster), id, uid); err != nil {
			fail(http.StatusInternalServerError, "internal error")
			return
		}
	}
	if err := setGenres(tx, "movie", uid, id, req.Genres); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if changePoster && oldPoster.String != newPoster {
		s.removeCoverFile(oldPoster.String)
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// resyncMovieFromTMDB re-pulls details+credits for an existing movie and
// overwrites title/director/year/description/cast/genres and the poster. Used
// by the edit view's "look up on TMDB" picker.
func (s *Server) resyncMovieFromTMDB(w http.ResponseWriter, r *http.Request, id, tmdbID int64) {
	tmdb, _ := s.resolveTMDB()
	if tmdb == nil {
		writeErr(w, http.StatusServiceUnavailable, tmdbKeyMissing)
		return
	}
	d, err := tmdb.Details(r.Context(), tmdbID)
	if err != nil {
		if errors.Is(err, metadata.ErrTMDBAuth) {
			writeErr(w, http.StatusBadGateway, "TMDB rejected the key — re-check it in Settings → Metadata sources")
			return
		}
		writeErr(w, http.StatusBadGateway, "TMDB lookup failed")
		return
	}
	uid := userID(r)
	var oldPoster sql.NullString
	if err := s.Store.DB.QueryRow(
		`SELECT poster_path FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&oldPoster); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusNotFound, "movie not found")
		} else {
			writeErr(w, http.StatusInternalServerError, "internal error")
		}
		return
	}
	// Reject re-syncing to a tmdb_id another of the user's movies already holds.
	var clash bool
	if err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM movies WHERE user_id = ? AND id <> ? AND tmdb_id = ?)`,
		uid, id, tmdbID).Scan(&clash); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "another movie in your library is already that TMDB title")
		return
	}
	var newPoster string
	if d.PosterURL != "" {
		if name, err := s.fetchImage(r.Context(), d.PosterURL, s.coversDir()); err == nil {
			newPoster = name
		}
	}
	castJSON := "[]"
	if len(d.Cast) > 0 {
		if b, err := json.Marshal(d.Cast); err == nil {
			castJSON = string(b)
		}
	}
	fail := func(code int, msg string) {
		s.removeCoverFile(newPoster)
		writeErr(w, code, msg)
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	// Keep the existing poster if TMDB had none this time.
	poster := oldPoster.String
	if newPoster != "" {
		poster = newPoster
	}
	res, err := tx.Exec(`
		UPDATE movies SET title = ?, director = ?, release_year = ?, tmdb_id = ?,
		                  poster_path = ?, description = ?, cast_json = ?, source_metadata = ?
		WHERE id = ? AND user_id = ?`,
		d.Title, nullable(d.Director), nullableInt(d.ReleaseYear), tmdbID,
		nullable(poster), nullable(d.Overview), castJSON, string(d.Raw), id, uid)
	if err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "movie not found")
		return
	}
	if err := setGenres(tx, "movie", uid, id, d.Genres); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(http.StatusInternalServerError, "internal error")
		return
	}
	if newPoster != "" && oldPoster.String != newPoster {
		s.removeCoverFile(oldPoster.String)
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (s *Server) handleDeleteMovie(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		writeErr(w, http.StatusBadRequest, "invalid movie id")
		return
	}
	uid := userID(r)
	var poster sql.NullString
	err := s.Store.DB.QueryRow(
		`SELECT poster_path FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&poster)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer tx.Rollback()
	// Dialogues cascade with the movie; GC the genres it held (tags persist, §10).
	if _, err := tx.Exec(`DELETE FROM movies WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := gcGenres(tx, uid); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	s.removeCoverFile(poster.String) // best-effort
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
