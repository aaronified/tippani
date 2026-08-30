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
	"tippani/internal/store"
)

// tmdbKeyMissing: manual movie entry still works without a key (PLAN §6).
const tmdbKeyMissing = "TMDB API key not configured (add one in Settings)"
const tvdbKeyMissing = "TheTVDB API key not configured (set TIPPANI_TVDB_API_KEY or save a key in Settings)"

// movieKeysMissing is for the case where NEITHER film/show supplier is
// configured, and it names TheTVDB first because that is the default source
// since 2.2.0. The two above answer "the supplier you asked for has no key"; this
// one answers "you have asked for a lookup and there is nothing to look in", so
// it has to say where to start rather than which of two named suppliers failed.
const movieKeysMissing = "No film/show source is configured — add a TheTVDB key (the default) or a TMDB key in Settings → Metadata sources"

// igdbKeyMissing names BOTH halves, because the commonest failure is having
// saved one of them: a client id with no secret is indistinguishable from no key
// at all, and "IGDB key not configured" would send you looking at the field you
// already filled in.
const igdbKeyMissing = "IGDB needs a Twitch client id AND secret (add both in Settings)"

type movieReq struct {
	// TMDBID/TVDBID are the supplier ids, and they are POINTERS on purpose:
	// nil means "field omitted, leave the column alone" and 0 means "clear it".
	// PUT is full-state everywhere else, but a supplier id is not a field you
	// retype every save — it is what a re-sync pulls from, so an old client that
	// has never heard of it must not be able to wipe it by omission.
	TMDBID *int64 `json:"tmdb_id"`
	TVDBID *int64 `json:"tvdb_id"`
	IGDBID *int64 `json:"igdb_id"` // games (0040); same pointer contract as the two above
	// IMDbID is full-state like the ordinary fields rather than a pointer like
	// the two above, and the difference is what each id is FOR. Those two are
	// what a re-sync pulls from, so an old client omitting one must not wipe it;
	// nothing ever fetches with this one, so there is no such thing to protect —
	// it is a field the reader typed, and it behaves like every other.
	IMDbID   string `json:"imdb_id"`
	Source   string `json:"source"`    // "tmdb" | "tvdb": with SourceID, create/resync from that supplier
	SourceID string `json:"source_id"` // id within the source
	Title    string `json:"title"`
	Director string `json:"director"` // "creator" for shows; one column, labelled per media_type in the UI
	// Publisher is the OTHER company credit a game has (0042). Its own field
	// rather than a second meaning for Director, because collapsing the two is
	// the bug that migration exists to end.
	Publisher    string   `json:"publisher"`
	ReleaseYear  int      `json:"release_year"`
	ReleaseCirca bool     `json:"release_circa"`
	Description  string   `json:"description"`
	Genres       []string `json:"genres"`
	MediaType    string   `json:"media_type"` // "movie" (default) | "show"
	Series       string   `json:"series"`
	SeriesIndex  float64  `json:"series_index"`
	Favorite     bool     `json:"favorite"`
	PosterURL    string   `json:"poster_url"`  // update: set/replace the poster
	ClearCover   bool     `json:"clear_cover"` // update: drop the current poster
	ConfirmNew   bool     `json:"confirm_new"` // create-from-source: add a separate title despite a same-name look-alike
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
		return "release_year must be between 4000 BCE and 3000 CE"
	}
	if msg := normalizeMediaType(&m.MediaType); msg != "" {
		return msg
	}
	if idOrZero(m.TMDBID) < 0 {
		return "tmdb_id must be a positive number"
	}
	if idOrZero(m.TVDBID) < 0 {
		return "tvdb_id must be a positive number"
	}
	if idOrZero(m.IGDBID) < 0 {
		return "igdb_id must be a positive number"
	}
	return ""
}

