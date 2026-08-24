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

// EVERY HIT BELOW CARRIES review_excluded, and the two child hits carry their
// parent's as well.
//
// A search result is the same object the board shows, and 0033's mark is the
// newest thing a card says about itself. Search was already the one place a
// quote arrived without its COLOUR — so a library sorted into six categories
// looked uncategorised the moment you searched it — and a mark that appeared on
// every board and not here would be the identical bug with a different field:
// invisible on any one screen, because each screen is internally consistent.
type bookHit struct {
	ID            int64    `json:"id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	CoverPath     string   `json:"cover_path"`
	Genres        []string `json:"genres"` // array, matching GET /books (the UI maps over it)
	PublishedYear int      `json:"published_year"`
	Series        string   `json:"series"`
	SeriesIndex   float64  `json:"series_index"`

	ReviewExcluded bool `json:"review_excluded"`
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
	// Color, because a quote is the same object wherever it is listed. Search
	// was the one place it arrived without one, so every annotation in a result
	// list wore the default colour and a library sorted into six named
	// categories looked uncategorised the moment you searched it.
	Color string `json:"color"`
	// Who says it (0047). On the hit so a result card can draw the speaker of a
	// novel's line the way a dialogue card draws a film's — the field would
	// otherwise be storable, searchable, and invisible in the one place the search
	// for it lands. The Characters SECTION stays a screen-only grouping: it is built
	// from dialogueHits, and a section mixing books and films under one name is a
	// layout decision for the design pass rather than a column.
	Character string `json:"character"`
	// 0051. On the hit for the reason utteranceHit.Translation is: it is what
	// MATCHED — a result whose search term appears in nothing the card shows reads
	// as a wrong result, and a translated highlight is now findable by its English.
	Translation string `json:"translation"`

	ReviewExcluded     bool `json:"review_excluded"`
	WorkReviewExcluded bool `json:"work_review_excluded"` // the book's; see quoteRow
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

	ReviewExcluded bool `json:"review_excluded"`
}

// utteranceHit is a standalone quote (§24). It is the only hit with no parent
// fields, because it has no parent: where an annotation borrows its book's
// author and year so the client can still group it, a quote's grouping keys —
// the speaker and the occasion — are on the row itself.
type utteranceHit struct {
	ID           int64  `json:"id"`
	Quote        string `json:"quote"`
	Note         string `json:"note"`
	Color        string `json:"color"`
	Speaker      string `json:"speaker"`
	Occasion     string `json:"occasion"`
	OccasionDate string `json:"occasion_date"`
	Place        string `json:"place"`
	// SUPERSEDED BY Kind (0053) and still sent: the column keeps every value it
	// holds and the card falls back to it when no kind has been set, so a hit that
	// carried only the kind would show less than the list row beside it.
	Medium string `json:"medium"`
	Kind   string `json:"kind"`
	// 0035. The category is on the HIT and not only on the list row, because a hit
	// is a link: with three boards, "open this quote" needs to know which board it
	// opens. Translation rides along because it is what matched — a result whose
	// search term appears in nothing the card shows reads as a wrong result.
	Category    string `json:"category"`
	Language    string `json:"language"`
	Translation string `json:"translation"`

	// No parent field to borrow: a standalone quote carries only its own flag,
	// which is the same asymmetry the rest of §24 has.
	ReviewExcluded bool `json:"review_excluded"`
}

type dialogueHit struct {
	ID              int64  `json:"id"`
	MovieID         int64  `json:"movie_id"`
	MovieTitle      string `json:"movie_title"`
	MoviePosterPath string `json:"movie_poster_path"` // group header art
	// Parent-movie fields, mirroring annotationHit — so a dialogue-only group
	// still groups by director/decade/series/genre.
	MovieDirector  string   `json:"movie_director"`
	MovieYear      int      `json:"movie_release_year"`
	MovieSeries    string   `json:"movie_series"`
	MovieGenres    []string `json:"movie_genres"`
	MovieMediaType string   `json:"movie_media_type"` // movie | show
	Quote          string   `json:"quote"`
	Note           string   `json:"note"`
	Color          string   `json:"color"` // see annotationHit.Color
	Character      string   `json:"character"`
	Actor          string   `json:"actor"`
	Timestamp      string   `json:"timestamp"`
	Translation    string   `json:"translation"` // 0051; see annotationHit.Translation
	episodeRef              // shows only; null on a film's lines

	ReviewExcluded     bool `json:"review_excluded"`
	WorkReviewExcluded bool `json:"work_review_excluded"` // the film's; see quoteRow
	// The stored picture for each character named on this line (0050). Filled by
	// fillSearchCharacterImages after the sections are assembled; omitted when
	// there is none, so a chip can tell "no picture" from "no character".
	CharacterImages []characterImage `json:"character_images,omitempty"`
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

// speakerHits mirrors authorHits and actorHits: the credit matched, plus what
// they said. It is a separate section from Quotes for the same reason Authors is
// separate from Books — searching a person's name is asking about the person.
type speakerHits struct {
	Name   string         `json:"name"`
	Quotes []utteranceHit `json:"quotes"`
}

// characterHits is the same shape for the OTHER kind of speaker — the one on a
// line of dialogue, in a film, a show or a game.
//
// IT CARRIES NO PORTRAIT AND NO ACTOR, and that is the decision rather than an
// omission. Every other credit section here is a section about a PERSON, and the
// client hangs a `people` row's photograph on the name. A character is not a
// person: there is nobody to photograph, and attaching the actor's face would
// answer a question nobody asked and get it wrong the moment a part is recast or
// a role is shared. The review loop settled the same point for its "who said
// this?" card — name only.
type characterHits struct {
	Name      string        `json:"name"`
	Dialogues []dialogueHit `json:"dialogues"`
}

type noteHits struct {
	Annotations []annotationHit `json:"annotations"`
	Dialogues   []dialogueHit   `json:"dialogues"`
	Quotes      []utteranceHit  `json:"quotes"`
}

type tagHits struct {
	Name        string          `json:"name"`
	Count       int             `json:"count"` // total quotes wearing the tag (in scope)
	Annotations []annotationHit `json:"annotations"`
	Dialogues   []dialogueHit   `json:"dialogues"`
	Quotes      []utteranceHit  `json:"quotes"`
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
	Quotes      []utteranceHit  `json:"quotes"`
}

// searchScope is which media a request covers. One value rather than a bool per
// medium: searchDateFacet alone took four consecutive bools, and a fifth would
// have made transposing two of them a silent wrong answer the compiler cannot
// see.
type searchScope struct {
	books       bool
	annotations bool
	movies      bool
	dialogues   bool
	utterances  bool
}

func parseSearchScope(scope string) searchScope {
	all := scope == "all"
	return searchScope{
		books:       all || scope == "books",
		annotations: all || scope == "annotations",
		movies:      all || scope == "movies",
		dialogues:   all || scope == "dialogues",
		utterances:  all || scope == "quotes",
	}
}

type searchResults struct {
	Books       []bookHit       `json:"books"`       // title / series matches
	Annotations []annotationHit `json:"annotations"` // quote matches
	Movies      []movieHit      `json:"movies"`      // title / series matches
	Dialogues   []dialogueHit   `json:"dialogues"`   // quote matches
	Quotes      []utteranceHit  `json:"quotes"`      // standalone quote / occasion matches
	Authors     []authorHits    `json:"authors"`
	Directors   []directorHits  `json:"directors"`
	Actors      []actorHits     `json:"actors"`
	Characters  []characterHits `json:"characters"`
	Speakers    []speakerHits   `json:"speakers"`
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
		COALESCE(b.published_year, 0), COALESCE(b.series, ''), COALESCE(b.series_index, 0),
		b.review_excluded`
	// The child hits read the parent's exclusion as well as their own. It costs
	// nothing: `b`/`m` is already joined here, because for a child row that join
	// IS the ownership check (see searchSources).
	annotationHitCols = `a.id, a.book_id, b.title, COALESCE(b.cover_path, ''),
		COALESCE(a.quote, ''), COALESCE(a.note, ''), a.color, a.character, a.translation,
		COALESCE(b.author, ''), COALESCE(b.published_year, 0), COALESCE(b.series, ''),
		a.review_excluded, b.review_excluded`
	movieHitCols = `m.id, m.title, COALESCE(m.director, ''), COALESCE(m.release_year, 0),
		COALESCE(m.poster_path, ''), COALESCE(m.series, ''), COALESCE(m.series_index, 0),
		COALESCE(m.media_type, 'movie'),
		m.review_excluded`
	dialogueHitCols = `d.id, d.movie_id, m.title, COALESCE(m.poster_path, ''), d.quote,
		COALESCE(d.note, ''), d.color, COALESCE(d.character, ''), COALESCE(d.actor, ''), COALESCE(d.timestamp, ''),
		d.translation, d.season, d.episode,
		COALESCE(m.director, ''), COALESCE(m.release_year, 0), COALESCE(m.series, ''),
		COALESCE(m.media_type, 'movie'),
		d.review_excluded, m.review_excluded`
	utteranceHitCols = `u.id, u.quote, COALESCE(u.note, ''), u.color,
		COALESCE(u.speaker, ''), COALESCE(u.occasion, ''), COALESCE(u.occasion_date, ''),
		COALESCE(u.place, ''), COALESCE(u.medium, ''), COALESCE(u.kind, ''),
		u.category, u.language, u.translation,
		u.review_excluded`
)

