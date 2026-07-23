package httpapi

import (
	"database/sql"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/search"
)

type bookHit struct {
	ID            int64    `json:"id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	CoverPath     string   `json:"cover_path"`
	Genres        []string `json:"genres"` // array, matching GET /books (the UI maps over it)
	PublishedYear int      `json:"published_year"`
	Series        string   `json:"series"`
	SeriesIndex   float64  `json:"series_index"`
}

type annotationHit struct {
	ID            int64  `json:"id"`
	BookID        int64  `json:"book_id"`
	BookTitle     string `json:"book_title"`
	BookCoverPath string `json:"book_cover_path"` // group header art (§ search grouping)
	// Parent-book fields, so an annotation-only group (a book matched purely via
	// its annotations) can still be grouped by author/decade/series/genre.
	BookAuthor string   `json:"book_author"`
	BookYear   int      `json:"book_published_year"`
	BookSeries string   `json:"book_series"`
	BookGenres []string `json:"book_genres"`
	Quote      string   `json:"quote"`
	Note       string   `json:"note"`
}

type movieHit struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Director    string   `json:"director"`
	ReleaseYear int      `json:"release_year"`
	PosterPath  string   `json:"poster_path"`
	Genres      []string `json:"genres"`
	Series      string   `json:"series"`
	SeriesIndex float64  `json:"series_index"`
	MediaType   string   `json:"media_type"` // movie | show — so the UI tags films vs shows
}

type dialogueHit struct {
	ID              int64  `json:"id"`
	MovieID         int64  `json:"movie_id"`
	MovieTitle      string `json:"movie_title"`
	MoviePosterPath string `json:"movie_poster_path"` // group header art
	// Parent-movie fields, mirroring annotationHit — so a dialogue-only group
	// still groups by director/decade/series/genre.
	MovieDirector   string   `json:"movie_director"`
	MovieYear       int      `json:"movie_release_year"`
	MovieSeries     string   `json:"movie_series"`
	MovieGenres     []string `json:"movie_genres"`
	MovieMediaType  string   `json:"movie_media_type"` // movie | show
	Quote           string   `json:"quote"`
	Note            string   `json:"note"`
	Character       string   `json:"character"`
	Actor           string   `json:"actor"`
	Timestamp       string   `json:"timestamp"`
}

// ---- facet sections (§ sectioned search) ------------------------------------
// Results are sectioned by WHAT matched: a query that hits an author name lands
// in Authors (the name + their books), not as bare book rows; a note match
// lands in Notes, not Annotations. Every section is independent and the client
// renders only the non-empty ones.

type authorHits struct {
	Name  string    `json:"name"`
	Books []bookHit `json:"books"`
}

type directorHits struct {
	Name   string     `json:"name"`
	Movies []movieHit `json:"movies"`
}

type actorHits struct {
	Name      string        `json:"name"`
	Dialogues []dialogueHit `json:"dialogues"`
}

type noteHits struct {
	Annotations []annotationHit `json:"annotations"`
	Dialogues   []dialogueHit   `json:"dialogues"`
}

type tagHits struct {
	Name        string          `json:"name"`
	Count       int             `json:"count"` // total quotes wearing the tag (in scope)
	Annotations []annotationHit `json:"annotations"`
	Dialogues   []dialogueHit   `json:"dialogues"`
}

type genreHits struct {
	Name   string     `json:"name"`
	Books  []bookHit  `json:"books"`
	Movies []movieHit `json:"movies"`
}

type decadeHits struct {
	Label  string     `json:"label"` // e.g. "1990s"
	Books  []bookHit  `json:"books"`
	Movies []movieHit `json:"movies"`
}

type dateHits struct {
	Date        string          `json:"date"` // YYYY-MM-DD (UTC day, matching created_at)
	Books       []bookHit       `json:"books"`
	Movies      []movieHit      `json:"movies"`
	Annotations []annotationHit `json:"annotations"`
	Dialogues   []dialogueHit   `json:"dialogues"`
}

type searchResults struct {
	Books       []bookHit       `json:"books"`       // title / series matches
	Annotations []annotationHit `json:"annotations"` // quote matches
	Movies      []movieHit      `json:"movies"`      // title / series matches
	Dialogues   []dialogueHit   `json:"dialogues"`   // quote / character matches
	Authors     []authorHits    `json:"authors"`
	Directors   []directorHits  `json:"directors"`
	Actors      []actorHits     `json:"actors"`
	Notes       noteHits        `json:"notes"`
	Tags        []tagHits       `json:"tags"`
	Genres      []genreHits     `json:"genres"`
	Decade      *decadeHits     `json:"decade"`     // set only for a decade query ("1990s")
	DateAdded   *dateHits       `json:"date_added"` // set only for a date query ("2026-07-14")
	// Corrected is the typo-corrected query the results below actually came
	// from — set only when the exact pass found nothing and the fuzzy pass
	// (PLAN §4) then found rows visible to this user. Omitted otherwise.
	Corrected string `json:"corrected,omitempty"`
}

// Shared SELECT column lists so every facet returns the same hit shapes; the
// aliases (b/a/m/d) are fixed by the queries below.
const (
	bookHitCols = `b.id, b.title, COALESCE(b.author, ''), COALESCE(b.cover_path, ''),
		COALESCE(b.published_year, 0), COALESCE(b.series, ''), COALESCE(b.series_index, 0)`
	annotationHitCols = `a.id, a.book_id, b.title, COALESCE(b.cover_path, ''),
		COALESCE(a.quote, ''), COALESCE(a.note, ''),
		COALESCE(b.author, ''), COALESCE(b.published_year, 0), COALESCE(b.series, '')`
	movieHitCols = `m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0),
		COALESCE(m.poster_path, ''), COALESCE(m.series, ''), COALESCE(m.series_index, 0),
		COALESCE(m.media_type, 'movie')`
	dialogueHitCols = `d.id, d.movie_id, m.title, COALESCE(m.poster_path, ''), d.quote,
		COALESCE(d.note, ''), COALESCE(d.character, ''), COALESCE(d.actor, ''), COALESCE(d.timestamp, ''),
		COALESCE(m.director, ''), COALESCE(m.release_year, 0), COALESCE(m.series, ''),
		COALESCE(m.media_type, 'movie')`
)

func scanBookHit(rows *sql.Rows) (bookHit, error) {
	h := bookHit{Genres: []string{}}
	err := rows.Scan(&h.ID, &h.Title, &h.Author, &h.CoverPath, &h.PublishedYear, &h.Series, &h.SeriesIndex)
	return h, err
}

func scanAnnotationHit(rows *sql.Rows) (annotationHit, error) {
	h := annotationHit{BookGenres: []string{}}
	err := rows.Scan(&h.ID, &h.BookID, &h.BookTitle, &h.BookCoverPath, &h.Quote, &h.Note,
		&h.BookAuthor, &h.BookYear, &h.BookSeries)
	return h, err
}

func scanMovieHit(rows *sql.Rows) (movieHit, error) {
	h := movieHit{Genres: []string{}}
	err := rows.Scan(&h.ID, &h.Title, &h.Director, &h.ReleaseYear, &h.PosterPath, &h.Series, &h.SeriesIndex, &h.MediaType)
	return h, err
}

func scanDialogueHit(rows *sql.Rows) (dialogueHit, error) {
	h := dialogueHit{MovieGenres: []string{}}
	err := rows.Scan(&h.ID, &h.MovieID, &h.MovieTitle, &h.MoviePosterPath, &h.Quote, &h.Note,
		&h.Character, &h.Actor, &h.Timestamp, &h.MovieDirector, &h.MovieYear, &h.MovieSeries, &h.MovieMediaType)
	return h, err
}

// collectHits drains rows through scan, logging (never failing on) bad rows.
func collectHits[T any](rows *sql.Rows, what string, scan func(*sql.Rows) (T, error)) []T {
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		h, err := scan(rows)
		if err != nil {
			olog.Warnf(olog.CodeSearchRowScan, "[search] %s result row scan failed: %v", what, err)
			continue
		}
		out = append(out, h)
	}
	return out
}

// hitQuery runs query — through the self-repairing ftsQuery when ftsTable is
// set, plainly otherwise — and collects the rows with scan.
func hitQuery[T any](s *Server, ftsTable, what, query string, scan func(*sql.Rows) (T, error), args ...any) ([]T, error) {
	var rows *sql.Rows
	var err error
	if ftsTable != "" {
		rows, err = s.ftsQuery(ftsTable, query, args...)
	} else {
		rows, err = s.Store.DB.Query(query, args...)
	}
	if err != nil {
		return nil, err
	}
	return collectHits(rows, what, scan), nil
}

// queryTokens lower-cases and splits the query for the Go-side credit matching
// and the tag/genre name conditions.
func queryTokens(q string) []string { return strings.Fields(strings.ToLower(q)) }

// nameMatches reports whether every query token prefix-matches a word of the
// name — the Go-side mirror of FTS implicit-AND prefix matching. (Diacritic
// folding is FTS-only, so an accented name can miss; matchedCredits falls back
// to the full credit so the hit is never dropped.)
func nameMatches(name string, tokens []string) bool {
	if len(tokens) == 0 {
		return false
	}
	words := strings.Fields(strings.ToLower(name))
	for _, t := range tokens {
		ok := false
		for _, w := range words {
			if strings.HasPrefix(w, t) {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

// matchedCredits splits a joined credit ("Gaiman & Pratchett") and keeps the
// names the query matched; when the column matched but no single name does
// (tokens spanning both names), the whole credit is kept.
func matchedCredits(credit string, seps metadata.CreditSeps, tokens []string) []string {
	var out []string
	for _, n := range metadata.SplitCredits(credit, seps) {
		if nameMatches(n, tokens) {
			out = append(out, n)
		}
	}
	if len(out) == 0 {
		if t := strings.Join(strings.Fields(credit), " "); t != "" {
			out = []string{t}
		}
	}
	return out
}

// creditGroup buckets hits by the credited name the query matched, preserving
// the hits' (bm25) order. max caps the number of groups, not hits per group.
type creditGroup[T any] struct {
	Name string
	Hits []T
}

func groupByCredit[T any](hits []T, credit func(T) string, seps metadata.CreditSeps, tokens []string, max int) []creditGroup[T] {
	out := []creditGroup[T]{}
	idx := map[string]int{}
	for _, h := range hits {
		for _, name := range matchedCredits(credit(h), seps, tokens) {
			k := strings.ToLower(name)
			i, ok := idx[k]
			if !ok {
				if len(out) >= max {
					continue
				}
				i = len(out)
				idx[k] = i
				out = append(out, creditGroup[T]{Name: name})
			}
			out[i].Hits = append(out[i].Hits, h)
		}
	}
	return out
}

// ---- structured facets: decade + date added ---------------------------------

// searchDecadeRe matches a decade query: "1990s", "90s", "90's".
var searchDecadeRe = regexp.MustCompile(`^(\d{2}|\d{4})['’]?s$`)

// parseDecade turns "1990s" / "90s" into its year range. Two-digit decades map
// to the 1900s except 00s–20s, which read as the 2000s.
func parseDecade(q string) (label string, from, to int, ok bool) {
	m := searchDecadeRe.FindStringSubmatch(strings.ToLower(strings.TrimSpace(q)))
	if m == nil {
		return "", 0, 0, false
	}
	n, _ := strconv.Atoi(m[1])
	if len(m[1]) == 2 {
		if n <= 20 {
			n += 2000
		} else {
			n += 1900
		}
	}
	n -= n % 10
	return strconv.Itoa(n) + "s", n, n + 9, true
}

// searchDateLayouts are the accepted "date added" query forms; the Stats
// activity calendar links here with the ISO form.
var searchDateLayouts = []string{
	"2006-01-02",
	"2 January 2006", "2 Jan 2006",
	"January 2, 2006", "January 2 2006", "Jan 2, 2006", "Jan 2 2006",
}

// parseAddedDate recognises a whole-query date and returns it as YYYY-MM-DD.
func parseAddedDate(q string) (string, bool) {
	t := strings.Join(strings.Fields(q), " ")
	if t == "" || utf8.RuneCountInString(t) > 24 {
		return "", false
	}
	// Go's month-name parsing is case-sensitive; normalise "14 july 2026".
	words := strings.Fields(strings.ToLower(t))
	for i, w := range words {
		rs := []rune(w)
		rs[0] = unicode.ToUpper(rs[0])
		words[i] = string(rs)
	}
	t = strings.Join(words, " ")
	for _, layout := range searchDateLayouts {
		if d, err := time.Parse(layout, t); err == nil {
			return d.Format("2006-01-02"), true
		}
	}
	return "", false
}

// searchSubLimit caps the children under one facet entity (per tag / genre) —
// the sections are entry points, not exhaustive lists.
const searchSubLimit = 10

// nameConds builds "instr(lower(col), ?) > 0 AND …" for each token. SQLite's
// lower() folds ASCII only, which matches how tags/genres are typed.
func nameConds(col string, tokens []string) (string, []any) {
	conds := make([]string, len(tokens))
	args := make([]any, len(tokens))
	for i, t := range tokens {
		conds[i] = "instr(lower(" + col + "), ?) > 0"
		args[i] = t
	}
	return strings.Join(conds, " AND "), args
}

// searchTagFacet finds tags whose name contains every query token and returns
// each with its total use count and a page of the quotes wearing it.
func (s *Server) searchTagFacet(uid int64, tokens []string, wantAnn, wantDlg bool, limit int) ([]tagHits, error) {
	out := []tagHits{}
	if len(tokens) == 0 {
		return out, nil
	}
	cond, args := nameConds("t.name", tokens)
	args = append(args, uid, limit)
	rows, err := s.Store.DB.Query(`SELECT t.id, t.name FROM tags t WHERE `+cond+` AND t.user_id = ? ORDER BY t.name LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	type tagRow struct {
		id   int64
		name string
	}
	found := []tagRow{}
	for rows.Next() {
		var tr tagRow
		if err := rows.Scan(&tr.id, &tr.name); err != nil {
			olog.Warnf(olog.CodeSearchRowScan, "[search] tag row scan failed: %v", err)
			continue
		}
		found = append(found, tr)
	}
	rows.Close()

	for _, tr := range found {
		th := tagHits{Name: tr.name, Annotations: []annotationHit{}, Dialogues: []dialogueHit{}}
		if wantAnn {
			var n int
			if err := s.Store.DB.QueryRow(`SELECT count(*) FROM annotation_tags at
				JOIN annotations a ON a.id = at.annotation_id JOIN books b ON b.id = a.book_id
				WHERE at.tag_id = ? AND b.user_id = ?`, tr.id, uid).Scan(&n); err != nil {
				return nil, err
			}
			th.Count += n
			hits, err := hitQuery(s, "", "tag annotation", `SELECT `+annotationHitCols+` FROM annotation_tags at
				JOIN annotations a ON a.id = at.annotation_id JOIN books b ON b.id = a.book_id
				WHERE at.tag_id = ? AND b.user_id = ? ORDER BY a.created_at DESC LIMIT ?`,
				scanAnnotationHit, tr.id, uid, searchSubLimit)
			if err != nil {
				return nil, err
			}
			th.Annotations = hits
		}
		if wantDlg {
			var n int
			if err := s.Store.DB.QueryRow(`SELECT count(*) FROM dialogue_tags dt
				JOIN dialogues d ON d.id = dt.dialogue_id JOIN movies m ON m.id = d.movie_id
				WHERE dt.tag_id = ? AND m.user_id = ?`, tr.id, uid).Scan(&n); err != nil {
				return nil, err
			}
			th.Count += n
			hits, err := hitQuery(s, "", "tag dialogue", `SELECT `+dialogueHitCols+` FROM dialogue_tags dt
				JOIN dialogues d ON d.id = dt.dialogue_id JOIN movies m ON m.id = d.movie_id
				WHERE dt.tag_id = ? AND m.user_id = ? ORDER BY d.created_at DESC LIMIT ?`,
				scanDialogueHit, tr.id, uid, searchSubLimit)
			if err != nil {
				return nil, err
			}
			th.Dialogues = hits
		}
		out = append(out, th)
	}
	// Most-used first; the name ORDER BY above breaks ties.
	sort.SliceStable(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out, nil
}

// searchGenreFacet finds genres whose name contains every query token and
// returns each with a page of its works. Genres with no works in scope are
// dropped (an orphaned genre name is noise, not a result).
func (s *Server) searchGenreFacet(uid int64, tokens []string, wantBooks, wantMovies bool, limit int) ([]genreHits, error) {
	out := []genreHits{}
	if len(tokens) == 0 {
		return out, nil
	}
	cond, args := nameConds("g.name", tokens)
	args = append(args, uid, limit)
	rows, err := s.Store.DB.Query(`SELECT g.id, g.name FROM genres g WHERE `+cond+` AND g.user_id = ? ORDER BY g.name LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	type genreRow struct {
		id   int64
		name string
	}
	found := []genreRow{}
	for rows.Next() {
		var gr genreRow
		if err := rows.Scan(&gr.id, &gr.name); err != nil {
			olog.Warnf(olog.CodeSearchRowScan, "[search] genre row scan failed: %v", err)
			continue
		}
		found = append(found, gr)
	}
	rows.Close()

	for _, gr := range found {
		gh := genreHits{Name: gr.name, Books: []bookHit{}, Movies: []movieHit{}}
		if wantBooks {
			hits, err := hitQuery(s, "", "genre book", `SELECT `+bookHitCols+` FROM book_genres bg
				JOIN books b ON b.id = bg.book_id WHERE bg.genre_id = ? AND b.user_id = ?
				ORDER BY b.title LIMIT ?`, scanBookHit, gr.id, uid, searchSubLimit)
			if err != nil {
				return nil, err
			}
			gh.Books = hits
		}
		if wantMovies {
			hits, err := hitQuery(s, "", "genre movie", `SELECT `+movieHitCols+` FROM movie_genres mg
				JOIN movies m ON m.id = mg.movie_id WHERE mg.genre_id = ? AND m.user_id = ?
				ORDER BY m.title LIMIT ?`, scanMovieHit, gr.id, uid, searchSubLimit)
			if err != nil {
				return nil, err
			}
			gh.Movies = hits
		}
		if len(gh.Books)+len(gh.Movies) > 0 {
			out = append(out, gh)
		}
	}
	return out, nil
}

// searchDecadeFacet lists the works published/released in the decade. Returns
// nil when nothing falls in it (no section rather than an empty one).
func (s *Server) searchDecadeFacet(uid int64, label string, from, to int, wantBooks, wantMovies bool, limit int) (*decadeHits, error) {
	dh := &decadeHits{Label: label, Books: []bookHit{}, Movies: []movieHit{}}
	var err error
	if wantBooks {
		dh.Books, err = hitQuery(s, "", "decade book", `SELECT `+bookHitCols+` FROM books b
			WHERE b.user_id = ? AND b.published_year BETWEEN ? AND ?
			ORDER BY b.published_year, b.title LIMIT ?`, scanBookHit, uid, from, to, limit)
		if err != nil {
			return nil, err
		}
	}
	if wantMovies {
		dh.Movies, err = hitQuery(s, "", "decade movie", `SELECT `+movieHitCols+` FROM movies m
			WHERE m.user_id = ? AND m.release_year BETWEEN ? AND ?
			ORDER BY m.release_year, m.title LIMIT ?`, scanMovieHit, uid, from, to, limit)
		if err != nil {
			return nil, err
		}
	}
	if len(dh.Books)+len(dh.Movies) == 0 {
		return nil, nil
	}
	return dh, nil
}

// searchDateFacet lists everything added on one (UTC) day — the target of the
// Stats activity calendar's dot links. Returns nil when the day was quiet.
func (s *Server) searchDateFacet(uid int64, day string, wantBooks, wantAnn, wantMovies, wantDlg bool, limit int) (*dateHits, error) {
	dh := &dateHits{Date: day, Books: []bookHit{}, Movies: []movieHit{}, Annotations: []annotationHit{}, Dialogues: []dialogueHit{}}
	var err error
	if wantBooks {
		dh.Books, err = hitQuery(s, "", "date book", `SELECT `+bookHitCols+` FROM books b
			WHERE b.user_id = ? AND substr(b.created_at, 1, 10) = ? ORDER BY b.created_at LIMIT ?`,
			scanBookHit, uid, day, limit)
		if err != nil {
			return nil, err
		}
	}
	if wantMovies {
		dh.Movies, err = hitQuery(s, "", "date movie", `SELECT `+movieHitCols+` FROM movies m
			WHERE m.user_id = ? AND substr(m.created_at, 1, 10) = ? ORDER BY m.created_at LIMIT ?`,
			scanMovieHit, uid, day, limit)
		if err != nil {
			return nil, err
		}
	}
	if wantAnn {
		dh.Annotations, err = hitQuery(s, "", "date annotation", `SELECT `+annotationHitCols+` FROM annotations a
			JOIN books b ON b.id = a.book_id
			WHERE b.user_id = ? AND substr(a.created_at, 1, 10) = ? ORDER BY a.created_at LIMIT ?`,
			scanAnnotationHit, uid, day, limit)
		if err != nil {
			return nil, err
		}
	}
	if wantDlg {
		dh.Dialogues, err = hitQuery(s, "", "date dialogue", `SELECT `+dialogueHitCols+` FROM dialogues d
			JOIN movies m ON m.id = d.movie_id
			WHERE m.user_id = ? AND substr(d.created_at, 1, 10) = ? ORDER BY d.created_at LIMIT ?`,
			scanDialogueHit, uid, day, limit)
		if err != nil {
			return nil, err
		}
	}
	if len(dh.Books)+len(dh.Movies)+len(dh.Annotations)+len(dh.Dialogues) == 0 {
		return nil, nil
	}
	return dh, nil
}

// Genre-array fill-ins (genre_text is space-joined and can't be split safely —
// names contain spaces), applied to every section's book/movie hits.
func fillBookGenres(by map[int64][]string, hits []bookHit) {
	for i := range hits {
		if gs := by[hits[i].ID]; gs != nil {
			hits[i].Genres = gs
		}
	}
}

func fillAnnotationGenres(by map[int64][]string, hits []annotationHit) {
	for i := range hits {
		if gs := by[hits[i].BookID]; gs != nil {
			hits[i].BookGenres = gs
		}
	}
}

func fillMovieGenres(by map[int64][]string, hits []movieHit) {
	for i := range hits {
		if gs := by[hits[i].ID]; gs != nil {
			hits[i].Genres = gs
		}
	}
}

func fillDialogueGenres(by map[int64][]string, hits []dialogueHit) {
	for i := range hits {
		if gs := by[hits[i].MovieID]; gs != nil {
			hits[i].MovieGenres = gs
		}
	}
}

// handleSearch implements
// GET /search?q=&scope=all|books|annotations|movies|dialogues&limit=
// (PLAN §4, § sectioned search). Results come back faceted by what matched —
// books/movies (title·series), annotations/dialogues (quote·character),
// authors/directors/actors (credit columns), notes, tags, genres — plus the
// structured decade ("1990s") and date-added ("2026-07-14") facets. Structured
// filters (tag/color/book_id/movie_id) live on the list endpoints instead —
// not duplicated here (KISS).
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeErr(w, http.StatusBadRequest, "q is required")
		return
	}
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "all"
	}
	limit := 20
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}

	uid := userID(r)
	olog.Tracef("[search] handleSearch uid=%d scope=%q q=%q limit=%d", uid, scope, q, limit)
	resp := searchResults{
		Books: []bookHit{}, Annotations: []annotationHit{},
		Movies: []movieHit{}, Dialogues: []dialogueHit{},
		Authors: []authorHits{}, Directors: []directorHits{}, Actors: []actorHits{},
		Notes: noteHits{Annotations: []annotationHit{}, Dialogues: []dialogueHit{}},
		Tags:  []tagHits{}, Genres: []genreHits{},
	}

	wantBooks := scope == "all" || scope == "books"
	wantAnnotations := scope == "all" || scope == "annotations"
	wantMovies := scope == "all" || scope == "movies"
	wantDialogues := scope == "all" || scope == "dialogues"

	seps := s.creditSeps(uid)

	// Structured facets parse the RAW query only (a date or a decade isn't a
	// typo, so they never join the fuzzy re-run).
	structured := 0
	if day, ok := parseAddedDate(q); ok {
		dh, err := s.searchDateFacet(uid, day, wantBooks, wantAnnotations, wantMovies, wantDialogues, limit)
		if err != nil {
			internalError(w, r, "search date added", err)
			return
		}
		if dh != nil {
			resp.DateAdded = dh
			structured += len(dh.Books) + len(dh.Movies) + len(dh.Annotations) + len(dh.Dialogues)
		}
	}
	if label, from, to, ok := parseDecade(q); ok {
		dec, err := s.searchDecadeFacet(uid, label, from, to, wantBooks, wantMovies, limit)
		if err != nil {
			internalError(w, r, "search decade", err)
			return
		}
		if dec != nil {
			resp.Decade = dec
			structured += len(dec.Books) + len(dec.Movies)
		}
	}

	// runPass fills every text facet from one query string and returns how many
	// rows it found. PrefixQuery (via ColumnPrefixQuery) makes every token a
	// prefix — this is a typeahead box, so "shaws" finds "shawshank". Called
	// once with the exact query and, when that (plus the structured facets)
	// found nothing, once more with the fuzzy-corrected query.
	runPass := func(qq string) (int, error) {
		tokens := queryTokens(qq)
		total := 0

		if wantBooks {
			hits, err := hitQuery(s, "books_fts", "book", `SELECT `+bookHitCols+` FROM books_fts
				JOIN books b ON b.id = books_fts.rowid
				WHERE books_fts MATCH ? AND b.user_id = ? ORDER BY bm25(books_fts) LIMIT ?`,
				scanBookHit, search.ColumnPrefixQuery("title series", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Books = hits
			total += len(hits)

			byAuthor, err := hitQuery(s, "books_fts", "author book", `SELECT `+bookHitCols+` FROM books_fts
				JOIN books b ON b.id = books_fts.rowid
				WHERE books_fts MATCH ? AND b.user_id = ? ORDER BY bm25(books_fts) LIMIT ?`,
				scanBookHit, search.ColumnPrefixQuery("author", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Authors = resp.Authors[:0]
			for _, g := range groupByCredit(byAuthor, func(b bookHit) string { return b.Author }, seps, tokens, limit) {
				resp.Authors = append(resp.Authors, authorHits{Name: g.Name, Books: g.Hits})
			}
			total += len(resp.Authors)
		}

		if wantAnnotations {
			hits, err := hitQuery(s, "annotations_fts", "annotation", `SELECT `+annotationHitCols+` FROM annotations_fts
				JOIN annotations a ON a.id = annotations_fts.rowid
				JOIN books b ON b.id = a.book_id
				WHERE annotations_fts MATCH ? AND b.user_id = ? ORDER BY bm25(annotations_fts) LIMIT ?`,
				scanAnnotationHit, search.ColumnPrefixQuery("quote", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Annotations = hits
			total += len(hits)

			notes, err := hitQuery(s, "annotations_fts", "annotation note", `SELECT `+annotationHitCols+` FROM annotations_fts
				JOIN annotations a ON a.id = annotations_fts.rowid
				JOIN books b ON b.id = a.book_id
				WHERE annotations_fts MATCH ? AND b.user_id = ? ORDER BY bm25(annotations_fts) LIMIT ?`,
				scanAnnotationHit, search.ColumnPrefixQuery("note", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Notes.Annotations = notes
			total += len(notes)
		}

		if wantMovies {
			hits, err := hitQuery(s, "movies_fts", "movie", `SELECT `+movieHitCols+` FROM movies_fts
				JOIN movies m ON m.id = movies_fts.rowid
				WHERE movies_fts MATCH ? AND m.user_id = ? ORDER BY bm25(movies_fts) LIMIT ?`,
				scanMovieHit, search.ColumnPrefixQuery("title series", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Movies = hits
			total += len(hits)

			byDirector, err := hitQuery(s, "movies_fts", "director movie", `SELECT `+movieHitCols+` FROM movies_fts
				JOIN movies m ON m.id = movies_fts.rowid
				WHERE movies_fts MATCH ? AND m.user_id = ? ORDER BY bm25(movies_fts) LIMIT ?`,
				scanMovieHit, search.ColumnPrefixQuery("director", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Directors = resp.Directors[:0]
			for _, g := range groupByCredit(byDirector, func(m movieHit) string { return m.Director }, seps, tokens, limit) {
				resp.Directors = append(resp.Directors, directorHits{Name: g.Name, Movies: g.Hits})
			}
			total += len(resp.Directors)
		}

		if wantDialogues {
			hits, err := hitQuery(s, "dialogues_fts", "dialogue", `SELECT `+dialogueHitCols+` FROM dialogues_fts
				JOIN dialogues d ON d.id = dialogues_fts.rowid
				JOIN movies m ON m.id = d.movie_id
				WHERE dialogues_fts MATCH ? AND m.user_id = ? ORDER BY bm25(dialogues_fts) LIMIT ?`,
				scanDialogueHit, search.ColumnPrefixQuery("quote character", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Dialogues = hits
			total += len(hits)

			byActor, err := hitQuery(s, "dialogues_fts", "actor dialogue", `SELECT `+dialogueHitCols+` FROM dialogues_fts
				JOIN dialogues d ON d.id = dialogues_fts.rowid
				JOIN movies m ON m.id = d.movie_id
				WHERE dialogues_fts MATCH ? AND m.user_id = ? ORDER BY bm25(dialogues_fts) LIMIT ?`,
				scanDialogueHit, search.ColumnPrefixQuery("actor", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Actors = resp.Actors[:0]
			for _, g := range groupByCredit(byActor, func(d dialogueHit) string { return d.Actor }, seps, tokens, limit) {
				resp.Actors = append(resp.Actors, actorHits{Name: g.Name, Dialogues: g.Hits})
			}
			total += len(resp.Actors)

			noteHitsD, err := hitQuery(s, "dialogues_fts", "dialogue note", `SELECT `+dialogueHitCols+` FROM dialogues_fts
				JOIN dialogues d ON d.id = dialogues_fts.rowid
				JOIN movies m ON m.id = d.movie_id
				WHERE dialogues_fts MATCH ? AND m.user_id = ? ORDER BY bm25(dialogues_fts) LIMIT ?`,
				scanDialogueHit, search.ColumnPrefixQuery("note", qq), uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Notes.Dialogues = noteHitsD
			total += len(noteHitsD)
		}

		// Tags + genres match by name (substring, not FTS) but follow the same
		// pass so they benefit from the typo correction too.
		if wantAnnotations || wantDialogues {
			tags, err := s.searchTagFacet(uid, tokens, wantAnnotations, wantDialogues, searchSubLimit)
			if err != nil {
				return 0, err
			}
			resp.Tags = tags
			total += len(tags)
		}
		if wantBooks || wantMovies {
			genres, err := s.searchGenreFacet(uid, tokens, wantBooks, wantMovies, searchSubLimit)
			if err != nil {
				return 0, err
			}
			resp.Genres = genres
			total += len(genres)
		}
		return total, nil
	}

	// runMixedPass is the cross-column fallback: when no single facet matched,
	// re-run the unrestricted queries (implicit AND across ALL indexed columns
	// of a row, the pre-facet behaviour) so a query spanning columns — "casab
	// mich" hitting title + director — still finds its work. Hits land in the
	// plain books/annotations/movies/dialogues sections.
	runMixedPass := func(qq string) (int, error) {
		match := search.PrefixQuery(qq)
		total := 0
		if wantBooks {
			hits, err := hitQuery(s, "books_fts", "book", `SELECT `+bookHitCols+` FROM books_fts
				JOIN books b ON b.id = books_fts.rowid
				WHERE books_fts MATCH ? AND b.user_id = ? ORDER BY bm25(books_fts) LIMIT ?`,
				scanBookHit, match, uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Books = hits
			total += len(hits)
		}
		if wantAnnotations {
			hits, err := hitQuery(s, "annotations_fts", "annotation", `SELECT `+annotationHitCols+` FROM annotations_fts
				JOIN annotations a ON a.id = annotations_fts.rowid
				JOIN books b ON b.id = a.book_id
				WHERE annotations_fts MATCH ? AND b.user_id = ? ORDER BY bm25(annotations_fts) LIMIT ?`,
				scanAnnotationHit, match, uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Annotations = hits
			total += len(hits)
		}
		if wantMovies {
			hits, err := hitQuery(s, "movies_fts", "movie", `SELECT `+movieHitCols+` FROM movies_fts
				JOIN movies m ON m.id = movies_fts.rowid
				WHERE movies_fts MATCH ? AND m.user_id = ? ORDER BY bm25(movies_fts) LIMIT ?`,
				scanMovieHit, match, uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Movies = hits
			total += len(hits)
		}
		if wantDialogues {
			hits, err := hitQuery(s, "dialogues_fts", "dialogue", `SELECT `+dialogueHitCols+` FROM dialogues_fts
				JOIN dialogues d ON d.id = dialogues_fts.rowid
				JOIN movies m ON m.id = d.movie_id
				WHERE dialogues_fts MATCH ? AND m.user_id = ? ORDER BY bm25(dialogues_fts) LIMIT ?`,
				scanDialogueHit, match, uid, limit)
			if err != nil {
				return 0, err
			}
			resp.Dialogues = hits
			total += len(hits)
		}
		return total, nil
	}

	// runBoth: the faceted pass, then the cross-column fallback if it drew blank.
	runBoth := func(qq string) (int, error) {
		total, err := runPass(qq)
		if err != nil || total > 0 {
			return total, err
		}
		return runMixedPass(qq)
	}

	total, err := runBoth(q)
	if err != nil {
		internalError(w, r, "search", err)
		return
	}
	// Zero-hit fuzzy pass (PLAN §4): correct the query's tokens against the
	// indexed vocabulary and re-run once. The vocab is index-wide (not
	// user-scoped), but the re-run queries stay user_id-filtered and Corrected is
	// surfaced only when THIS user actually received rows — so no other user's
	// vocabulary ever leaks (§3.6).
	if total == 0 && structured == 0 {
		if corrected := s.fuzzyCorrect(q, wantBooks, wantAnnotations, wantMovies, wantDialogues); corrected != "" {
			t2, err := runBoth(corrected)
			if err != nil {
				internalError(w, r, "search (corrected)", err)
				return
			}
			if t2 > 0 {
				resp.Corrected = corrected
			}
		}
	}

	// Genre names as arrays for every section's hits, so grouping-by-genre and
	// the genre chip rows work on every card.
	if wantBooks || wantAnnotations {
		if byBook, err := s.genreNames(uid, "book"); err == nil {
			fillBookGenres(byBook, resp.Books)
			fillAnnotationGenres(byBook, resp.Annotations)
			fillAnnotationGenres(byBook, resp.Notes.Annotations)
			for i := range resp.Authors {
				fillBookGenres(byBook, resp.Authors[i].Books)
			}
			for i := range resp.Tags {
				fillAnnotationGenres(byBook, resp.Tags[i].Annotations)
			}
			for i := range resp.Genres {
				fillBookGenres(byBook, resp.Genres[i].Books)
			}
			if resp.Decade != nil {
				fillBookGenres(byBook, resp.Decade.Books)
			}
			if resp.DateAdded != nil {
				fillBookGenres(byBook, resp.DateAdded.Books)
				fillAnnotationGenres(byBook, resp.DateAdded.Annotations)
			}
		}
	}
	if wantMovies || wantDialogues {
		if byMovie, err := s.genreNames(uid, "movie"); err == nil {
			fillMovieGenres(byMovie, resp.Movies)
			fillDialogueGenres(byMovie, resp.Dialogues)
			fillDialogueGenres(byMovie, resp.Notes.Dialogues)
			for i := range resp.Directors {
				fillMovieGenres(byMovie, resp.Directors[i].Movies)
			}
			for i := range resp.Actors {
				fillDialogueGenres(byMovie, resp.Actors[i].Dialogues)
			}
			for i := range resp.Tags {
				fillDialogueGenres(byMovie, resp.Tags[i].Dialogues)
			}
			for i := range resp.Genres {
				fillMovieGenres(byMovie, resp.Genres[i].Movies)
			}
			if resp.Decade != nil {
				fillMovieGenres(byMovie, resp.Decade.Movies)
			}
			if resp.DateAdded != nil {
				fillMovieGenres(byMovie, resp.DateAdded.Movies)
				fillDialogueGenres(byMovie, resp.DateAdded.Dialogues)
			}
		}
	}

	olog.Tracef("[search] handleSearch uid=%d results books=%d annotations=%d movies=%d dialogues=%d authors=%d directors=%d actors=%d notes=%d/%d tags=%d genres=%d",
		uid, len(resp.Books), len(resp.Annotations), len(resp.Movies), len(resp.Dialogues),
		len(resp.Authors), len(resp.Directors), len(resp.Actors),
		len(resp.Notes.Annotations), len(resp.Notes.Dialogues), len(resp.Tags), len(resp.Genres))
	writeJSON(w, http.StatusOK, resp)
}

// maxFuzzyTokens / maxFuzzyQueryRunes bound the zero-hit fuzzy pass: a very long
// query returning nothing is unlikely to be a single typo worth correcting, and
// the caps keep the per-token vocab scan and edit-distance work bounded.
const (
	maxFuzzyTokens     = 8
	maxFuzzyQueryRunes = 64
	// maxFuzzyHarvest caps how many candidate terms per scope the correction step
	// pulls (ordered by popularity), so the O(candidates)×tokens Go-side work is
	// bounded even when the length window is wide or unbounded above. Generous
	// enough that a personal library harvests its whole vocabulary; a bound, not
	// a tuning knob.
	maxFuzzyHarvest = 5000
)

// fuzzyVocabScope pairs a requested scope's fts5vocab view with its base FTS
// table (the repair target ftsQuery reconstructs if a vocab read hits corruption).
type fuzzyVocabScope struct {
	want       bool
	vocabTable string
	baseTable  string
}

// fuzzyCorrect implements the zero-hit typo-correction step (PLAN §4). It
// harvests candidate terms from the requested scopes' fts5vocab tables within an
// edit-distance-bounded length window, corrects the query's tokens
// (search.Correct), and returns the corrected query — or "" when the query is
// not correctable, nothing changed, or the vocabulary could not be read. A vocab
// read that fails even after ftsQuery's one-shot repair logs TIP-SRCH-004 once
// and degrades to "" (best-effort: search never 500s because fuzzy broke).
func (s *Server) fuzzyCorrect(q string, wantBooks, wantAnnotations, wantMovies, wantDialogues bool) string {
	tokens := strings.Fields(q)
	if len(tokens) == 0 || len(tokens) > maxFuzzyTokens || utf8.RuneCountInString(q) > maxFuzzyQueryRunes {
		return ""
	}
	// lastIsPrefix=true: the final token is corrected in prefix mode (typeahead),
	// so its harvest has no upper length bound (hi==0) — see search.Window.
	lo, hi, ok := search.Window(tokens, true)
	if !ok {
		return "" // no token long enough to correct
	}

	// Union candidate terms across the requested scopes, keeping the highest doc
	// count per term (the popularity tie-breaker). The vocab is index-wide, not
	// user-scoped — safe because the corrected re-run stays user_id-filtered and
	// the handler only surfaces `corrected` when this user actually got rows.
	//
	// fts5vocab has no index on length(term), so the length predicate filters the
	// scanned rows rather than seeking; the ORDER BY doc DESC + LIMIT caps the
	// candidate set the Go-side correction then scans (isLivePrefix + nearest run
	// per token), so cost stays bounded even when the window is wide or unbounded
	// above. On a small library the cap never bites; on a large one it keeps the
	// most popular — most likely-intended — terms.
	merged := map[string]int64{}
	for _, sc := range []fuzzyVocabScope{
		{wantBooks, "books_fts_vocab", "books_fts"},
		{wantAnnotations, "annotations_fts_vocab", "annotations_fts"},
		{wantMovies, "movies_fts_vocab", "movies_fts"},
		{wantDialogues, "dialogues_fts_vocab", "dialogues_fts"},
	} {
		if !sc.want {
			continue
		}
		// Fixed table names (not user input); bounds are parameter-bound. hi==0 is
		// the "no upper bound" sentinel for the prefix last token.
		var rows *sql.Rows
		var err error
		if hi == 0 {
			rows, err = s.ftsQuery(sc.baseTable,
				`SELECT term, doc FROM `+sc.vocabTable+` WHERE length(term) >= ? ORDER BY doc DESC LIMIT ?`, lo, maxFuzzyHarvest)
		} else {
			rows, err = s.ftsQuery(sc.baseTable,
				`SELECT term, doc FROM `+sc.vocabTable+` WHERE length(term) BETWEEN ? AND ? ORDER BY doc DESC LIMIT ?`, lo, hi, maxFuzzyHarvest)
		}
		if err != nil {
			olog.Warnf(olog.CodeSearchVocab, "[search] fuzzy vocab read on %s failed (%v); skipping typo correction", sc.vocabTable, err)
			return ""
		}
		for rows.Next() {
			var term string
			var doc int64
			if err := rows.Scan(&term, &doc); err != nil {
				continue
			}
			if doc > merged[term] {
				merged[term] = doc
			}
		}
		rows.Close()
	}
	if len(merged) == 0 {
		return ""
	}
	vocab := make([]search.VocabTerm, 0, len(merged))
	for term, doc := range merged {
		vocab = append(vocab, search.VocabTerm{Term: term, Doc: doc})
	}

	corrected, changed := search.Correct(tokens, vocab, true)
	if !changed {
		return ""
	}
	cq := strings.Join(corrected, " ")
	olog.Tracef("[search] fuzzy: %q -> %q (%d vocab terms in [%d,%d])", q, cq, len(vocab), lo, hi)
	return cq
}

// ftsQuery runs an FTS5 MATCH query and, if it fails, reconstructs the given
// external-content index once and retries. These indexes (books_fts, …) are kept
// in sync by triggers but can still end up corrupt — a NULL-vs-” drift between
// what a row was indexed with and what a delete/update trigger passes, or genuine
// page-level damage from an unclean shutdown — which surfaces only at query time
// as "database disk image is malformed" and turned every search into an opaque
// 500.
//
// Recovery mirrors the startup path (store.RepairFTS): RepairIndex does a
// DROP + recreate + rebuild, which discards the corrupt shadow pages instead of
// re-reading them. This matters because a bare 'rebuild' has to read the same bad
// %_data b-tree to clear it, so on page-level corruption it re-hits SQLITE_CORRUPT
// and can't self-heal — which is exactly what the old code did and why searches
// stayed broken until a restart. RepairIndex serializes with any concurrent
// search's repair (and with admin reindex / startup repair) via the store lock,
// so two corrupt-index queries don't race on the DROP.
func (s *Server) ftsQuery(ftsTable, query string, args ...any) (*sql.Rows, error) {
	rows, err := s.Store.DB.Query(query, args...)
	if err == nil {
		return rows, nil
	}
	olog.Warnf(olog.CodeSearchQuery, "%s query failed (%v); reconstructing index and retrying", ftsTable, err)
	if rbErr := s.Store.RepairIndex(ftsTable); rbErr != nil {
		olog.Errorf(olog.CodeSearchRepair, "%s reconstruction failed: %v — restart the server or run Profile → Rebuild search index to fully recover", ftsTable, rbErr)
		return nil, err
	}
	olog.Printf("[search] %s reconstructed; retrying query", ftsTable)
	return s.Store.DB.Query(query, args...)
}
