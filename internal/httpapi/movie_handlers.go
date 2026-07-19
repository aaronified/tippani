package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// tmdbKeyMissing: manual movie entry still works without a key (PLAN §6).
const tmdbKeyMissing = "TMDB API key not configured (add one in Settings)"
const tvdbKeyMissing = "TheTVDB API key not configured (set TIPPANI_TVDB_API_KEY or save a key in Settings)"

type movieReq struct {
	TMDBID      int64    `json:"tmdb_id"`
	Source      string   `json:"source"`    // "tmdb" | "tvdb": with SourceID, create/resync from that supplier
	SourceID    string   `json:"source_id"` // id within the source
	Title       string   `json:"title"`
	Director    string   `json:"director"` // "creator" for shows; one column, labelled per media_type in the UI
	ReleaseYear int      `json:"release_year"`
	Description string   `json:"description"`
	Genres      []string `json:"genres"`
	MediaType   string   `json:"media_type"` // "movie" (default) | "show"
	Series      string   `json:"series"`
	SeriesIndex float64  `json:"series_index"`
	Favorite    bool     `json:"favorite"`
	PosterURL   string   `json:"poster_url"`   // update: set/replace the poster
	ClearCover  bool     `json:"clear_cover"`  // update: drop the current poster
	ConfirmNew  bool     `json:"confirm_new"`  // create-from-source: add a separate title despite a same-name look-alike
}

func (m *movieReq) validate() string {
	m.Title = strings.TrimSpace(m.Title)
	m.Director = strings.TrimSpace(m.Director)
	m.Description = strings.TrimSpace(m.Description)
	m.Series = strings.TrimSpace(m.Series)
	if m.Title == "" {
		return "title is required"
	}
	if !validYear(m.ReleaseYear) {
		return "release_year must be between 1000 and 3000"
	}
	if msg := normalizeMediaType(&m.MediaType); msg != "" {
		return msg
	}
	return ""
}

// normalizeMediaType defaults an empty media_type to "movie" and rejects
// anything outside the {movie, show} vocabulary (validated in app code — the
// column has no CHECK, matching the 0004 convention).
func normalizeMediaType(mt *string) string {
	switch *mt {
	case "", "movie":
		*mt = "movie"
	case "show":
	default:
		return "media_type must be 'movie' or 'show'"
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
	TVDBID      int64                 `json:"tvdb_id"`
	MediaType   string                `json:"media_type"`
	PosterPath  string                `json:"poster_path"`
	Description string                `json:"description"`
	Genres      []string              `json:"genres"`
	Series      string                `json:"series"`
	SeriesIndex float64               `json:"series_index"`
	Favorite    bool                  `json:"favorite"`
	Cast        []metadata.CastMember `json:"cast"`
	CreatedAt   string                `json:"created_at"`
}

func (s *Server) fetchMovie(uid, id int64) (*movieDetail, error) {
	var m movieDetail
	var castJSON string
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(director, ''), COALESCE(release_year, 0), COALESCE(tmdb_id, 0),
		       COALESCE(tvdb_id, 0), media_type, COALESCE(poster_path, ''), COALESCE(description, ''),
		       COALESCE(series, ''), COALESCE(series_index, 0), favorite, cast_json, created_at
		FROM movies WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&m.ID, &m.Title, &m.Director, &m.ReleaseYear, &m.TMDBID,
			&m.TVDBID, &m.MediaType, &m.PosterPath, &m.Description,
			&m.Series, &m.SeriesIndex, &m.Favorite, &castJSON, &m.CreatedAt)
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
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeMovieRowScan, "[movie] genre name row scan failed: %v", err)
			continue
		}
		m.Genres = append(m.Genres, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMovieRowScan, "[movie] genre name row iteration failed: %v", err)
	}
	return &m, nil
}