func scanBookHit(rows *sql.Rows) (bookHit, error) {
	h := bookHit{Genres: []string{}}
	err := rows.Scan(&h.ID, &h.Title, &h.Author, &h.CoverPath, &h.PublishedYear, &h.Series, &h.SeriesIndex,
		&h.ReviewExcluded)
	return h, err
}

func scanAnnotationHit(rows *sql.Rows) (annotationHit, error) {
	h := annotationHit{BookGenres: []string{}}
	err := rows.Scan(&h.ID, &h.BookID, &h.BookTitle, &h.BookCoverPath, &h.Quote, &h.Note, &h.Color, &h.Character, &h.Translation,
		&h.BookAuthor, &h.BookYear, &h.BookSeries,
		&h.ReviewExcluded, &h.WorkReviewExcluded)
	return h, err
}

func scanMovieHit(rows *sql.Rows) (movieHit, error) {
	h := movieHit{Genres: []string{}}
	err := rows.Scan(&h.ID, &h.Title, &h.Director, &h.ReleaseYear, &h.PosterPath, &h.Series, &h.SeriesIndex, &h.MediaType,
		&h.ReviewExcluded)
	return h, err
}

func scanDialogueHit(rows *sql.Rows) (dialogueHit, error) {
	h := dialogueHit{MovieGenres: []string{}}
	err := rows.Scan(&h.ID, &h.MovieID, &h.MovieTitle, &h.MoviePosterPath, &h.Quote, &h.Note, &h.Color,
		&h.Character, &h.Actor, &h.Timestamp, &h.Translation, &h.Season, &h.Episode,
		&h.MovieDirector, &h.MovieYear, &h.MovieSeries, &h.MovieMediaType,
		&h.ReviewExcluded, &h.WorkReviewExcluded)
	return h, err
}