// idOrZero reads an optional supplier id: an omitted field and an explicit 0
// both mean "no id", which is what the columns store as NULL either way.
func idOrZero(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// normaliseIMDb accepts what a reader actually has in their hand.
//
// An IMDb id is reached by copying a URL, so a pasted
// https://www.imdb.com/title/tt0111161/ is the common case rather than the
// exotic one — taking the id out of it is a line of code, and refusing it is a
// message telling somebody to do that line of code by hand. A bare number is
// accepted too and given its tt, because the digits are what a person reads off
// the page. Anything else is stored as typed rather than rejected: this id
// fetches nothing, so a wrong one costs a dead link and no data.
func normaliseIMDb(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	if i := strings.Index(v, "/title/"); i >= 0 {
		v = v[i+len("/title/"):]
	}
	if i := strings.IndexAny(v, "/?#"); i >= 0 {
		v = v[:i]
	}
	v = strings.TrimSpace(v)
	// A bare number: tt0111161 is the id, 111161 is what somebody read aloud.
	if v != "" && strings.IndexFunc(v, func(r rune) bool { return r < '0' || r > '9' }) < 0 {
		for len(v) < 7 {
			v = "0" + v
		}
		return "tt" + v
	}
	return v
}

// imdbOrKeep is the re-sync rule: a supplier is the authority on what it KNOWS,
// never on what it does not. TMDB returning no IMDb id means it has none on file,
// which is not a reason to erase one the reader typed in by hand.
func imdbOrKeep(tx *sql.Tx, uid, id int64, found string) string {
	if found != "" {
		return found
	}
	var cur string
	_ = tx.QueryRow(`SELECT COALESCE(imdb_id, '') FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&cur)
	return cur
}

// supplierIDOrKeep is imdbOrKeep's argument applied to the OTHER suppliers'
// numeric ids, and it is what makes mixing sources survive a re-fetch.
//
// A re-sync pulls one record from ONE supplier and writes the row from it. TMDB's
// details carry no TheTVDB id and TheTVDB's carry no TMDB id, so writing every id
// column from the payload meant a re-sync from either one ERASED the other's —
// silently, on a button whose promise is "this record is stale, fetch it again".
//
// That is not a cosmetic loss. `POST /movies/{id}/cast/tvdb` is the only route to
// a character in costume and it needs `movies.tvdb_id` on the row; it refuses to
// search for one, deliberately, because a search is where the wrong cast gets
// attached to the right work. So a reader keeping TMDB's metadata and TheTVDB's
// character art lost the art the next time they re-fetched the metadata, and the
// two facts are far enough apart that nothing would have connected them.
//
// The rule is the one already written for imdb_id one function up, and it belongs
// to all four: a supplier is the authority on what it knows, not on what it does
// not.
func supplierIDOrKeep(tx *sql.Tx, uid, id int64, col string, found int64) any {
	if found > 0 {
		return found
	}
	// `col` is never caller-supplied — the three call sites pass a literal — so
	// the interpolation is a constant, and the alternative is three copies of this
	// function that differ by one word.
	var cur int64
	_ = tx.QueryRow(`SELECT COALESCE(`+col+`, 0) FROM movies WHERE id = ? AND user_id = ?`, id, uid).Scan(&cur)
	return nullableInt64(cur)
}

// normalizeMediaType defaults an empty media_type to "movie" and rejects
// anything outside the {movie, show, game} vocabulary (validated in app code —
// the column has no CHECK, matching the 0004 convention, which is what let 0040
// add games with two lines of DDL and no constraint change).
func normalizeMediaType(mt *string) string {
	switch *mt {
	case "", "movie":
		*mt = "movie"
	case "show", "game":
	default:
		return "media_type must be 'movie', 'show' or 'game'"
	}
	return ""
}

// movieDetail is the single-movie response shape (POST/GET/PUT /movies).
//
// status / progress / reads are read-only here, as on bookDetail: they belong to
// PUT /movies/:id/status, the only path that keeps the status and the watch log
// consistent with one another.
type movieDetail struct {
	// WHERE EACH FIELD CAME FROM (0054), omitempty because most works have no
	// provenance and never will: nothing is backfilled, so a library that predates
	// the table stays silent until something next writes to it. An absent list and
	// an empty one mean the same thing here — "nothing recorded" — which is why the
	// zero value is allowed to disappear rather than being sent as [].
	FieldSources []store.FieldSource   `json:"field_sources,omitempty"`
	ID           int64                 `json:"id"`
	Title        string                `json:"title"`
	Director     string                `json:"director"`
	Publisher    string                `json:"publisher"`
	ReleaseYear  int                   `json:"release_year"`
	ReleaseCirca bool                  `json:"release_circa"`
	TMDBID       int64                 `json:"tmdb_id"`
	TVDBID       int64                 `json:"tvdb_id"`
	IGDBID       int64                 `json:"igdb_id"`
	IMDbID       string                `json:"imdb_id"`
	MediaType    string                `json:"media_type"`
	PosterPath   string                `json:"poster_path"`
	Description  string                `json:"description"`
	Genres       []string              `json:"genres"`
	Series       string                `json:"series"`
	SeriesIndex  float64               `json:"series_index"`
	Favorite     bool                  `json:"favorite"`
	Status       string                `json:"status"`   // "" | watching | paused | abandoned | completed
	Progress     int                   `json:"progress"` // 0-100, derived from the position when one is set
	position                           // pos_unit ('' | episode) · pos · pos_total · season · season_total
	Reads        []readRow             `json:"reads"` // oldest first
	Cast         []metadata.CastMember `json:"cast"`
	CreatedAt    string                `json:"created_at"`
}

func (s *Server) fetchMovie(uid, id int64) (*movieDetail, error) {
	var m movieDetail
	err := s.Store.DB.QueryRow(`
		SELECT id, title, COALESCE(director, ''), COALESCE(release_year, 0), release_circa, COALESCE(tmdb_id, 0),
		       COALESCE(tvdb_id, 0), COALESCE(igdb_id, 0), media_type, COALESCE(poster_path, ''), COALESCE(description, ''),
		       COALESCE(series, ''), COALESCE(series_index, 0), favorite, status, progress,
		       pos_unit, pos, pos_total, season, season_total, created_at,
		       COALESCE(imdb_id, ''), publisher
		FROM movies WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&m.ID, &m.Title, &m.Director, &m.ReleaseYear, &m.ReleaseCirca, &m.TMDBID,
			&m.TVDBID, &m.IGDBID, &m.MediaType, &m.PosterPath, &m.Description,
			&m.Series, &m.SeriesIndex, &m.Favorite, &m.Status, &m.Progress,
			&m.Unit, &m.Pos, &m.PosTotal, &m.Season, &m.SeasonTotal,
			&m.CreatedAt, &m.IMDbID, &m.Publisher)
	if err != nil {
		return nil, err
	}
	if m.Reads, err = loadReads(s.Store.DB, uid, "movie", id); err != nil {
		return nil, err
	}
	// THE CAST IS READ FROM work_cast AND NOT FROM cast_json, and the wire shape is
	// byte-identical on purpose (loadCastMembers). That equality is what lets this
	// whole feature land with no frontend change: the film page, the quote form's
	// character typeahead and the metadata console all go on reading `cast[]`
	// exactly as they did, and now see the rows the reader added or corrected.
	//
	// The blob is still WRITTEN — whole by the two paths that replace a title's
	// whole record, and only where it is empty by applyReverifyMovie, which is also
	// the unattended bulk fill's writer and must not spend the one pre-0048 copy
	// there is. Kept for one release because dropping a column is the one migration
	// step nobody can walk back by hand (0036/0037's precedent, argued at length in
	// 0048's header).
	//
	// NOTHING READS IT ANY MORE, which is the condition for dropping the column and
	// is recorded here because this comment used to be the inventory of what still
	// did. The last two readers have both moved to this table: the actor→portrait
	// resolver (actorPortraitFromCast) and the quiz's speaker distractors
	// (quizPools, review_handlers.go). The second moved as soon as the blob was
	// frozen against the unattended bulk fill, because a frozen column with a reader
	// on it is a pool that goes stale the first time a cast diff is approved and
	// never recovers — and because the blob is '[]' for nearly every game, so a
	// typed voice cast could never be a distractor at all.
	if m.Cast, err = loadCastMembers(s.Store.DB, "movie", id); err != nil {
		return nil, err
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
	// BEST-EFFORT, like the genre and cast reads beside it. Provenance is a note
	// on a page, and failing the whole detail response because the note could not
	// be read would take the page with it.
	if fs, ferr := s.Store.FieldSourcesFor(uid, "movie", id); ferr != nil {
		olog.Warnf(olog.CodeMetaLookupFailed, "[movie] field sources for %d: %v", id, ferr)
	} else {
		m.FieldSources = fs
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
	olog.Tracef("[movie] handleCreateMovie uid=%v source=%q source_id=%q tmdb_id=%v", userID(r), req.Source, req.SourceID, idOrZero(req.TMDBID))
	if req.Source != "" && req.SourceID != "" {
		s.createMovieFromSource(w, r, req.Source, req.SourceID, req.MediaType, req.ConfirmNew)
		return
	}
	if id := idOrZero(req.TMDBID); id != 0 { // legacy clients / tests: tmdb_id implies a TMDB movie
		s.createMovieFromSource(w, r, "tmdb", strconv.FormatInt(id, 10), "movie", req.ConfirmNew)
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
	// Allocated rather than left to SQLite, so a binned movie's id stays reserved
	// for as long as its bin entry holds it (id_floor.go).
	id, err := nextID(tx, "movies")
	if err != nil {
		internalError(w, r, "create movie: reserve id", err)
		return
	}
	if _, err := tx.Exec(`
		INSERT INTO movies (id, updated_at, user_id, title, director, release_year, release_circa, description,
		                    media_type, series, series_index, favorite, imdb_id, publisher)
		VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, uid, req.Title, nullable(req.Director), nullableInt(req.ReleaseYear), req.ReleaseCirca,
		nullable(req.Description), req.MediaType, nullable(req.Series),
		nullableFloat(req.SeriesIndex), req.Favorite, normaliseIMDb(req.IMDbID), req.Publisher); err != nil {
		internalError(w, r, "create movie: insert", err)
		return
	}
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
	id, err := nextID(tx, "movies")
	if err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: reserve id", err)
		return
	}
	res, err := tx.Exec(`
		INSERT INTO movies (id, updated_at, user_id, title, director, release_year, tmdb_id, tvdb_id, igdb_id,
		                    media_type, poster_path, description, series, cast_json, source_metadata, imdb_id, publisher)
		VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
		id, uid, d.Title, nullable(d.Director), nullableInt(d.ReleaseYear),
		nullableInt64(d.TMDBID), nullableInt64(d.TVDBID), nullableInt64(d.IGDBID), d.MediaType,
		nullable(posterPath), nullable(d.Overview), nullable(d.Series), castJSON, string(d.Raw), d.IMDbID,
		d.Publisher)
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
	if err := setGenres(tx, "movie", uid, id, d.Genres); err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: set genres", err)
		return
	}
	// SEED THE CAST MAPPING (0048), inside this transaction rather than beside it.
	// On a brand-new row every entry is an insert and there is nothing to protect,
	// but it goes through the same merge as a refetch so there is exactly one
	// implementation of the rule — and a title added twice after a look-alike
	// confirmation still cannot end up with two copies of one credit.
	if err := mergeProviderCast(tx, uid, "movie", id, castSourceForFetch(d.Source), d.Cast); err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: seed cast", err)
		return
	}
	// WHERE EACH FIELD CAME FROM (0054), in this transaction rather than beside
	// it: provenance that outlived a rolled-back insert would describe a row that
	// does not exist.
	if err := store.RecordFieldSources(tx, uid, "movie", id, d.Source, d.SourceID,
		movieFieldsFrom(d, posterPath)); err != nil {
		s.removeCoverFile(posterPath)
		internalError(w, r, "create movie: record field sources", err)
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

// movieIDClash reports whether another of this user's titles already holds the
// given supplier id. Both id columns carry a partial unique index, so without
// this check the write comes back as an opaque constraint error (a 500) instead
// of a 409 that says which entry is in the way. A zero id is no id, and never
// clashes — the index is partial for exactly that reason.
//
// column is one of two literals from this file, never anything off the wire.
func (s *Server) movieIDClash(uid, id int64, column string, value int64) (bool, error) {
	if value == 0 {
		return false, nil
	}
	var clash bool
	err := s.Store.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM movies WHERE user_id = ? AND id <> ? AND `+column+` = ?)`,
		uid, id, value).Scan(&clash)
	return clash, err
}

// fetchSourceDetails dispatches a details lookup to the right supplier+media
// type. On failure it returns (nil, message, httpStatus) ready to write.
func (s *Server) fetchSourceDetails(ctx context.Context, source, sourceID, mediaType string) (*metadata.MovieDetails, string, int) {
	show := mediaType == "show"
	switch source {
	case "igdb":
		igdb, _ := s.resolveIGDB()
		if igdb == nil {
			return nil, igdbKeyMissing, http.StatusServiceUnavailable
		}
		d, err := igdb.Details(ctx, sourceID)
		if err != nil {
			olog.Errorf(olog.CodeMetaIGDBLookup, "[movie] igdb details source_id=%s failed: %v", sourceID, err)
			if errors.Is(err, metadata.ErrIGDBAuth) {
				return nil, "IGDB rejected the credentials — re-check BOTH the client id and the secret " +
					"in Settings → Metadata sources", http.StatusBadGateway
			}
			return nil, "IGDB lookup failed", http.StatusBadGateway
		}
		// THE CAST IS A SECOND SUPPLIER, and it has to be, because IGDB has no
		// person or credit endpoint at all. Wikidata is the only structured free
		// source of game voice credits, joined on the IGDB slug through P5794.
		//
		// Best-effort on purpose: most games have no cast there (measured — two of
		// the four games this feature was asked for have none), so a failure here
		// must not fail the whole fetch. The game is saved with an empty,
		// hand-editable cast and the reason goes to the log, which is the honest
		// answer rather than a lookup that reports success and shows nothing.
		if d.Slug != "" {
			cast, cerr := metadata.GameVoiceCast(ctx, d.Slug)
			switch {
			case errors.Is(cerr, metadata.ErrNoWikidataGame):
				olog.Warnf(olog.CodeMetaGameNoCast, "[movie] no wikidata item for igdb slug %q; cast left blank", d.Slug)
			case cerr != nil:
				olog.Warnf(olog.CodeMetaIGDBLookup, "[movie] wikidata cast for %q failed: %v; cast left blank", d.Slug, cerr)
			default:
				d.Cast = cast
			}
		}
		return d, "", 0
	case "wikidata":
		// The fallback's own details fetch, reached only by picking a candidate
		// the fallback produced — the picker tags every row with its source, so
		// this is the reader having chosen the thinner record knowingly.
		//
		// It needs no key, which is the entire point: this path is what a game
		// lookup does when IGDB is unconfigured or refusing, and asking for a
		// credential here would put the wall back one screen further on.
		d, err := metadata.GameDetailsWikidata(ctx, sourceID)
		if err != nil {
			olog.Errorf(olog.CodeMetaIGDBLookup, "[movie] wikidata game details qid=%s failed: %v", sourceID, err)
			return nil, "that Wikidata record could not be read", http.StatusBadGateway
		}
		return d, "", 0
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
		ID           int64    `json:"id"`
		Title        string   `json:"title"`
		Director     string   `json:"director"`
		ReleaseYear  int      `json:"release_year"`
		ReleaseCirca bool     `json:"release_circa"`
		MediaType    string   `json:"media_type"`
		PosterPath   string   `json:"poster_path"`
		Genres       []string `json:"genres"`
		Series       string   `json:"series"`
		SeriesIndex  float64  `json:"series_index"`
		Favorite     bool     `json:"favorite"`
		Status       string   `json:"status"`     // "" | watching | paused | abandoned | completed
		Progress     int      `json:"progress"`   // 0-100; fills the status bar under the poster
		ReadCount    int      `json:"read_count"` // finished watches, for the "×2" chip
		// The most recent date this was watched, for the "Last watched" sort.
		LastReadAt    string `json:"last_read_at"`
		DialogueCount int    `json:"dialogue_count"`
		// Mirrors the books list: "tagged" means the title has at least one
		// tagged dialogue, "noted" at least one carrying a note. "Wishlist" is
		// likewise derived from dialogue_count == 0 and so needs no field.
		TaggedCount int `json:"tagged_count"`
		NotedCount  int `json:"noted_count"`
		// 0033. Whether the quiz draws on this work's quotes at all. On the WORK
		// rather than only on its quotes, so a highlight added tomorrow inherits it.
		ReviewExcluded bool `json:"review_excluded"`
		// WHO IS QUOTED IN IT, from the lines saved off it — not from the cast.
		//
		// The board filters by actor with this, and where it comes from IS the
		// feature. `movies.cast_json` holds the whole TMDB cast and would have
		// been the obvious source; it answers a different question. A cast entry
		// says the actor was in the film. This says you kept something they said,
		// which is what a library is about and — decisively — is the same
		// question `actor:` asks in search, where the predicate reads `d.actor`
		// (searchFacets.where). Filtering a board by one meaning and seeding a
		// search with the other is a filter that changes what it means on the way
		// to the search box, silently, in the direction of MORE results.
		//
		// Verbatim, unsplit: a line can credit several actors as one string, and
		// splitting is the client's job (splitCredits), which already has the
		// reader's own separator preferences. Splitting here would fix them into
		// the API.
		Actors []string `json:"actors"`
	}
	uid := userID(r)
	olog.Tracef("[movie] handleListMovies uid=%v", uid)
	q := `
		SELECT m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0), m.release_circa,
		       m.media_type, COALESCE(m.poster_path, ''),
		       COALESCE(m.series, ''), COALESCE(m.series_index, 0), m.favorite, m.status, m.progress,
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id),
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id
		          AND EXISTS (SELECT 1 FROM dialogue_tags dt WHERE dt.dialogue_id = d.id)),
		       (SELECT count(*) FROM dialogues d WHERE d.movie_id = m.id
		          AND d.note IS NOT NULL AND TRIM(d.note) <> ''),
		       m.review_excluded
		FROM movies m WHERE m.user_id = ?
		ORDER BY m.created_at DESC, m.id DESC`
	args := []any{uid}
	if !applyPaging(w, r, &q, &args) {
		return
	}
	rows, err := s.Store.DB.Query(q, args...)
	if err != nil {
		internalError(w, r, "list movies: query", err)
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		it := item{Genres: []string{}}
		if err := rows.Scan(&it.ID, &it.Title, &it.Director, &it.ReleaseYear, &it.ReleaseCirca,
			&it.MediaType, &it.PosterPath, &it.Series, &it.SeriesIndex,
			&it.Favorite, &it.Status, &it.Progress, &it.DialogueCount, &it.TaggedCount, &it.NotedCount,
			&it.ReviewExcluded); err != nil {
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
	reads, err := s.readCounts(uid, "movie")
	if err != nil {
		internalError(w, r, "list movies: read counts", err)
		return
	}
	lastRead, err := s.lastReadAt(uid, "movie")
	if err != nil {
		internalError(w, r, "list movies: last watched", err)
		return
	}
	actors, err := s.movieActors(uid)
	if err != nil {
		internalError(w, r, "list movies: actors", err)
		return
	}
	for i := range items {
		if gs := byMovie[items[i].ID]; gs != nil {
			items[i].Genres = gs
		}
		items[i].ReadCount = reads[items[i].ID]
		items[i].LastReadAt = lastRead[items[i].ID]
		items[i].Actors = actors[items[i].ID]
		if items[i].Actors == nil {
			// [] and not null: the client maps over it, and a board where the
			// filter works on films with quoted lines and throws on the ones
			// without is the shape of bug this repo keeps finding.
			items[i].Actors = []string{}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"movies": items})
}

// movieActors is movieID → the distinct actor strings its saved lines credit.
//
// One query for the whole list, like genreNames beside it, rather than a
// correlated subquery per row: the three counts above can be scalars and this
// cannot, and forty films each running a GROUP_CONCAT is the shape that makes a
// board slow for a reason nobody can see in the JSON.
//
// DISTINCT on the raw string, so a film whose forty lines all credit the same
// actor contributes one entry. Sorted by name so the board's dropdown is stable
// between loads — a list that reorders itself as you save lines is a list you
// cannot learn the shape of.
func (s *Server) movieActors(uid int64) (map[int64][]string, error) {
	rows, err := s.Store.DB.Query(`
		SELECT DISTINCT d.movie_id, d.actor
		FROM dialogues d JOIN movies m ON m.id = d.movie_id
		WHERE m.user_id = ? AND d.actor IS NOT NULL AND TRIM(d.actor) <> ''
		ORDER BY d.actor`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]string{}
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			olog.Warnf(olog.CodeMovieRowScan, "[movie] actor row scan failed: %v", err)
			continue
		}
		out[id] = append(out[id], name)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMovieRowScan, "[movie] actor row iteration failed: %v", err)
	}
	return out, nil
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
	// A source+source_id re-syncs everything (poster, cast, genres, details) from
	// that supplier — the "look up" action in the edit view.
	if req.Source != "" && req.SourceID != "" {
		s.resyncMovieFromSource(w, r, id, req.Source, req.SourceID, req.MediaType)
		return
	}
	// tmdb_id carries two meanings, and the title tells them apart. A bare
	// {"tmdb_id": N} is the legacy re-sync verb from before source/source_id
	// existed; it cannot be an edit, because an edit is full-state and a
	// title-less one is refused two lines below. Anything WITH a title is an
	// ordinary save, where tmdb_id/tvdb_id are just two more editable columns —
	// which is how you correct an id the supplier search got wrong.
	if tid := idOrZero(req.TMDBID); tid != 0 && req.Title == "" {
		s.resyncMovieFromSource(w, r, id, "tmdb", strconv.FormatInt(tid, 10), "movie")
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
	// The two supplier-id columns paired with what the body asked of each. nil is
	// "not mentioned" and leaves the column exactly as it is — see movieReq.
	idCols := []struct {
		column string
		value  *int64
	}{{"tmdb_id", req.TMDBID}, {"tvdb_id", req.TVDBID}, {"igdb_id", req.IGDBID}}

	// A hand-typed id that another title already holds would fail as a unique
	// constraint mid-transaction; catch it first so the answer names the problem.
	for _, c := range idCols {
		if c.value == nil {
			continue
		}
		clash, err := s.movieIDClash(uid, id, c.column, *c.value)
		if err != nil {
			internalError(w, r, "update movie: check id clash", err)
			return
		}
		if clash {
			writeErr(w, http.StatusConflict, "another title in your library already has that id")
			return
		}
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
		UPDATE movies SET title = ?, director = ?, release_year = ?, release_circa = ?, description = ?,
		                  media_type = ?, series = ?, series_index = ?, favorite = ?, imdb_id = ?,
		                  publisher = ?, updated_at = datetime('now')
		WHERE id = ? AND user_id = ?`,
		req.Title, nullable(req.Director), nullableInt(req.ReleaseYear), req.ReleaseCirca,
		nullable(req.Description), req.MediaType, nullable(req.Series),
		nullableFloat(req.SeriesIndex), req.Favorite, normaliseIMDb(req.IMDbID), req.Publisher, id, uid)
	if err != nil {
		failErr("update movie: exec", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fail(http.StatusNotFound, "movie not found")
		return
	}
	if changePoster {
		if _, err := tx.Exec(`UPDATE movies SET poster_path = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
			nullable(newPoster), id, uid); err != nil {
			failErr("update movie: set poster", err)
			return
		}
	}
	// The supplier ids write on their own rather than joining the SET above,
	// because they are the only columns here a body is allowed to stay silent
	// about. Correcting one changes nothing else: the cached cast and payload
	// still describe the old record until a re-sync goes and gets the new one.
	for _, c := range idCols {
		if c.value == nil {
			continue
		}
		if _, err := tx.Exec(`UPDATE movies SET `+c.column+` = ?, updated_at = datetime('now')
			WHERE id = ? AND user_id = ?`, nullableInt64(*c.value), id, uid); err != nil {
			failErr("update movie: set "+c.column, err)
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
// media_type. User-owned fields (favorite, watching, series_index) are
// deliberately left untouched. Used by the edit view's "look up" picker.
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
	// A details record only ever carries the id of the supplier it came from, so
	// checking both columns checks exactly the one that is set.
	for _, c := range []struct {
		column string
		value  int64
	}{{"tmdb_id", d.TMDBID}, {"tvdb_id", d.TVDBID}} {
		clash, err := s.movieIDClash(uid, id, c.column, c.value)
		if err != nil {
			internalError(w, r, "resync movie: check id clash", err)
			return
		}
		if clash {
			writeErr(w, http.StatusConflict, "another title in your library is already that entry")
			return
		}
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
		UPDATE movies SET title = ?, director = ?, release_year = ?, tmdb_id = ?, tvdb_id = ?, igdb_id = ?,
		                  media_type = ?, poster_path = ?, description = ?, series = ?,
		                  cast_json = ?, source_metadata = ?, imdb_id = ?, publisher = ?,
		                  updated_at = datetime('now')
		WHERE id = ? AND user_id = ?`,
		d.Title, nullable(d.Director), nullableInt(d.ReleaseYear),
		// Each id kept when this supplier did not supply it — see supplierIDOrKeep.
		// Without this a re-sync from TMDB erased the TheTVDB id the character art
		// depends on, and the other way round.
		supplierIDOrKeep(tx, uid, id, "tmdb_id", d.TMDBID),
		supplierIDOrKeep(tx, uid, id, "tvdb_id", d.TVDBID),
		supplierIDOrKeep(tx, uid, id, "igdb_id", d.IGDBID), d.MediaType,
		nullable(poster), nullable(d.Overview), nullable(d.Series), castJSON, string(d.Raw),
		// A re-sync that found no id must not ERASE one the reader typed: the
		// supplier is the authority on what it knows, not on what it does not.
		imdbOrKeep(tx, uid, id, d.IMDbID),
		// THE PUBLISHER IS OVERWRITTEN, not kept the way imdb_id is, and that is
		// what makes a re-fetch the remedy 0042 promises. Every game stored before
		// that migration has its developer-or-publisher muddle in `director` and an
		// empty publisher, and the only thing that can tell the two apart is the
		// source. Keeping a blank would leave the row exactly as wrong as it was.
		d.Publisher, id, uid)
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
	// THE MERGE RULE RUNS HERE, and this is the call the whole feature is built
	// around: a re-sync may add credits the provider has started listing and may
	// rewrite the ones nobody has touched, and it must not change or remove a row
	// the reader has corrected, typed or deleted. The blob two statements above was
	// replaced whole, which is exactly the behaviour being retired — it is still
	// written only because dropping the column has to wait a release.
	//
	// Inside the transaction, because unlike the blob this is a read followed by a
	// write against what it read.
	// newPoster and NOT `poster`: the latter may be the file kept from an earlier
	// fetch because this supplier had none, and recording that as theirs would
	// credit them with a picture they did not provide.
	if err := store.RecordFieldSources(tx, uid, "movie", id, d.Source, d.SourceID,
		movieFieldsFrom(d, newPoster)); err != nil {
		failErr("resync movie: record field sources", err)
		return
	}
	if err := mergeProviderCast(tx, uid, "movie", id, castSourceForFetch(d.Source), d.Cast); err != nil {
		failErr("resync movie: merge cast", err)
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

// handleDeleteMovie bins the title with its lines, their tags, their review rows,
// its genres and its watch log, then deletes it (see trash.go). The poster is
// parked, not removed.
func (s *Server) handleDeleteMovie(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	s.binDelete(w, r, "movie", "movie not found",
		func(tx *sql.Tx) error { return gcGenres(tx, uid) },
		func() { s.gcOrphanPeople(uid, "actor") }) // cascaded-deleted lines can orphan actors
}

// movieFieldsFrom names the fields a fetched record actually filled, for the
// provenance table. Only fields the payload HAS: a supplier that returned no
// director did not write one, and recording it as theirs would attribute an
// empty column to whoever was asked last.
func movieFieldsFrom(d *metadata.MovieDetails, posterPath string) []string {
	f := []string{"title"}
	add := func(cond bool, name string) {
		if cond {
			f = append(f, name)
		}
	}
	add(strings.TrimSpace(d.Director) != "", "director")
	add(strings.TrimSpace(d.Overview) != "", "description")
	add(d.ReleaseYear != 0, "release_year")
	add(strings.TrimSpace(d.Series) != "", "series")
	add(strings.TrimSpace(d.Publisher) != "", "publisher")
	add(len(d.Genres) > 0, "genres")
	add(strings.TrimSpace(posterPath) != "", "poster")
	return f
}