// handleCreateMovie: with a source+source_id (or legacy tmdb_id) the server
// fetches details+credits itself (PLAN §6); otherwise it is a manual entry with
// an empty cast.
func (s *Server) handleCreateMovie(w http.ResponseWriter, r *http.Request) {
	var req movieReq
	if !decodeBody(w, r, &req) {
		return
	}
	olog.Tracef("[movie] handleCreateMovie uid=%v source=%q source_id=%q tmdb_id=%v", userID(r), req.Source, req.SourceID, req.TMDBID)
	if req.Source != "" && req.SourceID != "" {
		s.createMovieFromSource(w, r, req.Source, req.SourceID, req.MediaType, req.ConfirmNew)
		return
	}
	if req.TMDBID != 0 { // legacy clients / tests: tmdb_id implies a TMDB movie
		s.createMovieFromSource(w, r, "tmdb", strconv.FormatInt(req.TMDBID, 10), "movie", req.ConfirmNew)
		return
	}
	if msg := req.validate(); msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	uid := userID(r)
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "create movie: begin tx", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO movies (user_id, title, director, release_year, description,
		                    media_type, series, series_index, favorite)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		uid, req.Title, nullable(req.Director), nullableInt(req.ReleaseYear),
		nullable(req.Description), req.MediaType, nullable(req.Series),
		nullableFloat(req.SeriesIndex), req.Favorite)
	if err != nil {
		internalError(w, r, "create movie: insert", err)
		return
	}
	id, _ := res.LastInsertId()
	if err := setGenres(tx, "movie", uid, id, req.Genres); err != nil {
		internalError(w, r, "create movie: set genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "create movie: commit", err)
		return
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		internalError(w, r, "create movie: fetch", err)
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

// createMovieFromSource pulls details+credits from the given supplier (TMDB or
// TheTVDB, movie or show) and inserts the row. The tmdb_id/tvdb_id column is set
// from whichever id the details carry, so both partial unique indexes dedupe.
//
// Before inserting it guards against silently duplicating a title the user
// already has under a different (or no) supplier id — e.g. a poster-less row an
// IMDb import created. Unless confirmNew is set, a same-name look-alike is
// reported (409 + needs_confirm + the existing rows) so the UI can offer to
// enrich the existing entry instead of adding a second one.
func (s *Server) createMovieFromSource(w http.ResponseWriter, r *http.Request, source, sourceID, mediaType string, confirmNew bool) {
	d, msg, code := s.fetchSourceDetails(r.Context(), source, sourceID, mediaType)
	if d == nil {
		writeErr(w, code, msg)
		return
	}
	uid := userID(r)
	if !confirmNew {
		existing, err := s.similarMoviesForSource(uid, d)
		if err != nil {
			internalError(w, r, "create movie: scan look-alikes", err)
			return
		}
		if len(existing) > 0 {
			log.Printf("[movies] add %q from %s#%s needs confirm: %d same-name look-alike(s)",
				d.Title, source, sourceID, len(existing))
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":         "you already have a title with this name",
				"needs_confirm": true,
				"existing":      existing,
			})
			return
		}
	}
	// Poster fetch is non-fatal, same rule as book covers.
	var posterPath string
	if d.PosterURL != "" {
		if name, err := s.fetchImage(r.Context(), d.PosterURL, s.coversDir()); err == nil {
			posterPath = name
		} else {
			olog.Warnf(olog.CodeMovieCover, "[movie] poster fetch failed: %v", err)
		}
	}
	castJSON := "[]"
	if len(d.Cast) > 0 {
		if b, err := json.Marshal(d.Cast); err == nil {
			castJSON = string(b)
		}
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: begin tx", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		INSERT INTO movies (user_id, title, director, release_year, tmdb_id, tvdb_id, media_type,
		                    poster_path, description, series, cast_json, source_metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		uid, d.Title, nullable(d.Director), nullableInt(d.ReleaseYear),
		nullableInt64(d.TMDBID), nullableInt64(d.TVDBID), d.MediaType,
		nullable(posterPath), nullable(d.Overview), nullable(d.Series), castJSON, string(d.Raw))
	if err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: insert", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 { // (user_id, tmdb_id/tvdb_id) collision
		s.removeCoverFile(posterPath)
		writeErr(w, http.StatusConflict, "title already in your library")
		return
	}
	id, _ := res.LastInsertId()
	if err := setGenres(tx, "movie", uid, id, d.Genres); err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: set genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: commit", err)
		return
	}
	log.Printf("[movies] added %q (%s) from %s#%s -> movie %d", d.Title, d.MediaType, source, sourceID, id)
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		internalError(w, r, "create movie: fetch", err)
		return
	}
	writeJSON(w, http.StatusCreated, m)
}