func scanUtteranceHit(rows *sql.Rows) (utteranceHit, error) {
	var h utteranceHit
	err := rows.Scan(&h.ID, &h.Quote, &h.Note, &h.Color, &h.Speaker, &h.Occasion,
		&h.OccasionDate, &h.Place, &h.Medium, &h.Kind,
		&h.Category, &h.Language, &h.Translation,
		&h.ReviewExcluded)
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

// ---- where a section's rows come from ---------------------------------------
//
// One entry per row kind, naming everything the two query shapes need. It exists
// so the facet predicates have exactly one place to be spliced in: this handler
// runs about fifteen queries and a facet has to reach all of them, so fifteen
// hand-edited WHERE clauses would be fifteen chances to make a mistake that
// produces a wrong ANSWER rather than an error.
//
// THE TWO SHAPES. With free text, a section reads through its FTS index and
// orders by bm25. With none — a search made entirely of chips, which is what
// picking `tag:stoicism` out of the dropdown and typing nothing else produces —
// there is no MATCH to make, so it reads the base table directly and orders by
// recency. The second shape is not a fallback; it is the ordinary case for a
// query the reader built by pointing.
type searchSource struct {
	self       string // alias of the row itself
	work       string // alias of the parent book/film; "" when the row has no parent
	movieSide  bool   // the parent is a film or show (release_year, not published_year)
	cols       string
	ftsTable   string
	ftsFrom    string
	plainFrom  string
	userCond   string
	plainOrder string
}

var searchSources = map[rowKind]searchSource{
	rowBook: {
		self: "b", work: "b", cols: bookHitCols,
		ftsTable: "books_fts", ftsFrom: "books_fts JOIN books b ON b.id = books_fts.rowid",
		plainFrom: "books b", userCond: "b.user_id = ?", plainOrder: "b.created_at DESC, b.id DESC",
	},
	rowAnnotation: {
		self: "a", work: "b", cols: annotationHitCols,
		ftsTable: "annotations_fts",
		ftsFrom:  "annotations_fts JOIN annotations a ON a.id = annotations_fts.rowid JOIN books b ON b.id = a.book_id",
		// The user scope is on the parent: annotations carry no user_id, so the
		// join to books is not decoration, it is the ownership check.
		plainFrom: "annotations a JOIN books b ON b.id = a.book_id",
		userCond:  "b.user_id = ?", plainOrder: "a.created_at DESC, a.id DESC",
	},
	rowMovie: {
		self: "m", work: "m", movieSide: true, cols: movieHitCols,
		ftsTable: "movies_fts", ftsFrom: "movies_fts JOIN movies m ON m.id = movies_fts.rowid",
		plainFrom: "movies m", userCond: "m.user_id = ?", plainOrder: "m.created_at DESC, m.id DESC",
	},
	rowDialogue: {
		self: "d", work: "m", movieSide: true, cols: dialogueHitCols,
		ftsTable: "dialogues_fts",
		ftsFrom:  "dialogues_fts JOIN dialogues d ON d.id = dialogues_fts.rowid JOIN movies m ON m.id = d.movie_id",
		// As with annotations, the join IS the ownership check.
		plainFrom: "dialogues d JOIN movies m ON m.id = d.movie_id",
		userCond:  "m.user_id = ?", plainOrder: "d.created_at DESC, d.id DESC",
	},
	rowUtterance: {
		self: "u", work: "", cols: utteranceHitCols,
		ftsTable: "utterances_fts", ftsFrom: "utterances_fts JOIN utterances u ON u.id = utterances_fts.rowid",
		// 0026: the scope is on the row here, not on a parent, so this WHERE is
		// the only thing between one account's quotes and another's.
		plainFrom: "utterances u", userCond: "u.user_id = ?", plainOrder: "u.created_at DESC, u.id DESC",
	},
}

// hitReq is one section's ask: which columns of the FTS index to match on, what
// the free text is, and any predicate particular to this section (a decade's
// year range, a tag's id, the day a date query names).
type hitReq struct {
	what      string
	ftsCols   string // "" = every indexed column (the cross-column fallback)
	q         string // "" = no FTS at all; read the base table
	extra     string // section predicate, written with a leading " AND "
	extraArgs []any
	order     string // overrides the source's default ordering
	limit     int
}

// facetedHits runs one section's query with the request's facets applied, and
// returns no rows at all when the facets cannot describe this kind of row.
//
// The empty return is the subtle half and it is deliberate: `colour=blue` asks
// for blue things, and a book is not a blue thing, so the books section is
// EMPTY rather than unfiltered. Skipping the query is what stops a facet the
// section cannot honour from quietly widening it back to the whole library.
func facetedHits[T any](s *Server, k rowKind, r hitReq, f searchFacets, uid int64, scan func(*sql.Rows) (T, error)) ([]T, error) {
	fc, fargs, ok := f.where(k, uid)
	if !ok {
		return []T{}, nil
	}
	src := searchSources[k]
	args := make([]any, 0, len(fargs)+len(r.extraArgs)+3)

	var from, where, order, ftsTable string
	if r.q == "" {
		from, where, order = src.plainFrom, src.userCond, src.plainOrder
		args = append(args, uid)
	} else {
		// PhraseQuery, not PrefixQuery: a quoted run is one FTS5 phrase and the
		// loose words keep the typeahead prefix behaviour. A query with no quotes
		// in it produces exactly what PrefixQuery always did.
		match := search.PhraseQuery(r.q)
		if r.ftsCols != "" {
			match = search.ColumnPhraseQuery(r.ftsCols, r.q)
		}
		from = src.ftsFrom
		where = src.ftsTable + " MATCH ? AND " + src.userCond
		order = "bm25(" + src.ftsTable + ")"
		ftsTable = src.ftsTable
		args = append(args, match, uid)
	}
	// Order matters twice over: the facet clause is written before the section's
	// own predicate, so its arguments are bound before them too.
	where += fc
	args = append(args, fargs...)
	if r.extra != "" {
		where += r.extra
		args = append(args, r.extraArgs...)
	}
	if r.order != "" {
		order = r.order
	}
	args = append(args, r.limit)

	return hitQuery(s, ftsTable, r.what, `SELECT `+src.cols+` FROM `+from+
		` WHERE `+where+` ORDER BY `+order+` LIMIT ?`, scan, args...)
}

// facetedCount counts one kind of row under the same facets and section
// predicate facetedHits would apply — so a tag's count never disagrees with the
// quotes listed beneath it.
func (s *Server) facetedCount(k rowKind, extra string, extraArgs []any, f searchFacets, uid int64) (int, error) {
	fc, fargs, ok := f.where(k, uid)
	if !ok {
		return 0, nil
	}
	src := searchSources[k]
	args := make([]any, 0, len(fargs)+len(extraArgs)+1)
	args = append(args, uid)
	args = append(args, fargs...)
	args = append(args, extraArgs...)
	var n int
	err := s.Store.DB.QueryRow(`SELECT count(*) FROM `+src.plainFrom+
		` WHERE `+src.userCond+fc+extra, args...).Scan(&n)
	return n, err
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

// searchDecadeRe matches a decade query: "1990s", "90s", "90's", "380s BCE".
//
// BCE IS HERE BECAUSE THE STATS TIMELINE WRITES IT. That chart labels a decade
// before the common era "380s BCE" and its ticks are now doors into this facet, so
// a form the app itself produces has to be a form this reads — otherwise the one
// column holding the oldest thing in a library is the one that leads nowhere.
// Nothing is titled "380s BCE", so there is no search this takes away.
var searchDecadeRe = regexp.MustCompile(`^(\d{1,4})['’]?s(\s*bce?)?$`)

// parseDecade turns "1990s" / "90s" / "380s BCE" into its year range. Two-digit
// decades map to the 1900s except 00s–20s, which read as the 2000s.
//
// A BCE decade is spoken by the higher absolute year — the 380s BCE runs from 389
// to 380 — so the range is [-389, -380] and the label keeps the era, because
// "380s" and "380s BCE" are two different decades two and a half millennia apart.
// That is also why the two-digit shorthand does not apply here: "80s BCE" would
// have to mean both the 80s BCE and 1980s, and only one of them can win.
func parseDecade(q string) (label string, from, to int, ok bool) {
	m := searchDecadeRe.FindStringSubmatch(strings.ToLower(strings.TrimSpace(q)))
	if m == nil {
		return "", 0, 0, false
	}
	n, _ := strconv.Atoi(m[1])
	bce := m[2] != ""
	if len(m[1]) == 2 && !bce {
		if n <= 20 {
			n += 2000
		} else {
			n += 1900
		}
	}
	n -= n % 10
	if bce {
		if n == 0 {
			return "", 0, 0, false // "0s BCE" is not a decade anyone means
		}
		return strconv.Itoa(n) + "s BCE", -(n + 9), -n, true
	}
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

// taggedWith is the "wears this tag" predicate for one of the three quote kinds,
// written as an EXISTS against the row rather than as a join off the tag table.
//
// It reads the long way round on purpose. Selecting FROM annotation_tags would
// be the obvious shape, but then this section's FROM clause would differ from
// every other section's — and the facet predicates are compiled against the
// aliases in searchSources. Phrasing the tag as a predicate instead means this
// section goes through the SAME builder as the rest, so a facet cannot reach
// fourteen sections and quietly miss this one.
func taggedWith(k rowKind, tagID int64) (string, []any) {
	var join, col string
	switch k {
	case rowAnnotation:
		join, col = "annotation_tags", "annotation_id"
	case rowDialogue:
		join, col = "dialogue_tags", "dialogue_id"
	default:
		join, col = "utterance_tags", "utterance_id"
	}
	self := searchSources[k].self
	return ` AND EXISTS (SELECT 1 FROM ` + join + ` stj WHERE stj.` + col + ` = ` + self +
		`.id AND stj.tag_id = ?)`, []any{tagID}
}

// searchTagFacet finds tags whose name contains every query token and returns
// each with its total use count and a page of the quotes wearing it.
//
// The count is computed under the SAME facets as the listing, so a tag that says
// 40 and shows 10 is showing the first 10 of 40 things you could see — never 10
// of a 40 that included rows the facets excluded.
func (s *Server) searchTagFacet(uid int64, tokens []string, sc searchScope, f searchFacets, limit int) ([]tagHits, error) {
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
		th := tagHits{Name: tr.name, Annotations: []annotationHit{}, Dialogues: []dialogueHit{}, Quotes: []utteranceHit{}}
		if sc.annotations {
			extra, eargs := taggedWith(rowAnnotation, tr.id)
			n, err := s.facetedCount(rowAnnotation, extra, eargs, f, uid)
			if err != nil {
				return nil, err
			}
			th.Count += n
			th.Annotations, err = facetedHits(s, rowAnnotation, hitReq{
				what: "tag annotation", extra: extra, extraArgs: eargs, limit: searchSubLimit,
			}, f, uid, scanAnnotationHit)
			if err != nil {
				return nil, err
			}
		}
		if sc.dialogues {
			extra, eargs := taggedWith(rowDialogue, tr.id)
			n, err := s.facetedCount(rowDialogue, extra, eargs, f, uid)
			if err != nil {
				return nil, err
			}
			th.Count += n
			th.Dialogues, err = facetedHits(s, rowDialogue, hitReq{
				what: "tag dialogue", extra: extra, extraArgs: eargs, limit: searchSubLimit,
			}, f, uid, scanDialogueHit)
			if err != nil {
				return nil, err
			}
		}
		if sc.utterances {
			// The user scope is on the row, not on a parent — see 0026. Both the
			// count and the listing carry it (searchSources.userCond), because a
			// tag id is guessable and the count alone would report how many
			// quotes a stranger filed under it.
			extra, eargs := taggedWith(rowUtterance, tr.id)
			n, err := s.facetedCount(rowUtterance, extra, eargs, f, uid)
			if err != nil {
				return nil, err
			}
			th.Count += n
			th.Quotes, err = facetedHits(s, rowUtterance, hitReq{
				what: "tag quote", extra: extra, extraArgs: eargs, limit: searchSubLimit,
			}, f, uid, scanUtteranceHit)
			if err != nil {
				return nil, err
			}
		}
		// A TAG WITH NOTHING UNDER IT IS NOT A RESULT — the same rule the genre
		// and decade facets below already follow, and the tag facet was the one
		// of the three that did not.
		//
		// It became reachable the moment the count learned about facets: before
		// that a name-matched tag always had rows, and now `q=stoicism` with
		// `colour=blue` finds the tag by name and nothing wearing it. That drew
		// a Tags heading over an empty box, which is bad, and did something
		// worse — `total` counts the GROUPS, so one empty group makes a search
		// that found nothing look like a search that found something, which
		// skips the cross-column fallback and the zero-hit typo pass. A query
		// spanning a quote and its note could go missing entirely because an
		// unrelated row happened to carry a tag whose NAME matched.
		if th.Count > 0 || len(th.Annotations)+len(th.Dialogues)+len(th.Quotes) > 0 {
			out = append(out, th)
		}
	}
	// Most-used first; the name ORDER BY above breaks ties.
	sort.SliceStable(out, func(i, j int) bool { return out[i].Count > out[j].Count })
	return out, nil
}

// inGenre is the "belongs to this genre" predicate, phrased against the work
// rather than as a join off the genre table — see taggedWith for why.
func inGenre(k rowKind, genreID int64) (string, []any) {
	join, col := "book_genres", "book_id"
	if searchSources[k].movieSide {
		join, col = "movie_genres", "movie_id"
	}
	work := searchSources[k].work
	return ` AND EXISTS (SELECT 1 FROM ` + join + ` sgj WHERE sgj.` + col + ` = ` + work +
		`.id AND sgj.genre_id = ?)`, []any{genreID}
}

// searchGenreFacet finds genres whose name contains every query token and
// returns each with a page of its works. Genres with no works in scope are
// dropped (an orphaned genre name is noise, not a result).
func (s *Server) searchGenreFacet(uid int64, tokens []string, sc searchScope, f searchFacets, limit int) ([]genreHits, error) {
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
		if sc.books {
			extra, eargs := inGenre(rowBook, gr.id)
			hits, err := facetedHits(s, rowBook, hitReq{
				what: "genre book", extra: extra, extraArgs: eargs, order: "b.title", limit: searchSubLimit,
			}, f, uid, scanBookHit)
			if err != nil {
				return nil, err
			}
			gh.Books = hits
		}
		if sc.movies {
			extra, eargs := inGenre(rowMovie, gr.id)
			hits, err := facetedHits(s, rowMovie, hitReq{
				what: "genre movie", extra: extra, extraArgs: eargs, order: "m.title", limit: searchSubLimit,
			}, f, uid, scanMovieHit)
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
func (s *Server) searchDecadeFacet(uid int64, label string, from, to int, wantBooks, wantMovies bool, f searchFacets, limit int) (*decadeHits, error) {
	dh := &decadeHits{Label: label, Books: []bookHit{}, Movies: []movieHit{}}
	var err error
	if wantBooks {
		dh.Books, err = facetedHits(s, rowBook, hitReq{
			what: "decade book", extra: " AND b.published_year BETWEEN ? AND ?", extraArgs: []any{from, to},
			order: "b.published_year, b.title", limit: limit,
		}, f, uid, scanBookHit)
		if err != nil {
			return nil, err
		}
	}
	if wantMovies {
		dh.Movies, err = facetedHits(s, rowMovie, hitReq{
			what: "decade movie", extra: " AND m.release_year BETWEEN ? AND ?", extraArgs: []any{from, to},
			order: "m.release_year, m.title", limit: limit,
		}, f, uid, scanMovieHit)
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
func (s *Server) searchDateFacet(uid int64, day string, sc searchScope, f searchFacets, limit int) (*dateHits, error) {
	dh := &dateHits{Date: day, Books: []bookHit{}, Movies: []movieHit{},
		Annotations: []annotationHit{}, Dialogues: []dialogueHit{}, Quotes: []utteranceHit{}}
	// One day, five kinds, one predicate shape — the alias is the only thing
	// that differs, and it comes from the source table rather than being spelled
	// out five times.
	on := func(k rowKind) (string, []any) {
		self := searchSources[k].self
		return " AND substr(" + self + ".created_at, 1, 10) = ?", []any{day}
	}
	var err error
	if sc.books {
		extra, eargs := on(rowBook)
		dh.Books, err = facetedHits(s, rowBook, hitReq{
			what: "date book", extra: extra, extraArgs: eargs, order: "b.created_at", limit: limit,
		}, f, uid, scanBookHit)
		if err != nil {
			return nil, err
		}
	}
	if sc.movies {
		extra, eargs := on(rowMovie)
		dh.Movies, err = facetedHits(s, rowMovie, hitReq{
			what: "date movie", extra: extra, extraArgs: eargs, order: "m.created_at", limit: limit,
		}, f, uid, scanMovieHit)
		if err != nil {
			return nil, err
		}
	}
	if sc.annotations {
		extra, eargs := on(rowAnnotation)
		dh.Annotations, err = facetedHits(s, rowAnnotation, hitReq{
			what: "date annotation", extra: extra, extraArgs: eargs, order: "a.created_at", limit: limit,
		}, f, uid, scanAnnotationHit)
		if err != nil {
			return nil, err
		}
	}
	if sc.dialogues {
		extra, eargs := on(rowDialogue)
		dh.Dialogues, err = facetedHits(s, rowDialogue, hitReq{
			what: "date dialogue", extra: extra, extraArgs: eargs, order: "d.created_at", limit: limit,
		}, f, uid, scanDialogueHit)
		if err != nil {
			return nil, err
		}
	}
	if sc.utterances {
		extra, eargs := on(rowUtterance)
		dh.Quotes, err = facetedHits(s, rowUtterance, hitReq{
			what: "date quote", extra: extra, extraArgs: eargs, order: "u.created_at", limit: limit,
		}, f, uid, scanUtteranceHit)
		if err != nil {
			return nil, err
		}
	}
	if len(dh.Books)+len(dh.Movies)+len(dh.Annotations)+len(dh.Dialogues)+len(dh.Quotes) == 0 {
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
// GET /search?q=&scope=all|books|annotations|movies|dialogues|quotes&limit=
// (PLAN §4, § sectioned search). Results come back faceted by what matched —
// books/movies (title·series), annotations/dialogues (quote),
// quotes (quote·occasion), authors/directors/actors/characters/speakers (credit
// columns),
// notes, tags, genres — plus the
// structured decade ("1990s") and date-added ("2026-07-14") facets. Structured
// filters (tag/color/book_id/movie_id) live on the list endpoints instead —
// not duplicated here (KISS).
func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	// Facets first: an unknown one is a 400 whatever else the request says, and
	// answering a malformed narrowing with results would be answering a
	// different question than the one asked.
	f, ferr := parseSearchFacets(r.URL.Query())
	if ferr != nil {
		writeErr(w, http.StatusBadRequest, ferr.Error())
		return
	}
	// `q` IS NO LONGER REQUIRED — but only when something else narrows. Picking
	// `tag:stoicism` out of the dropdown lifts the words out of the box and into
	// a chip, so the ordinary shape of a chip-built search is an empty box and
	// one parameter. A bare /search with neither is still a 400: it is not a
	// search, it is a request for the whole library.
	if q == "" && !f.any() {
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
	olog.Tracef("[search] handleSearch uid=%d scope=%q q=%q limit=%d facets=%v", uid, scope, q, limit, f.any())
	resp := searchResults{
		Books: []bookHit{}, Annotations: []annotationHit{},
		Movies: []movieHit{}, Dialogues: []dialogueHit{}, Quotes: []utteranceHit{},
		Authors: []authorHits{}, Directors: []directorHits{}, Actors: []actorHits{},
		Characters: []characterHits{}, Speakers: []speakerHits{},
		Notes: noteHits{Annotations: []annotationHit{}, Dialogues: []dialogueHit{}, Quotes: []utteranceHit{}},
		Tags:  []tagHits{}, Genres: []genreHits{},
	}

	sc := parseSearchScope(scope)

	seps := s.creditSeps(uid)

	// Structured facets parse the RAW query only (a date or a decade isn't a
	// typo, so they never join the fuzzy re-run — guarded on whether the query
	// PARSED as one, not on whether it found rows: "80s" with nothing from the
	// 1980s must stay empty, never get "corrected" into "90s").
	parsedStructured := false
	if day, ok := parseAddedDate(q); ok {
		parsedStructured = true
		dh, err := s.searchDateFacet(uid, day, sc, f, limit)
		if err != nil {
			internalError(w, r, "search date added", err)
			return
		}
		if dh != nil {
			resp.DateAdded = dh
		}
	}
	if label, from, to, ok := parseDecade(q); ok {
		parsedStructured = true
		dec, err := s.searchDecadeFacet(uid, label, from, to, sc.books, sc.movies, f, limit)
		if err != nil {
			internalError(w, r, "search decade", err)
			return
		}
		if dec != nil {
			resp.Decade = dec
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

		if sc.books {
			hits, err := facetedHits(s, rowBook, hitReq{what: "book", ftsCols: "title series", q: qq, limit: limit}, f, uid, scanBookHit)
			if err != nil {
				return 0, err
			}
			resp.Books = hits
			total += len(hits)

			// The credit sections are FTS matches on a name column, so they only
			// exist when there is free text to match. A chips-only search has
			// nothing that "matched an author name" — its books arrive in Books.
			resp.Authors = resp.Authors[:0]
			if qq != "" {
				byAuthor, err := facetedHits(s, rowBook, hitReq{what: "author book", ftsCols: "author", q: qq, limit: limit}, f, uid, scanBookHit)
				if err != nil {
					return 0, err
				}
				for _, g := range groupByCredit(byAuthor, func(b bookHit) string { return b.Author }, seps, tokens, limit) {
					resp.Authors = append(resp.Authors, authorHits{Name: g.Name, Books: g.Hits})
				}
			}
			total += len(resp.Authors)
		}

		if sc.annotations {
			// QUOTE AND TRANSLATION IN ONE BUCKET, which is the arrangement 0035 chose
			// for a standalone quote and 0051 extends here: somebody searching a shelf
			// of Bengali highlights for "the thief's mother" is searching the English
			// because the English is the half they can type, and the hit they want back
			// is the highlight — not a "translations" section holding the same card
			// under a second heading.
			hits, err := facetedHits(s, rowAnnotation, hitReq{what: "annotation", ftsCols: "quote translation", q: qq, limit: limit}, f, uid, scanAnnotationHit)
			if err != nil {
				return 0, err
			}
			resp.Annotations = hits
			total += len(hits)

			// Notes is likewise a match on the note COLUMN. With no free text the
			// question "which notes mention this" has no this — `note:yes` is the
			// facet that asks for noted rows, and it narrows the section above.
			resp.Notes.Annotations = []annotationHit{}
			if qq != "" {
				notes, err := facetedHits(s, rowAnnotation, hitReq{what: "annotation note", ftsCols: "note", q: qq, limit: limit}, f, uid, scanAnnotationHit)
				if err != nil {
					return 0, err
				}
				resp.Notes.Annotations = notes
			}
			total += len(resp.Notes.Annotations)
		}

		if sc.movies {
			hits, err := facetedHits(s, rowMovie, hitReq{what: "movie", ftsCols: "title series", q: qq, limit: limit}, f, uid, scanMovieHit)
			if err != nil {
				return 0, err
			}
			resp.Movies = hits
			total += len(hits)

			resp.Directors = resp.Directors[:0]
			if qq != "" {
				byDirector, err := facetedHits(s, rowMovie, hitReq{what: "director movie", ftsCols: "director", q: qq, limit: limit}, f, uid, scanMovieHit)
				if err != nil {
					return 0, err
				}
				for _, g := range groupByCredit(byDirector, func(m movieHit) string { return m.Director }, seps, tokens, limit) {
					resp.Directors = append(resp.Directors, directorHits{Name: g.Name, Movies: g.Hits})
				}
			}
			total += len(resp.Directors)
		}

		if sc.dialogues {
			// THE WORDS ONLY. `character` used to be in this column list, so a
			// character match arrived as a bare line under the film it came from.
			// That was never a decision — it was the absence of the Characters
			// section below, and it made the two credits on a line behave
			// differently for no reason: `actor` has never been indexed here, so
			// searching an actor has always produced an Actors section and an
			// empty Dialogues one.
			//
			// Now both behave the same way. Dialogues answers "these words
			// matched"; Characters answers "this speaker matched". A query that
			// hits both still gets both — they are separate queries and separate
			// sections, so nothing is lost by the split.
			// Quote and translation share one bucket here too — see the annotation
			// section above for the argument.
			hits, err := facetedHits(s, rowDialogue, hitReq{what: "dialogue", ftsCols: "quote translation", q: qq, limit: limit}, f, uid, scanDialogueHit)
			if err != nil {
				return 0, err
			}
			resp.Dialogues = hits
			total += len(hits)

			resp.Actors = resp.Actors[:0]
			resp.Characters = resp.Characters[:0]
			resp.Notes.Dialogues = []dialogueHit{}
			if qq != "" {
				byActor, err := facetedHits(s, rowDialogue, hitReq{what: "actor dialogue", ftsCols: "actor", q: qq, limit: limit}, f, uid, scanDialogueHit)
				if err != nil {
					return 0, err
				}
				for _, g := range groupByCredit(byActor, func(d dialogueHit) string { return d.Actor }, seps, tokens, limit) {
					resp.Actors = append(resp.Actors, actorHits{Name: g.Name, Dialogues: g.Hits})
				}
				// The character is grouped through the SAME helper as every other
				// credit, separators and all, so a two-hander credited
				// "Rosencrantz & Guildenstern" is two names here and two options
				// in the vocabulary — which is the only way `character:` can match
				// either of them.
				byCharacter, err := facetedHits(s, rowDialogue, hitReq{what: "character dialogue", ftsCols: "character", q: qq, limit: limit}, f, uid, scanDialogueHit)
				if err != nil {
					return 0, err
				}
				for _, g := range groupByCredit(byCharacter, func(d dialogueHit) string { return d.Character }, seps, tokens, limit) {
					resp.Characters = append(resp.Characters, characterHits{Name: g.Name, Dialogues: g.Hits})
				}
				noteHitsD, err := facetedHits(s, rowDialogue, hitReq{what: "dialogue note", ftsCols: "note", q: qq, limit: limit}, f, uid, scanDialogueHit)
				if err != nil {
					return 0, err
				}
				resp.Notes.Dialogues = noteHitsD
			}
			total += len(resp.Actors) + len(resp.Characters) + len(resp.Notes.Dialogues)
		}

		if sc.utterances {
			// Quote, occasion and translation share one section, because for a
			// standalone quote they are three halves of the same thing: the words,
			// where they were said, and — for a line not in a language the reader
			// has — what the words mean. There is no separate list of speeches to
			// send them to the way a book title goes to Books.
			//
			// TRANSLATION IS IN THIS BUCKET AND NOT ITS OWN. Somebody searching a
			// shelf of Bengali proverbs for "the thief's mother" is searching the
			// English because the English is the half they can type, and the hit
			// they want back is the proverb — not a "translations" section holding
			// the same card under a second heading. See 0035.
			//
			// The user scope is on the row here (0026), not on a joined parent, so
			// each of these three carries its own WHERE — a missing one is a
			// cross-account leak rather than a hidden row.
			hits, err := facetedHits(s, rowUtterance, hitReq{
				what: "quote", ftsCols: "quote occasion translation", q: qq, limit: limit,
			}, f, uid, scanUtteranceHit)
			if err != nil {
				return 0, err
			}
			resp.Quotes = hits
			total += len(hits)

			resp.Speakers = resp.Speakers[:0]
			resp.Notes.Quotes = []utteranceHit{}
			if qq != "" {
				bySpeaker, err := facetedHits(s, rowUtterance, hitReq{what: "speaker quote", ftsCols: "speaker", q: qq, limit: limit}, f, uid, scanUtteranceHit)
				if err != nil {
					return 0, err
				}
				for _, g := range groupByCredit(bySpeaker, func(u utteranceHit) string { return u.Speaker }, seps, tokens, limit) {
					resp.Speakers = append(resp.Speakers, speakerHits{Name: g.Name, Quotes: g.Hits})
				}
				noteHitsU, err := facetedHits(s, rowUtterance, hitReq{what: "quote note", ftsCols: "note", q: qq, limit: limit}, f, uid, scanUtteranceHit)
				if err != nil {
					return 0, err
				}
				resp.Notes.Quotes = noteHitsU
			}
			total += len(resp.Speakers) + len(resp.Notes.Quotes)
		}

		// Tags + genres match by name (substring, not FTS) but follow the same
		// pass so they benefit from the typo correction too. Both return nothing
		// without free text — there is no name to match — which is right: a
		// chips-only search is not asking "which of my tags is called this".
		if sc.annotations || sc.dialogues || sc.utterances {
			tags, err := s.searchTagFacet(uid, tokens, sc, f, searchSubLimit)
			if err != nil {
				return 0, err
			}
			resp.Tags = tags
			total += len(tags)
		}
		if sc.books || sc.movies {
			genres, err := s.searchGenreFacet(uid, tokens, sc, f, searchSubLimit)
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
		total := 0
		// An empty ftsCols is what makes this the cross-column pass: it matches
		// every indexed column of the row rather than a named few.
		mixed := func(what string) hitReq { return hitReq{what: what, q: qq, limit: limit} }
		var err error
		if sc.books {
			if resp.Books, err = facetedHits(s, rowBook, mixed("book"), f, uid, scanBookHit); err != nil {
				return 0, err
			}
			total += len(resp.Books)
		}
		if sc.annotations {
			if resp.Annotations, err = facetedHits(s, rowAnnotation, mixed("annotation"), f, uid, scanAnnotationHit); err != nil {
				return 0, err
			}
			total += len(resp.Annotations)
		}
		if sc.movies {
			if resp.Movies, err = facetedHits(s, rowMovie, mixed("movie"), f, uid, scanMovieHit); err != nil {
				return 0, err
			}
			total += len(resp.Movies)
		}
		if sc.dialogues {
			if resp.Dialogues, err = facetedHits(s, rowDialogue, mixed("dialogue"), f, uid, scanDialogueHit); err != nil {
				return 0, err
			}
			total += len(resp.Dialogues)
		}
		if sc.utterances {
			if resp.Quotes, err = facetedHits(s, rowUtterance, mixed("quote"), f, uid, scanUtteranceHit); err != nil {
				return 0, err
			}
			total += len(resp.Quotes)
		}
		return total, nil
	}

	// runBoth: the faceted pass, then the cross-column fallback if it drew blank.
	//
	// The fallback is skipped without free text. Its whole job is to catch a
	// query whose words span two columns of one row ("casab mich"), and with no
	// query there are no words to span — it would re-run the SAME facet-only
	// queries the pass above already ran and overwrite them with themselves.
	runBoth := func(qq string) (int, error) {
		total, err := runPass(qq)
		if err != nil || total > 0 || qq == "" {
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
	if total == 0 && !parsedStructured {
		if corrected := s.fuzzyCorrect(q, sc); corrected != "" {
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
	if sc.books || sc.annotations {
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
	if sc.movies || sc.dialogues {
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

	// Every dialogue hit gets its characters' pictures here, in one query, after
	// the sections are assembled — see search_character_images.go for why it is one
	// pass at the end rather than six inside the section builders.
	s.fillSearchCharacterImages(uid, &resp)

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
func (s *Server) fuzzyCorrect(q string, sc searchScope) string {
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
		{sc.books, "books_fts_vocab", "books_fts"},
		{sc.annotations, "annotations_fts_vocab", "annotations_fts"},
		{sc.movies, "movies_fts_vocab", "movies_fts"},
		{sc.dialogues, "dialogues_fts_vocab", "dialogues_fts"},
		{sc.utterances, "utterances_fts_vocab", "utterances_fts"},
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