// similarMoviesForSource returns the user's same-name look-alikes for the given
// fetched details, excluding any row that already holds this exact supplier id
// (that's the identical entry — the unique index reports it as a plain 409, not
// a "which one did you mean" ambiguity).
func (s *Server) similarMoviesForSource(uid int64, d *metadata.MovieDetails) ([]movieDupHint, error) {
	all, err := findSimilarMovies(s.Store.DB, uid, d.Title, d.MediaType, 0)
	if err != nil {
		return nil, err
	}
	out := make([]movieDupHint, 0, len(all))
	for _, h := range all {
		if (d.TMDBID != 0 && h.TMDBID == d.TMDBID) || (d.TVDBID != 0 && h.TVDBID == d.TVDBID) {
			continue
		}
		out = append(out, h)
	}
	return out, nil
}

// fetchSourceDetails dispatches a details lookup to the right supplier+media
// type. On failure it returns (nil, message, httpStatus) ready to write.
func (s *Server) fetchSourceDetails(ctx context.Context, source, sourceID, mediaType string) (*metadata.MovieDetails, string, int) {
	show := mediaType == "show"
	switch source {
	case "tvdb":
		tvdb, _ := s.resolveTVDB()
		if tvdb == nil {
			return nil, tvdbKeyMissing, http.StatusServiceUnavailable
		}
		var d *metadata.MovieDetails
		var err error
		if show {
			d, err = tvdb.SeriesDetails(ctx, sourceID)
		} else {
			d, err = tvdb.MovieDetails(ctx, sourceID)
		}
		if err != nil {
			// Both callers (create + resync) only surface the message; log the cause here.
			olog.Errorf(olog.CodeMetaLookupFailed, "[movie] tvdb details source_id=%s show=%t failed: %v", sourceID, show, err)
			if errors.Is(err, metadata.ErrTVDBAuth) {
				return nil, "TheTVDB rejected the key — re-check it in Settings → Metadata sources", http.StatusBadGateway
			}
			return nil, "TheTVDB lookup failed", http.StatusBadGateway
		}
		return d, "", 0
	default: // "tmdb"
		tmdb, _ := s.resolveTMDB()
		if tmdb == nil {
			return nil, tmdbKeyMissing, http.StatusServiceUnavailable
		}
		id, _ := strconv.ParseInt(sourceID, 10, 64)
		var d *metadata.MovieDetails
		var err error
		if show {
			d, err = tmdb.DetailsTV(ctx, id)
		} else {
			d, err = tmdb.Details(ctx, id)
		}
		if err != nil {
			// Both callers (create + resync) only surface the message; log the cause here.
			olog.Errorf(olog.CodeMetaLookupFailed, "[movie] tmdb details source_id=%s show=%t failed: %v", sourceID, show, err)
			if errors.Is(err, metadata.ErrTMDBAuth) {
				return nil, "TMDB rejected the key — re-check it in Settings → Metadata sources", http.StatusBadGateway
			}
			return nil, "TMDB lookup failed", http.StatusBadGateway
		}
		return d, "", 0
	}
}

func (s *Server) handleListMovies(w http.ResponseWriter, r *http.Request) {
	type item struct {
		ID            int64    `json:"id"`
		Title         string   `json:"title"`
		Director      string   `json:"director"`
		ReleaseYear   int      `json:"release_year"`
		MediaType     string   `json:"media_type"`
		PosterPath    string   `json:"poster_path"`
		Genres        []string `json:"genres"`
		Series        string   `json:"series"`
		SeriesIndex   float64  `json:"series_index"`
		Favorite      bool     `json:"favorite"`
		DialogueCount int      `json:"dialogue_count"`
	}
	uid := userID(r)
	olog.Tracef("[movie] handleListMovies uid=%v", uid)
	rows, err := s.Store.DB.Query(`
		SELECT m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0),
		       m.media_type, COALESCE(m.poster_path, ''),
		       COALESCE(m.series, ''), COALESCE(m.series_index, 0), m.favorite,
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id)
		FROM movies m WHERE m.user_id = ?
		ORDER BY m.created_at DESC, m.id DESC`, uid)
	if err != nil {
		internalError(w, r, "list movies: query", err)
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Director, &it.ReleaseYear,
			&it.MediaType, &it.PosterPath, &it.Series, &it.SeriesIndex,
			&it.Favorite, &it.DialogueCount); err != nil {
			olog.Warnf(olog.CodeMovieRowScan, "[movie] movie list row scan failed: %v", err)
			continue
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMovieRowScan, "[movie] movie list row iteration failed: %v", err)
	}
	byMovie, err := s.genreNames(uid, "movie")
	if err != nil {
		internalError(w, r, "list movies: genre names", err)
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
	olog.Tracef("[movie] handleGetMovie uid=%v id=%v", userID(r), id)
	m, err := s.fetchMovie(userID(r), id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
	case err != nil:
		internalError(w, r, "get movie: fetch", err)
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
	olog.Tracef("[movie] handleUpdateMovie uid=%v id=%v source=%q source_id=%q", userID(r), id, req.Source, req.SourceID)
	// A source+source_id (or legacy tmdb_id) re-syncs everything (poster, cast,
	// genres, details) from that supplier — the "look up" action in the edit view.
	if req.Source != "" && req.SourceID != "" {
		s.resyncMovieFromSource(w, r, id, req.Source, req.SourceID, req.MediaType)
		return
	}
	if req.TMDBID != 0 {
		s.resyncMovieFromSource(w, r, id, "tmdb", strconv.FormatInt(req.TMDBID, 10), "movie")
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
			internalError(w, r, "update movie: load poster", err)
		}
		return
	}
	changePoster, newPoster := false, ""
	if req.ClearCover {
		changePoster = true
	} else if req.PosterURL != "" {
		name, ferr := s.fetchUserImage(r.Context(), req.PosterURL, s.coversDir())
		if ferr != nil {
			olog.Errorf(olog.CodeMovieCoverUpdate, "[movie] update id=%d poster fetch failed: %v", id, ferr)
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
	// failErr is fail for the 500 path: it logs the real cause instead of swallowing it.
	failErr := func(context string, err error) {
		s.removeCoverFile(newPoster)
		internalError(w, r, context, err)
	}

	tx, err := s.Store.DB.Begin()
	if err != nil {
		failErr("update movie: begin tx", err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec(`
		UPDATE movies SET title = ?, director = ?, release_year = ?, description = ?,
		                  media_type = ?, series = ?, series_index = ?, favorite = ?
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Director), nullableInt(req.ReleaseYear),
		nullable(req.Description), req.MediaType, nullable(req.Series),
		nullableFloat(req.SeriesIndex), req.Favorite, id, uid)
	if err != nil {
		failErr("update movie: exec", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "movie not found")
		return
	}
	if changePoster {
		if _, err := tx.Exec(`UPDATE movies SET poster_path = ? WHERE id = ? AND user_id = ?`,
			nullable(newPoster), id, uid); err != nil {
			failErr("update movie: set poster", err)
			return
		}
	}
	if err := setGenres(tx, "movie", uid, id, req.Genres); err != nil {
		failErr("update movie: set genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		failErr("update movie: commit", err)
		return
	}
	if changePoster && oldPoster.String != newPoster {
		s.removeCoverFile(oldPoster.String)
	}
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		internalError(w, r, "update movie: fetch", err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}

// resyncMovieFromSource re-pulls details+credits from a supplier and overwrites
// title/director/year/description/cast/genres/series/poster + the source ids and
// media_type. User-owned fields (favorite, series_index) are deliberately
// left untouched. Used by the edit view's "look up" picker.
func (s *Server) resyncMovieFromSource(w http.ResponseWriter, r *http.Request, id int64, source, sourceID, mediaType string) {
	d, msg, code := s.fetchSourceDetails(r.Context(), source, sourceID, mediaType)
	if d == nil {
		writeErr(w, code, msg)
		return
	}
	uid := userID(r)
	var oldPoster sql.NullString
	if err := s.Store.DB.QueryRow(
		`SELECT poster_path FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&oldPoster); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeErr(w, http.StatusNotFound, "movie not found")
		} else {
			internalError(w, r, "resync movie: load poster", err)
		}
		return
	}
	// Reject re-syncing to a tmdb_id/tvdb_id another of the user's titles holds.
	var clash bool
	var clashErr error
	if d.TVDBID != 0 {
		clashErr = s.Store.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM movies WHERE user_id = ? AND id <> ? AND tvdb_id = ?)`,
			uid, id, d.TVDBID).Scan(&clash)
	} else {
		clashErr = s.Store.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM movies WHERE user_id = ? AND id <> ? AND tmdb_id = ?)`,
			uid, id, d.TMDBID).Scan(&clash)
	}
	if clashErr != nil {
		internalError(w, r, "resync movie: check id clash", clashErr)
		return
	}
	if clash {
		writeErr(w, http.StatusConflict, "another title in your library is already that entry")
		return
	}
	var newPoster string
	if d.PosterURL != "" {
		if name, err := s.fetchImage(r.Context(), d.PosterURL, s.coversDir()); err == nil {
			newPoster = name
		} else {
			olog.Warnf(olog.CodeMovieCover, "[movie] poster fetch failed: %v", err)
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
	// failErr is fail for the 500 path: it logs the real cause instead of swallowing it.
	failErr := func(context string, err error) {
		s.removeCoverFile(newPoster)
		internalError(w, r, context, err)
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		failErr("resync movie: begin tx", err)
		return
	}
	defer tx.Rollback()
	// Keep the existing poster if the source had none this time.
	poster := oldPoster.String
	if newPoster != "" {
		poster = newPoster
	}
	res, err := tx.Exec(`
		UPDATE movies SET title = ?, director = ?, release_year = ?, tmdb_id = ?, tvdb_id = ?,
		                  media_type = ?, poster_path = ?, description = ?, series = ?,
		                  cast_json = ?, source_metadata = ?
		WHERE id = ? AND user_id = ?`,
		d.Title, nullable(d.Director), nullableInt(d.ReleaseYear),
		nullableInt64(d.TMDBID), nullableInt64(d.TVDBID), d.MediaType,
		nullable(poster), nullable(d.Overview), nullable(d.Series), castJSON, string(d.Raw), id, uid)
	if err != nil {
		failErr("resync movie: exec", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "movie not found")
		return
	}
	if err := setGenres(tx, "movie", uid, id, d.Genres); err != nil {
		failErr("resync movie: set genres", err)
		return
	}
	// Correcting the movie's cast flows through to dialogues imported before it
	// existed: backfill any empty actor whose character now matches the new cast.
	filled, err := refillMovieActors(tx, id)
	if err != nil {
		log.Printf("[movies] resync %d: refill actors: %v", id, err)
		failErr("resync movie: refill actors", err)
		return
	}
	if err := tx.Commit(); err != nil {
		failErr("resync movie: commit", err)
		return
	}
	if newPoster != "" && oldPoster.String != newPoster {
		s.removeCoverFile(oldPoster.String)
	}
	log.Printf("[movies] resynced movie %d from %s#%s (%q, %s); backfilled %d actor(s)",
		id, source, sourceID, d.Title, d.MediaType, filled)
	m, err := s.fetchMovie(uid, id)
	if err != nil {
		internalError(w, r, "resync movie: fetch", err)
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
	olog.Tracef("[movie] handleDeleteMovie uid=%v id=%v", uid, id)
	var poster sql.NullString
	err := s.Store.DB.QueryRow(
		`SELECT poster_path FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&poster)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeErr(w, http.StatusNotFound, "movie not found")
		return
	case err != nil:
		internalError(w, r, "delete movie: load poster", err)
		return
	}
	tx, err := s.Store.DB.Begin()
	if err != nil {
		internalError(w, r, "delete movie: begin tx", err)
		return
	}
	defer tx.Rollback()
	// Dialogues cascade with the movie; GC the genres it held (tags persist, §10).
	if _, err := tx.Exec(`DELETE FROM movies WHERE id = ? AND user_id = ?`, id, uid); err != nil {
		internalError(w, r, "delete movie: delete row", err)
		return
	}
	if err := gcGenres(tx, uid); err != nil {
		internalError(w, r, "delete movie: gc genres", err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, r, "delete movie: commit", err)
		return
	}
	s.removeCoverFile(poster.String) // best-effort
	s.gcOrphanPeople(uid, "actor") // cascaded-deleted dialogues can orphan actors
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
