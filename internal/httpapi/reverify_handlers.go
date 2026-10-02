package httpapi

import (
	"bytes"
	"cmp"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"tippani/internal/jobs"
	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
)

// Force-fetch & re-verify (ROADMAP §2): a deliberate "re-check everything"
// pass over a SELECTION of books, movies/shows and saved people. The preview
// (POST /metadata/reverify) re-runs each item's lookup against the live
// sources — targeting the PINNED identity ids (isbn/asin/google_id,
// tmdb_id/tvdb_id, people.source_id / the stored cast) so it re-checks the
// same entity instead of re-guessing by name — and returns per-field diffs
// WITHOUT writing anything. The apply (POST /metadata/reverify/apply) writes
// only the fields the user approved, resending the previewed values (the same
// trust boundary as the existing PUT edit surface: whitelisted fields, the
// same validators, ownership-scoped SQL).
//
// The ROUTES are stateless by design: no server-side diff session — the caller
// holds the preview and sends back exactly what the user saw and ticked.
// requireAuth (not admin): both endpoints touch only the caller's own rows, like
// /books/lookup and /people/portrait; the per-call item cap bounds provider
// load, and an API caller slices a large selection into batches under it. The
// app's own dialog stopped looping them in 3.1.0: its check and its apply are
// the reverify and reverify-apply jobs (runReverify, runReverifyApply), which
// call the same functions an item at a time, five hundred items a job, and keep
// the check's preview as the job's result for the review to read back.

// maxReverifyItems caps one preview/apply call. An API caller chunks above this;
// the jobs have their own cap (maxReverifyPerJob).
const maxReverifyItems = 15

// fieldAlt is one supplier's answer for one field.
//
// THE POINT OF THE WHOLE CHANGE. A work pinned to two suppliers used to be read
// from one of them, chosen for the ENTIRE record by a single switch, so "take the
// description from TheTVDB and the franchise from TMDB" was not expressible — and
// the reader could not even see that the two disagreed. Every supplier the work
// is pinned to now answers, and each field carries what each of them said.
type fieldAlt struct {
	Source   string `json:"source"`
	SourceID string `json:"source_id,omitempty"`
	Value    any    `json:"value"`
}

type fieldDiff struct {
	Field  string `json:"field"`
	Stored any    `json:"stored"`
	// Fresh is the PREFERRED supplier's answer and stays for two reasons: it is
	// the default pick, so a reader who ticks a field without opening the choice
	// gets what they used to get; and it is what every existing client and test
	// reads. Alts[0] is ordinarily the same supplier's answer, the same value
	// but for the surrounding space a diff trims from text — which is why a
	// check job keeps one of the two only where they are equal (keptDiff).
	Fresh any        `json:"fresh"`
	Alts  []fieldAlt `json:"alts,omitempty"`
}

// altsFor builds the per-source list for one field from what each supplier
// returned, in preference order, dropping the ones with nothing to say.
//
// A SUPPLIER WITH NO ANSWER IS NOT AN OPTION. An empty description offered as
// "TMDB says: (nothing)" is a choice that can only make the record worse, and it
// would put a supplier's name against a value it never supplied. Suppliers that
// agree are kept separately: the reader is choosing a SOURCE as much as a value,
// and collapsing two agreeing suppliers into one row would hide that both back
// it — which is the strongest reason to accept a value there is.
func altsFor(fetched []fetchedSource, pick func(*metadata.MovieDetails) any) []fieldAlt {
	var out []fieldAlt
	for _, f := range fetched {
		v := pick(f.Det)
		if isEmptyValue(v) {
			continue
		}
		out = append(out, fieldAlt{Source: f.Source, SourceID: f.SourceID, Value: v})
	}
	return out
}

// isEmptyValue reports whether a supplier actually answered. Typed rather than
// reflective because the diff carries exactly these shapes, and an unrecognised
// type answers "not empty" so the failure direction is to offer a choice rather
// than to silently drop one.
func isEmptyValue(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(x) == ""
	case int:
		return x == 0
	case int64:
		return x == 0
	case float64:
		return x == 0
	case []string:
		return len(x) == 0
	case []metadata.CastMember:
		return len(x) == 0
	}
	return false
}

// fetchedSource is one supplier's whole answer about a work, kept so that every
// field can be asked of every supplier without re-fetching.
type fetchedSource struct {
	Source   string
	SourceID string
	Det      *metadata.MovieDetails
}

// reverifyItem statuses: "ok" (checked; Diffs empty = up to date),
// "unpinned" (no identity id to target — use Look up to pin it first),
// "fetch_failed" (the provider call failed; Error carries a short hint),
// "not_found" (not the caller's row — indistinguishable from missing).
type reverifyItem struct {
	Type   string `json:"type"` // "book" | "movie" | "person"
	ID     int64  `json:"id,omitempty"`
	Kind   string `json:"kind,omitempty"` // person only: author | actor
	Name   string `json:"name,omitempty"` // person only
	Title  string `json:"title,omitempty"`
	Status string `json:"status"`
	Source string `json:"source,omitempty"` // the PREFERRED provider — the one Fresh came from
	// Every supplier that answered, in preference order. The reader picks per
	// field from these; Source is Sources[0].
	Sources []string    `json:"sources,omitempty"`
	Diffs   []fieldDiff `json:"diffs"`
	// Offers is what every supplier has to say about every field, asked for by
	// the `offers` flag and absent otherwise. It is NOT a subset or a superset of
	// Diffs: a field can be offered without differing (the tag says TMDB because
	// TMDB wrote it, and TheTVDB still has another answer) and can differ without
	// being offered (a cast list, which is a panel and not a row). See
	// field_offers.go for why the two questions cannot share one answer.
	Offers []fieldDiff `json:"offers,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// handleMetadataReverify: POST /metadata/reverify
// {book_ids?, movie_ids?, people?: [{kind,name}]} → {items, checked, changed}.
// Read-only: nothing is written; the client presents the diffs for approval.
func (s *Server) handleMetadataReverify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BookIDs  []int64 `json:"book_ids"`
		MovieIDs []int64 `json:"movie_ids"`
		People   []struct {
			Kind string `json:"kind"`
			Name string `json:"name"`
		} `json:"people"`
		// Offers asks each item for what every supplier says about every field,
		// not only about the fields that differ. Sent by the Details field
		// picker, which is asking a different question — see field_offers.go —
		// and by nothing else, so the reviewer and the filler carry no extra
		// payload for a list they never read.
		Offers bool `json:"offers"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	total := len(req.BookIDs) + len(req.MovieIDs) + len(req.People)
	if total == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to re-verify — pass book_ids, movie_ids or people")
		return
	}
	if total > maxReverifyItems {
		writeErr(w, http.StatusBadRequest, "too many items per call (max 15) — send smaller batches")
		return
	}
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataReverify uid=%d books=%d movies=%d people=%d",
		uid, len(req.BookIDs), len(req.MovieIDs), len(req.People))

	keys, _ := s.providerKeys() // a failed read is logged there, and the check goes on with what was read

	ctx := r.Context()
	items := []reverifyItem{}
	for _, id := range req.BookIDs {
		items = append(items, s.reverifyBook(ctx, uid, id, keys.googleBooks, keys.amazonCookie, keys.amazonDomain, req.Offers))
	}
	for _, id := range req.MovieIDs {
		items = append(items, s.reverifyMovie(ctx, uid, id, keys.tmdb, keys.tvdb, keys.igdb, req.Offers))
	}
	for _, p := range req.People {
		items = append(items, s.reverifyPerson(ctx, uid, strings.TrimSpace(p.Kind), strings.TrimSpace(p.Name)))
	}
	changed := 0
	for _, it := range items {
		if it.Status == "ok" && len(it.Diffs) > 0 {
			changed++
		}
	}
	// A check of one item is about that item; a check of several is about as
	// many things, which the Jobs tab counts itself.
	if len(items) == 1 {
		jobSubject(r.Context(), cmp.Or(items[0].Title, items[0].Name))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "checked": len(items), "changed": changed})
}

// runReverify is the reverify job: the check POST /metadata/reverify makes,
// item by item, for as many items as one job holds, with a line in its log for
// each. Its result is the preview's items, for the review to read back later
// (GET /jobs/{id}/result, reviewReverify), and it never writes: the review
// decides, and the apply writes.
//
// FILLS ONLY IS APPLIED HERE, AS THE REVIEW DID IN THE BROWSER: a diff whose
// stored side is empty is kept and every other one dropped, before the item is
// kept, so an item whose every diff would overwrite something reads as up to
// date rather than as an empty expander — and a check of a hundred works does
// not store the overwrites nobody asked to see.
//
// WHAT IT KEEPS IS BOUNDED BY WHAT ONE JOB MAY KEEP (jobs.MaxResult), and by
// bytes, as it goes. Five hundred items is the cap on what a check is given, not
// on what it finds: five hundred films whose casts the reader edited differ in
// the cast on every one, by design, and with two suppliers each cast is in its
// diff three times over. Stored once at the end, such a check came to more than
// a job may hold, the store refused it, and all five hundred lookups were lost —
// and a rerun lost them the same way. So each item is measured as it is kept,
// and when the next would not fit the check stops there: what it found so far is
// kept, the review opens on it, and the log says which items are not in it.
//
// A STOP KEEPS NO HALF-CHECKED ITEM (job_stop.go). An item whose lookup ended
// with the job's context ended is left out of the findings, though one supplier
// had answered: a diff from half the suppliers is not what the review is for.
// What was checked before the Stop is kept, and reviewed like any check's.
func runReverify(s *Server, ctx context.Context, j *jobs.Job) error {
	var p struct {
		BookIDs   []int64       `json:"book_ids"`
		MovieIDs  []int64       `json:"movie_ids"`
		People    []reverifyAsk `json:"people"`
		FillsOnly bool          `json:"fills_only"`
	}
	if err := j.Params(&p); err != nil {
		return err
	}
	uid := j.Owner().UserID
	keys, err := s.providerKeys()
	if err != nil {
		j.Log(jobs.LevelWarn, "a saved supplier key could not be read, so the lookups ask without it: %v", err)
	}
	checks := make([]func() reverifyItem, 0, len(p.BookIDs)+len(p.MovieIDs)+len(p.People))
	for _, id := range p.BookIDs {
		checks = append(checks, func() reverifyItem {
			return s.reverifyBook(ctx, uid, id, keys.googleBooks, keys.amazonCookie, keys.amazonDomain, false)
		})
	}
	for _, id := range p.MovieIDs {
		checks = append(checks, func() reverifyItem { return s.reverifyMovie(ctx, uid, id, keys.tmdb, keys.tvdb, keys.igdb, false) })
	}
	for _, who := range p.People {
		checks = append(checks, func() reverifyItem { return s.reverifyPerson(ctx, uid, who.Kind, who.Name) })
	}
	// The items as the job keeps them, and what they come to: the brackets, and
	// each item with the comma before it.
	items, size := []json.RawMessage{}, len("[]")
	for i, check := range checks {
		if !s.goOn(j, i) {
			break
		}
		it := check()
		if ctx.Err() != nil {
			abandoned(j, itemName(it.Type, it.ID, cmp.Or(it.Title, it.Name)))
			break
		}
		if p.FillsOnly {
			kept := []fieldDiff{}
			for _, d := range it.Diffs {
				if isEmptyValue(d.Stored) {
					kept = append(kept, d)
				}
			}
			it.Diffs = kept
		}
		b, err := keptReverifyItem(it)
		if err != nil {
			return err
		}
		if size+1+len(b) > jobs.MaxResult {
			j.Log(jobs.LevelWarn, "the findings reached what one check can keep (%d MB), so the last %d of its %d items, from %s on, are not in them — check those again in a smaller selection",
				jobs.MaxResult>>20, len(checks)-i, len(checks), itemName(it.Type, it.ID, cmp.Or(it.Title, it.Name)))
			break
		}
		size += 1 + len(b)
		level, line := reverifyLine(it)
		j.Log(level, "%s", line)
		items = append(items, b)
		j.Progress(i+1, len(checks))
	}
	return j.SetResult(items)
}

// keptDiff is a diff as a check job keeps it: without Fresh when Fresh is what
// the first supplier in Alts says, which it is whenever a diff has alternatives
// (fieldDiff) — compared here rather than trusted, so a diff whose two differ
// keeps both. The review puts it back (reviewReverify), so the screen reads the
// diff it always read. A cast is the largest value a diff holds, and in a diff
// with two suppliers it is there four times: stored, fresh and each supplier's;
// the copy that says nothing the others do not is the one not kept.
type keptDiff struct {
	fieldDiff
	Fresh json.RawMessage `json:"fresh,omitempty"` // absent: alts[0].value
}

// keptItem is a preview item as a check job keeps it: its diffs as keptDiffs.
type keptItem struct {
	reverifyItem
	Diffs []keptDiff `json:"diffs"`
}

// keptReverifyItem is it as a check job keeps it, as JSON.
func keptReverifyItem(it reverifyItem) ([]byte, error) {
	k := keptItem{reverifyItem: it, Diffs: make([]keptDiff, 0, len(it.Diffs))}
	for _, d := range it.Diffs {
		fresh, err := json.Marshal(d.Fresh)
		if err != nil {
			return nil, err
		}
		if len(d.Alts) > 0 {
			first, err := json.Marshal(d.Alts[0].Value)
			if err != nil {
				return nil, err
			}
			if bytes.Equal(first, fresh) {
				fresh = nil
			}
		}
		k.Diffs = append(k.Diffs, keptDiff{fieldDiff: d, Fresh: fresh})
	}
	return json.Marshal(k)
}

// reverifyLine is a check's line for one item: what differs, or why nothing
// could be compared.
func reverifyLine(it reverifyItem) (level, line string) {
	name := itemName(it.Type, it.ID, it.Title)
	switch {
	case it.Status == "not_found":
		return jobs.LevelWarn, name + " — not found"
	case it.Status == "unpinned":
		return jobs.LevelInfo, name + " — unpinned, so there is nothing to ask: " + it.Error
	case it.Status != "ok":
		return jobs.LevelWarn, name + " — failed: " + it.Error
	case len(it.Diffs) > 0:
		fields := make([]string, 0, len(it.Diffs))
		for _, d := range it.Diffs {
			fields = append(fields, d.Field)
		}
		return jobs.LevelInfo, name + " — " + countOf(len(it.Diffs), "difference", "differences") + ": " + fieldWords(fields)
	case it.Error != "":
		return jobs.LevelInfo, name + " — " + it.Error
	}
	return jobs.LevelInfo, name + " — up to date"
}

// itemGenreNames reads ONE item's stored genre names (kind = "book" |
// "movie"); empty on any error — a genre read miss must not fail a preview.
// (genreNames in book_handlers.go is the all-items map for list endpoints.)
func (s *Server) itemGenreNames(kind string, id int64) []string {
	out := []string{}
	rows, err := s.Store.DB.Query(
		`SELECT g.name FROM `+kind+`_genres x JOIN genres g ON g.id = x.genre_id
		 WHERE x.`+kind+`_id = ? ORDER BY g.name`, id)
	if err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre read failed: %v", err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre row scan failed: %v", err)
			continue
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		olog.Warnf(olog.CodeMetaRowScan, "[meta] re-verify genre row iteration failed: %v", err)
	}
	return out
}

// diffStr appends a diff when the fresh string is non-empty and differs from
// the field as stored — st, the row's fields as a diff carries them
// (storedBookFields, storedMovieFields), its text already without its
// surrounding space.
func diffStr(diffs []fieldDiff, st map[string]any, field, fresh string) []fieldDiff {
	fresh = strings.TrimSpace(fresh)
	stored, _ := st[field].(string)
	if fresh == "" || fresh == stored {
		return diffs
	}
	return append(diffs, fieldDiff{Field: field, Stored: stored, Fresh: fresh})
}

// sameGenreSet compares genre lists case-insensitively as sets.
func sameGenreSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]bool, len(a))
	for _, g := range a {
		set[strings.ToLower(strings.TrimSpace(g))] = true
	}
	for _, g := range b {
		if !set[strings.ToLower(strings.TrimSpace(g))] {
			return false
		}
	}
	return true
}

// reverifyLookupError turns a provider failure into a short, non-leaking hint
// (the full cause goes to the log under TIP-META-011, unless the offline switch
// refused the call: logOutwardFailure).
func reverifyLookupError(what string, err error) string {
	logOutwardFailure(olog.CodeMetaReverifyFetch, err, "[meta] re-verify %s lookup failed: %v", what, err)
	if errors.Is(err, metadata.ErrQuota) {
		return "Google Books' shared quota is used up — add a free key in Metadata › Sources"
	}
	return "lookup failed — try again in a moment"
}

// storedBook is a book as a re-verify reads it from the database: what the check
// compares the suppliers' answers with, and what a review opened later reads
// again (reviewReverify) to see whether it has changed since.
type storedBook struct {
	title, author, isbn, asin, googleID, desc, series, cover string
	subtitle, publisher                                      string
	year, pages                                              int
	seriesIdx                                                float64
	genres                                                   []string
}

// readStoredBook reads book id of uid's; sql.ErrNoRows when uid has no such book.
func (s *Server) readStoredBook(uid, id int64) (storedBook, error) {
	var b storedBook
	err := s.Store.DB.QueryRow(`
		SELECT title, COALESCE(author,''), COALESCE(isbn,''), COALESCE(asin,''), COALESCE(google_id,''),
		       COALESCE(description,''), COALESCE(published_year,0), COALESCE(series,''),
		       COALESCE(series_index,0), COALESCE(cover_path,''),
		       subtitle, publisher, pages
		FROM books WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&b.title, &b.author, &b.isbn, &b.asin, &b.googleID, &b.desc, &b.year, &b.series, &b.seriesIdx, &b.cover,
			&b.subtitle, &b.publisher, &b.pages)
	if err != nil {
		return b, err
	}
	b.genres = s.itemGenreNames("book", id)
	return b, nil
}

// storedBookFields is b's fields as a re-verify's diffs carry them in stored:
// text without its surrounding space, the ISBN normalised, the rest as read.
//
// ONE READER FOR BOTH SIDES. The check takes each diff's stored side from here,
// and the review opened later (reviewReverify) and the apply's expect check
// (applyReverifyItem) read the field again through here, to ask whether it has
// changed since. Two formattings of the same value — the check trimming a title
// and the review not, say — would read every such field as changed, and every
// apply would leave every field as "changed since the check", with nothing
// wrong but the format.
func storedBookFields(b storedBook) map[string]any {
	trim := strings.TrimSpace
	return map[string]any{
		"title": trim(b.title), "author": trim(b.author), "description": trim(b.desc),
		"published_year": b.year, "genres": b.genres, "series": trim(b.series),
		"series_index": b.seriesIdx, "isbn": metadata.NormalizeISBN(b.isbn),
		"subtitle": trim(b.subtitle), "publisher": trim(b.publisher), "pages": b.pages,
		"cover": b.cover,
	}
}

func (s *Server) reverifyBook(ctx context.Context, uid, id int64, gkey, cookie, domain string, withOffers bool) reverifyItem {
	it := reverifyItem{Type: "book", ID: id, Status: "ok", Diffs: []fieldDiff{}}
	b, err := s.readStoredBook(uid, id)
	if errors.Is(err, sql.ErrNoRows) {
		it.Status = "not_found"
		return it
	}
	if err != nil {
		olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify book %d read failed: %v", id, err)
		it.Status, it.Error = "fetch_failed", "could not read this book — try again"
		return it
	}
	title, author, isbn, asin, googleID, desc := b.title, b.author, b.isbn, b.asin, b.googleID, b.desc
	series, cover, subtitle, publisher := b.series, b.cover, b.subtitle, b.publisher
	year, pages, seriesIdx, genres := b.year, b.pages, b.seriesIdx, b.genres
	it.Title = title
	st := storedBookFields(b)

	// Identity ladder — the pinned id decides which live source answers.
	// (openlibrary_id alone is deliberately not re-checked: OL work records
	// have poor field parity, so an OL-only book reads as unpinned.)
	isbnN := metadata.NormalizeISBN(isbn)
	var cand *metadata.BookCandidate
	// EVERY SUPPLIER THAT ANSWERED, not just the winner. An ISBN search already
	// asks Google Books, Open Library and Amazon and merges what comes back — the
	// answers were being thrown away one line after they arrived, so a book has
	// had multi-source data available for as long as it has had a lookup, and no
	// way to see or use it.
	var alt []metadata.BookCandidate
	switch {
	case isbnN != "":
		cs, lerr := s.searchBooks(ctx, isbnN, "", "", gkey)
		s.recordBooksLookup(ctx, cs, lerr)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book isbn", lerr)
			return it
		}
		if len(cs) > 0 {
			cand = &cs[0]
			alt = cs
		}
	case asin != "" && cookie != "":
		a, lerr := metadata.FetchAmazonBook(ctx, asin, cookie, domain)
		s.recordAsk(ctx, faultAreaBooks, "amazon", one(a != nil), "", lerr)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book asin", lerr)
			return it
		}
		cand = a
		alt = []metadata.BookCandidate{*a}
	case googleID != "":
		g, lerr := s.googleVolume(ctx, googleID, gkey)
		s.recordAsk(ctx, faultAreaBooks, "google", one(g != nil), "", lerr)
		if lerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("book google_id", lerr)
			return it
		}
		cand = g
		alt = []metadata.BookCandidate{*g}
	case asin != "":
		// Pinned by ASIN, but the Amazon source needs its cookie — say so
		// instead of the misleading "no pinned identity".
		it.Status = "fetch_failed"
		it.Error = "this book is pinned by ASIN — Amazon lookups need the cookie in Metadata › Sources"
		return it
	default:
		it.Status = "unpinned"
		it.Error = "no re-checkable identity (isbn, asin or google id) — use Look up to re-pin this book first"
		return it
	}
	if cand == nil {
		it.Status = "fetch_failed"
		it.Error = "the source no longer returns this identity"
		return it
	}
	it.Source = cand.Source
	bookSrcs := dedupeBookSources(alt)
	it.Sources = make([]string, 0, len(bookSrcs))
	for _, b := range bookSrcs {
		it.Sources = append(it.Sources, b.Source)
	}

	d := it.Diffs
	d = diffStr(d, st, "title", cand.Title)
	d = diffStr(d, st, "author", cand.Author)
	d = diffStr(d, st, "description", cand.Description)
	if cand.PublishedYear != 0 && cand.PublishedYear != year {
		d = append(d, fieldDiff{Field: "published_year", Stored: st["published_year"], Fresh: cand.PublishedYear})
	}
	// Genres: candidate capped at 5 (same cap as the covers refetch), compared
	// as a case-insensitive set after the canonical title-casing.
	if len(cand.Genres) > 0 {
		fresh := cappedGenres(cand.Genres)
		if !sameGenreSet(genres, fresh) {
			d = append(d, fieldDiff{Field: "genres", Stored: st["genres"], Fresh: fresh})
		}
	}
	d = diffStr(d, st, "series", cand.Series)
	if cand.SeriesIndex != 0 && cand.SeriesIndex != seriesIdx {
		d = append(d, fieldDiff{Field: "series_index", Stored: st["series_index"], Fresh: cand.SeriesIndex})
	}
	if cand.ISBN13 != "" && cand.ISBN13 != isbnN {
		d = append(d, fieldDiff{Field: "isbn", Stored: st["isbn"], Fresh: cand.ISBN13})
	}
	// 0061's three. diffStr already declines to offer a blank fresh value over a
	// stored one, which is the rule that matters here: Open Library's work record
	// often has no publisher for a book Google knows the imprint of, and a
	// re-verify must not offer to erase what is there.
	d = diffStr(d, st, "subtitle", cand.Subtitle)
	d = diffStr(d, st, "publisher", cand.Publisher)
	if cand.Pages != 0 && cand.Pages != pages {
		d = append(d, fieldDiff{Field: "pages", Stored: st["pages"], Fresh: cand.Pages})
	}
	// Cover: offered when the fresh source has art AND the stored one is
	// missing or below the low-res threshold — a good stored cover is never
	// churned. Stored = the local file (client renders it), fresh = the URL.
	if cand.CoverURL != "" && (cover == "" || s.coverWidth(cover) < lowResCoverWidth) {
		d = append(d, fieldDiff{Field: "cover", Stored: st["cover"], Fresh: cand.CoverURL})
	}
	// Same rule as a film's, and the same reason for doing it here rather than
	// inside each comparison: whether a field DIFFERS from what is stored is a
	// separate question from what the alternatives are.
	if len(bookSrcs) > 1 {
		attachBookAlts(d, bookSrcs)
	}
	it.Diffs = d
	// WHAT IS ON OFFER, which is not what has changed. One supplier is enough
	// here, unlike the alts above: the choice a field picker draws is between the
	// stored value and a supplier's, so a single supplier still gives the reader
	// something to take.
	if withOffers {
		it.Offers = offersFrom(map[string]any{
			"title": title, "author": author, "description": desc,
			"published_year": year, "series": series, "series_index": seriesIdx,
			"genres": genres, "subtitle": subtitle, "publisher": publisher, "pages": pages,
		}, pickerFields(bookAltPickers), func(f string) []fieldAlt {
			return bookAltsFor(bookSrcs, bookAltPickers[f])
		})
	}
	return it
}

// dedupeBookSources keeps the first candidate from each supplier, in the order
// the merged lookup returned them.
//
// FIRST-PER-SUPPLIER RATHER THAN ALL, because an ISBN search can return more than
// one row from the same provider — a different edition, a reissue — and offering
// "Google Books says…" twice with different answers is not a choice between
// SOURCES, which is what the reader is being asked to make. The lookup already
// ranks, so the first from each is the one it thinks is right.
func dedupeBookSources(cs []metadata.BookCandidate) []metadata.BookCandidate {
	seen := map[string]bool{}
	out := make([]metadata.BookCandidate, 0, len(cs))
	for _, c := range cs {
		src := strings.TrimSpace(c.Source)
		if src == "" || seen[src] {
			continue
		}
		seen[src] = true
		out = append(out, c)
	}
	return out
}

// bookAltPickers is movieAltPickers' counterpart. Separate table, same rule: a
// field in the diff list and its alternatives must not be able to drift apart.
var bookAltPickers = map[string]func(*metadata.BookCandidate) any{
	"title":          func(c *metadata.BookCandidate) any { return c.Title },
	"author":         func(c *metadata.BookCandidate) any { return c.Author },
	"description":    func(c *metadata.BookCandidate) any { return c.Description },
	"published_year": func(c *metadata.BookCandidate) any { return c.PublishedYear },
	"series":         func(c *metadata.BookCandidate) any { return c.Series },
	"series_index":   func(c *metadata.BookCandidate) any { return c.SeriesIndex },
	"genres":         func(c *metadata.BookCandidate) any { return cappedGenres(c.Genres) },
	"cover":          func(c *metadata.BookCandidate) any { return c.CoverURL },
	"subtitle":       func(c *metadata.BookCandidate) any { return c.Subtitle },
	"publisher":      func(c *metadata.BookCandidate) any { return c.Publisher },
	"pages":          func(c *metadata.BookCandidate) any { return c.Pages },
	// isbn is absent for the reason tmdb_id is on the film side: it is the
	// identity the lookup was made BY, so every supplier necessarily agrees.
}

// bookAltsFor is altsFor for the book side, whose suppliers arrive as candidates
// rather than as fetchedSources. Extracted from attachBookAlts when the offers
// pass needed the same loop: two copies of "ask every supplier for one field"
// is the drift the picker tables exist to prevent.
func bookAltsFor(cands []metadata.BookCandidate, pick func(*metadata.BookCandidate) any) []fieldAlt {
	var out []fieldAlt
	for j := range cands {
		v := pick(&cands[j])
		if isEmptyValue(v) {
			continue
		}
		out = append(out, fieldAlt{Source: cands[j].Source, Value: v})
	}
	return out
}

func attachBookAlts(diffs []fieldDiff, cands []metadata.BookCandidate) {
	for i := range diffs {
		pick, ok := bookAltPickers[diffs[i].Field]
		if !ok {
			continue
		}
		alts := bookAltsFor(cands, pick)
		if len(alts) < 2 {
			continue
		}
		diffs[i].Alts = alts
	}
}

// storedMovie is a film or show as a re-verify reads it (storedBook says why it
// is its own read). The cast is read apart, by loadCastMembers, which the check
// and the review share too.
type storedMovie struct {
	title, director, desc, mediaType, series, poster, fandomWiki string
	year                                                         int
	tmdbID, tvdbID, igdbID                                       int64
	genres                                                       []string
}

// readStoredMovie reads film id of uid's; sql.ErrNoRows when uid has no such film.
func (s *Server) readStoredMovie(uid, id int64) (storedMovie, error) {
	var m storedMovie
	err := s.Store.DB.QueryRow(`
		SELECT title, COALESCE(director,''), COALESCE(release_year,0), COALESCE(description,''),
		       COALESCE(media_type,'movie'), COALESCE(series,''), COALESCE(tmdb_id,0), COALESCE(tvdb_id,0),
		       COALESCE(igdb_id,0), COALESCE(poster_path,''), COALESCE(fandom_wiki,'')
		FROM movies WHERE id = ? AND user_id = ?`, id, uid).
		Scan(&m.title, &m.director, &m.year, &m.desc, &m.mediaType, &m.series, &m.tmdbID, &m.tvdbID, &m.igdbID, &m.poster, &m.fandomWiki)
	if err != nil {
		return m, err
	}
	m.genres = s.itemGenreNames("movie", id)
	return m, nil
}

// storedMovieFields is m's fields as a re-verify's diffs carry them in stored,
// read by the check and the review alike (storedBookFields says why it is one
// reader). The cast is not among them: it is its own read (loadCastMembers),
// which the check and the review share as it is.
func storedMovieFields(m storedMovie) map[string]any {
	trim := strings.TrimSpace
	return map[string]any{
		"title": trim(m.title), "director": trim(m.director), "description": trim(m.desc),
		"release_year": m.year, "genres": m.genres, "series": trim(m.series),
		"poster": m.poster, "tmdb_id": m.tmdbID, "tvdb_id": m.tvdbID, "igdb_id": m.igdbID,
	}
}

func (s *Server) reverifyMovie(ctx context.Context, uid, id int64, tmdb *metadata.TMDB, tvdb *metadata.TVDB, igdb *metadata.IGDB, withOffers bool) reverifyItem {
	it := reverifyItem{Type: "movie", ID: id, Status: "ok", Diffs: []fieldDiff{}}
	m, err := s.readStoredMovie(uid, id)
	if errors.Is(err, sql.ErrNoRows) {
		it.Status = "not_found"
		return it
	}
	if err != nil {
		olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify movie %d read failed: %v", id, err)
		it.Status, it.Error = "fetch_failed", "could not read this title — try again"
		return it
	}
	title, director, desc, mediaType, series, poster, fandomWiki := m.title, m.director, m.desc, m.mediaType, m.series, m.poster, m.fandomWiki
	year, tmdbID, tvdbID, igdbID, genres := m.year, m.tmdbID, m.tvdbID, m.igdbID, m.genres
	it.Title = title
	st := storedMovieFields(m)

	// A GAME IS IGDB'S, AND ONE WITH NO ID IS LOOKED FOR THERE. The owner, over a
	// fill that said «The Witcher 3: Wild Hunt» had "no pinned identity (TMDB/TheTVDB
	// id)": "This is a game. Why should there be a pinned identity in TMDB and TVDB?
	// This is supposed to be searched in IGDB and resolved there." This path read a
	// film's two ids and never a game's, so every game ended unpinned, a game added
	// from IGDB included.
	//
	// A FILM WITH NO ID IS STILL NEVER GUESSED BY NAME, and a game is resolved only
	// when the guess is not one: IGDB's search is asked, and the id is taken when
	// exactly one game there is called exactly this (and came out in its year, when
	// the work has one). Several of that name, or none, is said in words and left to
	// Look up. The id the search found is offered back as a diff like any other
	// field, so a fill writes it and the next run asks IGDB by id.
	if mediaType == "game" && igdbID == 0 && tmdbID == 0 && tvdbID == 0 {
		if igdb == nil {
			it.Status = "unpinned"
			it.Error = "games are looked up in IGDB, which needs its client id and secret — add them in Metadata › Sources"
			return it
		}
		found, why, rerr := s.resolveGameByTitle(ctx, uid, id, igdb, title, year)
		if rerr != nil {
			it.Status, it.Error = "fetch_failed", reverifyLookupError("game search", rerr)
			return it
		}
		if found == 0 {
			it.Status, it.Error = "unpinned", why
			return it
		}
		igdbID = found
	}

	// EVERY SUPPLIER THIS WORK IS PINNED TO, not just the winning one.
	//
	// The preferred source still leads and is still what `Fresh` carries, so a
	// reader who ticks a field without opening the choice gets exactly what they
	// got before. What is new is that the others are ASKED, so a field can offer
	// what each of them says and the reader can take the description from one and
	// the franchise from another.
	//
	// A SECOND REQUEST IS THE PRICE AND IT IS PAID ONLY WHEN IT BUYS SOMETHING: a
	// title pinned to one supplier, or on an install with one key, fetches once
	// exactly as before. Bounded by the same 15-item cap the route already has.
	//
	// ONE SUPPLIER FAILING IS NOT THE ITEM FAILING. If TheTVDB is down and TMDB
	// answers, the reader gets TMDB's values rather than an error — which is the
	// same best-effort rule the picture ladder and the catalogue lookups follow.
	// It is only fetch_failed when NOBODY answered.
	fetched, lerr := s.fetchAllMovieSources(ctx, uid, id, mediaType, title, fandomWiki, series, tmdbID, tvdbID, igdbID, tmdb, tvdb, igdb)
	switch {
	case len(fetched) > 0:
		// at least one supplier answered
	case lerr != nil:
		it.Status, it.Error = "fetch_failed", reverifyLookupError("movie details", lerr)
		return it
	case mediaType == "game" && igdbID != 0 && igdb == nil:
		// A GAME PINNED TO IGDB ON AN INSTALL WITH NO PAIR names the pair, as the
		// unpinned game above does, and not a film supplier's key.
		it.Status = "fetch_failed"
		it.Error = "games are looked up in IGDB, which needs its client id and secret — add them in Metadata › Sources"
		return it
	case tmdbID != 0 || tvdbID != 0 || igdbID != 0:
		it.Status = "fetch_failed"
		it.Error = "the pinned source needs its key — add it in Metadata › Sources"
		return it
	default:
		it.Status = "unpinned"
		it.Error = "no pinned identity (TMDB/TheTVDB id) — use Look up to pin this title first"
		return it
	}
	det := fetched[0].Det
	it.Source = det.Source
	it.Sources = make([]string, 0, len(fetched))
	for _, f := range fetched {
		it.Sources = append(it.Sources, f.Source)
	}

	d := it.Diffs
	d = diffStr(d, st, "title", det.Title)
	d = diffStr(d, st, "director", det.Director)
	d = diffStr(d, st, "description", det.Overview)
	if det.ReleaseYear != 0 && det.ReleaseYear != year {
		d = append(d, fieldDiff{Field: "release_year", Stored: st["release_year"], Fresh: det.ReleaseYear})
	}
	if len(det.Genres) > 0 {
		fresh := cappedGenres(det.Genres)
		if !sameGenreSet(genres, fresh) {
			d = append(d, fieldDiff{Field: "genres", Stored: st["genres"], Fresh: fresh})
		}
	}
	d = diffStr(d, st, "series", det.Series)
	// Cast: ordered (character, actor) pairs; person_id/image_url ride along in
	// fresh so an approved apply keeps the portrait pipeline working.
	//
	// STORED IS THE MAPPING, not `cast_json` — the list the reader actually sees on
	// the film page and can edit, which is the only honest thing to hold up against
	// what the provider says now. Two consequences worth being plain about. A cast
	// the reader has edited will keep reporting a difference, because the merge
	// deliberately will not resolve it: approving the diff takes the provider's
	// facts and leaves their names alone, for ever, by design (0048). And a
	// hand-typed row makes the lists different lengths, so sameCast says so — which
	// is true, and is the merge rule made visible rather than hidden.
	stored, cerr := loadCastMembers(s.Store.DB, "movie", id)
	if cerr != nil {
		olog.Warnf(olog.CodeCastRowScan, "[meta] re-verify movie %d cast read failed: %v", id, cerr)
		stored = []metadata.CastMember{}
	}
	if len(det.Cast) > 0 && !sameCast(stored, det.Cast) {
		d = append(d, fieldDiff{Field: "cast", Stored: stored, Fresh: det.Cast})
	}
	if det.PosterURL != "" && (poster == "" || s.coverWidth(poster) < lowResCoverWidth) {
		d = append(d, fieldDiff{Field: "poster", Stored: st["poster"], Fresh: det.PosterURL})
	}
	if det.TMDBID != 0 && det.TMDBID != tmdbID {
		d = append(d, fieldDiff{Field: "tmdb_id", Stored: st["tmdb_id"], Fresh: det.TMDBID})
	}
	if det.TVDBID != 0 && det.TVDBID != tvdbID {
		d = append(d, fieldDiff{Field: "tvdb_id", Stored: st["tvdb_id"], Fresh: det.TVDBID})
	}
	// Against what is STORED, not the id a title search just found: a game resolved
	// above carries its new id here, and that diff is how the pin is written.
	if det.IGDBID != 0 && det.IGDBID != m.igdbID {
		d = append(d, fieldDiff{Field: "igdb_id", Stored: st["igdb_id"], Fresh: det.IGDBID})
	}
	// WHAT EACH SUPPLIER SAID, attached once the diff list is settled rather than
	// woven into each comparison above. Two reasons: the comparisons decide
	// whether a field DIFFERS from what is stored, which is a separate question
	// from what the alternatives are, and doing it here means a field added to the
	// diff list tomorrow gets its alternatives without anybody remembering to.
	//
	// Only when more than one supplier answered. A single-source fetch carries no
	// choice, and an `alts` array with one entry would make the client draw a
	// picker for a decision that does not exist.
	if len(fetched) > 1 {
		attachMovieAlts(d, fetched)
	}
	it.Diffs = d
	// See the book side: one supplier is a choice here even though it is not a
	// choice in `alts`.
	if withOffers {
		it.Offers = offersFrom(map[string]any{
			"title": title, "director": director, "description": desc,
			"release_year": year, "series": series, "genres": genres,
		}, pickerFields(movieAltPickers), func(f string) []fieldAlt {
			return altsFor(fetched, movieAltPickers[f])
		})
	}
	return it
}

// movieAltPickers maps a diff field to the value each supplier would offer for
// it. ONE TABLE so that a field and its alternatives cannot drift apart: adding a
// field to the diff list without adding it here means it silently offers no
// choice, which looks like "the suppliers agree" and is not.
var movieAltPickers = map[string]func(*metadata.MovieDetails) any{
	"title":        func(d *metadata.MovieDetails) any { return d.Title },
	"director":     func(d *metadata.MovieDetails) any { return d.Director },
	"description":  func(d *metadata.MovieDetails) any { return d.Overview },
	"release_year": func(d *metadata.MovieDetails) any { return d.ReleaseYear },
	"series":       func(d *metadata.MovieDetails) any { return d.Series },
	"genres":       func(d *metadata.MovieDetails) any { return cappedGenres(d.Genres) },
	"cast":         func(d *metadata.MovieDetails) any { return d.Cast },
	"poster":       func(d *metadata.MovieDetails) any { return d.PosterURL },
	// tmdb_id, tvdb_id and igdb_id are deliberately absent: each names its own supplier, so
	// "TheTVDB says the tmdb_id is 603" is not an alternative anybody can weigh.
}

// attachMovieAlts fills Alts on every diff a supplier can answer for.
func attachMovieAlts(diffs []fieldDiff, fetched []fetchedSource) {
	for i := range diffs {
		pick, ok := movieAltPickers[diffs[i].Field]
		if !ok {
			continue
		}
		alts := altsFor(fetched, pick)
		if len(alts) < 2 {
			continue // nothing to choose between
		}
		diffs[i].Alts = alts
	}
}

// cappedGenres is the genre normalisation the diff and the alternatives must
// agree on — cleaned, capped at five, title-cased. It was inline in one place and
// is now needed in two, which is exactly when a rule becomes a function.
func cappedGenres(in []string) []string {
	out := cleanNames(in)
	if len(out) > 5 {
		out = out[:5]
	}
	for i := range out {
		out[i] = titleCaseGenre(out[i])
	}
	return out
}

// sameCast compares billing order and the visible (character, actor) pairs —
// a person_id/image_url-only change is not worth a user-facing diff.
func sameCast(a, b []metadata.CastMember) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !strings.EqualFold(strings.TrimSpace(a[i].Character), strings.TrimSpace(b[i].Character)) ||
			!strings.EqualFold(strings.TrimSpace(a[i].Actor), strings.TrimSpace(b[i].Actor)) {
			return false
		}
	}
	return true
}

// getPersonFold is getPerson with a case-insensitive fallback: the People
// console lists names in the casing the CREDIT uses, which can differ from
// the saved row's casing — the re-verify flow must still find the row (and
// then keys everything by the row's canonical spelling).
func (s *Server) getPersonFold(uid int64, kind, name string) (personRow, bool) {
	if p, ok := s.getPerson(uid, kind, name); ok {
		return p, true
	}
	p, err := scanPerson(s.Store.DB.QueryRow(
		`SELECT `+personCols+` FROM people p`+personKindJoin+`
		 WHERE p.user_id = ? AND LOWER(p.name) = LOWER(?) LIMIT 1`, kind, uid, name))
	if err != nil {
		return personRow{}, false
	}
	return p, true
}

// storedPersonFields is p's fields as a re-verify's diffs carry them in stored,
// read by the check and the review alike (storedBookFields says why it is one
// reader): the identity as the one "source:id" string the apply takes, the rest
// as read.
func storedPersonFields(p personRow) map[string]any {
	return map[string]any{
		"identity": strings.TrimSpace(strings.TrimPrefix(p.Source+":"+p.SourceID, ":")),
		"links":    p.Links, "portrait": p.ImagePath, "bio": p.Bio, "born": p.Born, "died": p.Died,
	}
}

func (s *Server) reverifyPerson(ctx context.Context, uid int64, kind, name string) reverifyItem {
	it := reverifyItem{Type: "person", Kind: kind, Name: name, Title: name, Status: "ok", Diffs: []fieldDiff{}}
	if !validPersonKind(kind) || name == "" {
		it.Status, it.Error = "not_found", "kind must be author, actor or director, with a name"
		return it
	}
	p, ok := s.getPersonFold(uid, kind, name)
	if !ok {
		it.Status = "unpinned"
		it.Error = "nothing saved for this name yet — fetch it from the People console first"
		return it
	}
	// Key the item by the saved row's canonical spelling so the apply that
	// follows targets the same row.
	it.Name, it.Title, name = p.Name, p.Name, p.Name
	// The same confident resolution the portrait pipeline uses: an actor from
	// the stored cast (no network), an author via Open Library disambiguated by
	// their books. Links come back only for authors; actor links stay the
	// People console's job (a by-name TMDB search could drift to a namesake).
	source, sourceID, imageURL, bio, born, died, links, rerr := s.resolvePersonPortrait(ctx, uid, kind, name)
	if rerr != nil {
		it.Status, it.Error = "fetch_failed", reverifyLookupError("person", rerr)
		return it
	}
	if source == "" && imageURL == "" && len(links) == 0 && bio == "" && born == "" && died == "" {
		it.Error = "no confident match found"
		return it
	}
	it.Source = source
	st := storedPersonFields(p)

	d := it.Diffs
	// Identity needs BOTH halves — a cast entry with a headshot but no person
	// id would otherwise emit a "source:" value the apply endpoint rejects.
	identityDrift := source != "" && sourceID != "" && (source != p.Source || sourceID != p.SourceID)
	if identityDrift {
		d = append(d, fieldDiff{Field: "identity", Stored: st["identity"], Fresh: source + ":" + sourceID})
	}
	// A LINKS DIFF IS SOMETHING FETCHED THAT THE FIELD LACKS, and nothing else.
	// The fold writes the whole field back in its own order, one address a line,
	// so a field typed another way reads differently from the fold of itself
	// with nothing fetched at all; compared with the text as stored, every such
	// record would come back "changed" by a check that found nothing. The fresh
	// side is the whole folded field, names and all, because that is what the
	// apply writes.
	if merged := mergeLinks(p.Links, links); merged != mergeLinks(p.Links, nil) {
		d = append(d, fieldDiff{Field: "links", Stored: st["links"], Fresh: merged})
	}
	if imageURL != "" && (p.ImagePath == "" || identityDrift) {
		d = append(d, fieldDiff{Field: "portrait", Stored: st["portrait"], Fresh: imageURL})
	}
	// Bio + birth year only fill an empty field — a user's own text is never
	// overwritten by a re-verify (mirrors the auto-enrich upsert's CASE guards).
	if bio != "" && strings.TrimSpace(p.Bio) == "" {
		d = append(d, fieldDiff{Field: "bio", Stored: st["bio"], Fresh: bio})
	}
	if born != "" && strings.TrimSpace(p.Born) == "" {
		d = append(d, fieldDiff{Field: "born", Stored: st["born"], Fresh: born})
	}
	if died != "" && strings.TrimSpace(p.Died) == "" {
		d = append(d, fieldDiff{Field: "died", Stored: st["died"], Fresh: died})
	}
	it.Diffs = d
	return it
}

// ---- apply ----

// handleMetadataReverifyApply: POST /metadata/reverify/apply
// {items: [{type, id | kind+name, set:{field: value}, expect?}]} → per-item results.
// Writes ONLY whitelisted, user-approved fields, per-item transactionally;
// image fields (cover/poster/portrait — the previewed URLs) download after the
// text commit so an image miss degrades to a note instead of reverting text.
func (s *Server) handleMetadataReverifyApply(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []reverifyApplyItem `json:"items"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		writeErr(w, http.StatusBadRequest, "nothing to apply")
		return
	}
	if len(req.Items) > maxReverifyItems {
		writeErr(w, http.StatusBadRequest, "too many items per call (max 15) — send smaller batches")
		return
	}
	uid := userID(r)
	olog.Tracef("[meta] handleMetadataReverifyApply uid=%d items=%d", uid, len(req.Items))

	results := []applyResult{}
	applied, failed := 0, 0
	for _, item := range req.Items {
		res := s.applyReverifyItem(r.Context(), uid, item)
		if res.OK {
			applied++
		} else {
			failed++
		}
		results = append(results, res)
	}
	writeJSON(w, http.StatusOK, map[string]any{"applied": applied, "failed": failed, "results": results})
}

// reverifyApplyItem is one item of an apply: which row, the fields to write on
// it, and what the reader was shown as stored for each.
type reverifyApplyItem struct {
	Type string                     `json:"type"`
	ID   int64                      `json:"id"`
	Kind string                     `json:"kind"`
	Name string                     `json:"name"`
	Set  map[string]json.RawMessage `json:"set"`
	// The supplier the preview named, for the whole item. Still accepted so
	// that a client which offers no per-field choice keeps working.
	Source string `json:"source"`
	// WHICH SUPPLIER EACH ACCEPTED VALUE CAME FROM — the wire half of
	// mix-and-match. The reader picks per field, so provenance is per field,
	// and this is the only place that fact exists: by the time apply runs,
	// the responses the values were read out of are gone.
	//
	// It also RETIRES AN ASYMMETRY. A film's supplier used to be recomputed
	// server-side because it was derivable from the row; a book's had to be
	// echoed because it was not. Neither is derivable once the reader can
	// take the description from one supplier and the year from another, so
	// both kinds now say so here, and both are validated the same way.
	Sources map[string]string `json:"sources"`
	// Expect is, per field, the stored value the review showed the reader
	// (null for an empty one). A field whose value is no longer that is not
	// written (applyReverifyItem). Optional: an item without it is applied as
	// it always was.
	Expect map[string]json.RawMessage `json:"expect"`
}

// applyResult is what an apply says about one item.
type applyResult struct {
	Type  string `json:"type"`
	ID    int64  `json:"id,omitempty"`
	Kind  string `json:"kind,omitempty"`
	Name  string `json:"name,omitempty"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
	Note  string `json:"note,omitempty"`
	// title is the work's, when the apply read it, for a job's log line.
	title string
	// wrote is the fields sent to the writer, for the same line.
	wrote []string
	// stopped is an item a Stop reached before its write: nothing of it was
	// written (errStoppedItem).
	stopped bool
}

// changedSinceTheCheck is the note on an item some of whose fields were left
// because they no longer held what the reader was shown.
const changedSinceTheCheck = "changed since the check, so left as it is: "

// applyReverifyItem applies one item, as POST /metadata/reverify/apply and the
// reverify-apply job both do.
//
// A FIELD THAT CHANGED SINCE THE CHECK IS LEFT AS IT IS. A review can be opened
// days after its check, from Past jobs, and the reader decides on what they were
// shown; between that and the press, the library can move — they type a
// description in another tab, a fill fills the year. Each field of an item that
// carries expect is compared with what the row holds now, read by the same
// loader and compared by the same rule the review used to show it
// (reverifyStoredNow, sameStored: null, "", 0 and [] are all empty); a field
// that differs is dropped from the write, and the item's note names it. An item
// every field of which moved writes nothing and is still ok — nothing failed,
// the apply did what it should. A row that is gone is left to the writer, which
// says not found.
func (s *Server) applyReverifyItem(ctx context.Context, uid int64, item reverifyApplyItem) applyResult {
	res := applyResult{Type: item.Type, ID: item.ID, Kind: item.Kind, Name: item.Name}
	kind, name := strings.TrimSpace(item.Kind), strings.TrimSpace(item.Name)
	switch item.Type {
	case "book", "movie", "person":
	default:
		res.Error = "type must be book, movie or person"
		return res
	}
	set := item.Set
	var moved []string
	if len(item.Expect) > 0 {
		now, err := s.reverifyStoredNow(uid, reverifyHead{Type: item.Type, ID: item.ID, Kind: kind, Name: name})
		if err != nil {
			olog.Errorf(olog.CodeMetaReverifyFetch, "[meta] re-verify apply %s %d: reading what is stored: %v", item.Type, item.ID, err)
			res.Error = "could not read what is stored now — try again"
			return res
		}
		if now != nil {
			res.title, _ = now["title"].(string)
			set = map[string]json.RawMessage{}
			for field, v := range item.Set {
				if then, asked := item.Expect[field]; asked {
					if cur, known := now[field]; !known || !sameStored(field, then, cur) {
						moved = append(moved, field)
						continue
					}
				}
				set[field] = v
			}
			slices.Sort(moved)
		}
	}
	var notes []string
	if len(moved) > 0 {
		notes = append(notes, changedSinceTheCheck+fieldWords(moved))
	}
	if len(set) > 0 || len(moved) == 0 {
		var note string
		var aerr error
		switch item.Type {
		case "book":
			note, aerr = s.applyReverifyBook(ctx, uid, item.ID, set, item.Source, item.Sources)
		case "movie":
			note, aerr = s.applyReverifyMovie(ctx, uid, item.ID, set, item.Sources)
		case "person":
			note, aerr = s.applyReverifyPerson(ctx, uid, kind, name, set)
		}
		if note != "" {
			notes = append(notes, note)
		}
		if aerr != nil {
			res.stopped = errors.Is(aerr, errStoppedItem)
			res.Error = aerr.Error()
			res.Note = strings.Join(notes, "; ")
			return res
		}
		for field := range set {
			res.wrote = append(res.wrote, field)
		}
		slices.Sort(res.wrote)
	}
	res.OK = true
	res.Note = strings.Join(notes, "; ")
	return res
}

// runReverifyApply is the reverify-apply job: the review's Apply, item by item
// through applyReverifyItem as the synchronous route applies them, with a line
// in its log for each. Its result is the route's results, one per item it
// reached, which the review reads back to say what was written; the check it
// came from (from_job) is on the row, which is what makes that check read as
// applied.
//
// A Stop leaves the item in hand unwritten (job_stop.go): its picture, if it was
// on its way, is cut off and removed, and its fields are not written without it.
// The item is not among the results, so a review opened again offers it again.
func runReverifyApply(s *Server, ctx context.Context, j *jobs.Job) error {
	var p struct {
		Items []reverifyApplyItem `json:"items"`
	}
	if err := j.Params(&p); err != nil {
		return err
	}
	uid := j.Owner().UserID
	results := []applyResult{}
	for i, item := range p.Items {
		if !s.goOn(j, i) {
			break
		}
		res := s.applyReverifyItem(ctx, uid, item)
		if res.stopped {
			abandoned(j, itemName(res.Type, res.ID, cmp.Or(res.title, res.Name)))
			break
		}
		level, line := applyLine(res)
		j.Log(level, "%s", line)
		results = append(results, res)
		j.Progress(i+1, len(p.Items))
	}
	return j.SetResult(results)
}

// applyLine is an apply's line for one item: what it wrote, and anything it
// left, or why it failed.
func applyLine(res applyResult) (level, line string) {
	name := itemName(res.Type, res.ID, cmp.Or(res.title, res.Name))
	if !res.OK {
		line = name + " — failed: " + res.Error
		if res.Note != "" {
			line += "; " + res.Note
		}
		return jobs.LevelWarn, line
	}
	line = name + " — nothing written"
	if len(res.wrote) > 0 {
		line = name + " — wrote " + fieldWords(res.wrote)
	}
	if res.Note != "" {
		line += "; " + res.Note
	}
	return jobs.LevelInfo, line
}

// decodeSet pulls one typed field out of a set map; absent keys return ok=false.
func decodeSet[T any](set map[string]json.RawMessage, key string) (T, bool, error) {
	var v T
	raw, present := set[key]
	if !present {
		return v, false, nil
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		return v, false, errors.New(key + ": wrong type")
	}
	return v, true, nil
}

// isUniqueErr matches SQLite UNIQUE-constraint violations (the isbn/tmdb_id
// partial-unique indexes) so they read as "duplicate", mirroring the 409s the
// create/edit paths return.
func isUniqueErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE")
}

// `source` is the supplier the PREVIEW reported, echoed back by the client.
//
// AND IT IS ECHOED HERE WHERE A FILM'S IS RECOMPUTED, which is an asymmetry worth
// stating rather than smoothing over. A film's supplier is derivable from the row
// alone — the ids it carries, crossed with the clients configured — so
// movieFetchPlan works it out server-side and the request's opinion is not wanted.
// A book's is not: the identity ladder runs an ISBN through a MERGED lookup across
// Google Books, Open Library and Amazon, and which of them won is a fact about a
// response that has already been discarded by the time apply runs. Recomputing it
// would mean repeating the fetch — a second round of network calls, on the write
// path, to re-derive something the client was already told.
//
// So it is accepted, and VALIDATED against the vocabulary rather than trusted:
// see knownBookSource. The worst a wrong value buys is a mislabelled line in the
// reader's own provenance for their own book, which is why validation is the
// proportionate guard and a second fetch is not.
// The fields an apply may write, per kind.
//
// LIFTED OUT OF THE TWO APPLIERS so that a test can hold them up against the
// picker tables. Every field a Details row OFFERS has to be one this route can
// write, or the picker draws a button that fails — and the offer list and the
// write list live in different files, which is exactly how two lists drift.
// Inside the function the check could not be read by anything but itself.
var reverifyBookFields = map[string]bool{
	"title": true, "author": true, "description": true, "published_year": true,
	"genres": true, "series": true, "series_index": true, "isbn": true, "cover": true,
	"subtitle": true, "publisher": true, "pages": true,
}

var reverifyMovieFields = map[string]bool{
	"title": true, "director": true, "description": true, "release_year": true,
	"genres": true, "series": true, "cast": true, "poster": true, "tmdb_id": true, "tvdb_id": true,
	"igdb_id": true,
}

func (s *Server) applyReverifyBook(ctx context.Context, uid, id int64, set map[string]json.RawMessage, source string, sources map[string]string) (note string, err error) {
	for k := range set {
		if !reverifyBookFields[k] {
			return "", errors.New("unknown field for a book: " + k)
		}
	}
	cols := []string{}
	args := []any{}
	addStr := func(key, col string, allowEmpty bool) error {
		v, present, derr := decodeSet[string](set, key)
		if derr != nil {
			return derr
		}
		if !present {
			return nil
		}
		v = strings.TrimSpace(v)
		if v == "" && !allowEmpty {
			return errors.New(key + " cannot be empty")
		}
		cols = append(cols, col+" = ?")
		args = append(args, nullable(v))
		return nil
	}
	// title binds non-nullable (a book must keep a title).
	if v, present, derr := decodeSet[string](set, "title"); derr != nil {
		return "", derr
	} else if present {
		v = strings.TrimSpace(v)
		if v == "" {
			return "", errors.New("title cannot be empty")
		}
		cols = append(cols, "title = ?")
		args = append(args, v)
	}
	if err := addStr("author", "author", true); err != nil {
		return "", err
	}
	if err := addStr("description", "description", true); err != nil {
		return "", err
	}
	if err := addStr("series", "series", true); err != nil {
		return "", err
	}
	if y, present, derr := decodeSet[int](set, "published_year"); derr != nil {
		return "", derr
	} else if present {
		if !validYear(y) {
			return "", errors.New("published_year out of range")
		}
		cols = append(cols, "published_year = ?")
		args = append(args, nullableInt(y))
	}
	// 0061's two strings bind non-nullable, unlike author and series above: their
	// columns are NOT NULL DEFAULT '', so `nullable()` would send the NULL the
	// column refuses rather than the empty value it wants.
	for _, f := range []struct{ key, col string }{{"subtitle", "subtitle"}, {"publisher", "publisher"}} {
		if v, present, derr := decodeSet[string](set, f.key); derr != nil {
			return "", derr
		} else if present {
			cols = append(cols, f.col+" = ?")
			args = append(args, strings.TrimSpace(v))
		}
	}
	if n, present, derr := decodeSet[int](set, "pages"); derr != nil {
		return "", derr
	} else if present {
		if n < 0 {
			return "", errors.New("a page count cannot be negative")
		}
		cols = append(cols, "pages = ?")
		args = append(args, n)
	}
	if f, present, derr := decodeSet[float64](set, "series_index"); derr != nil {
		return "", derr
	} else if present {
		cols = append(cols, "series_index = ?")
		args = append(args, nullableFloat(f))
	}
	if v, present, derr := decodeSet[string](set, "isbn"); derr != nil {
		return "", derr
	} else if present {
		n := metadata.NormalizeISBN(v)
		if n == "" {
			return "", errors.New("invalid isbn")
		}
		cols = append(cols, "isbn = ?")
		args = append(args, n)
	}
	genres, hasGenres, derr := decodeSet[[]string](set, "genres")
	if derr != nil {
		return "", derr
	}
	coverURL, hasCover, derr := decodeSet[string](set, "cover")
	if derr != nil {
		return "", derr
	}

	// The approved cover downloads FIRST (through the metadata host allowlist)
	// so the file can ride the same transaction; a miss degrades to a note.
	newCover, oldCover := "", ""
	if hasCover && strings.TrimSpace(coverURL) != "" && ctx.Err() == nil {
		if name, ferr := s.fetchImage(ctx, strings.TrimSpace(coverURL), s.coversDir()); ferr != nil {
			warnOutwardFailure(olog.CodeMetaReverifyImage, ferr, "[meta] re-verify book %d cover fetch failed: %v", id, ferr)
			note = "cover: fetch failed — other fields applied"
		} else {
			newCover = name
			_ = s.Store.DB.QueryRow(`SELECT COALESCE(cover_path,'') FROM books WHERE id = ? AND user_id = ?`,
				id, uid).Scan(&oldCover) // best-effort: worst case the old file lingers
			cols = append(cols, "cover_path = ?")
			args = append(args, newCover)
		}
	}
	// A STOP BEFORE THE WRITE LEAVES THE BOOK AS IT WAS (job_stop.go): landing
	// while the cover was on its way, it is not "fetch failed, other fields
	// applied" — nothing is applied, and a cover that did arrive is removed. The
	// transaction is begun only after this, so a Stop never lands inside it.
	if ctx.Err() != nil {
		s.removeCoverFile(newCover)
		return "", errStoppedItem
	}
	if len(cols) == 0 && !hasGenres {
		s.removeCoverFile(newCover)
		if note != "" {
			// The ONLY approved field was the cover and its download failed —
			// that's the documented degrade-to-note outcome, not a client error.
			return note, nil
		}
		return "", errors.New("no approved fields")
	}

	tx, terr := s.Store.DB.Begin()
	if terr != nil {
		s.removeCoverFile(newCover)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d begin failed: %v", id, terr)
		return "", errors.New("write failed")
	}
	defer tx.Rollback()
	if src := knownBookSource(source); src != "" || len(sources) > 0 {
		if perr := recordPerField(tx, uid, "book", id, arrived(set, "cover", newCover), sources, knownBookSource, src, ""); perr != nil {
			// Not fatal, for the reason the movie path gives: the fields are the
			// write, this is the note beside them.
			olog.Warnf(olog.CodeMetaReverifyApply,
				"[meta] re-verify book %d field sources not recorded: %v", id, perr)
		}
	}
	if len(cols) > 0 {
		args = append(args, id, uid)
		res, xerr := tx.Exec(`UPDATE books SET `+strings.Join(cols, ", ")+`, updated_at = datetime('now') WHERE id = ? AND user_id = ?`, args...)
		if xerr != nil {
			s.removeCoverFile(newCover)
			if isUniqueErr(xerr) {
				return "", errors.New("duplicate — another book already carries that isbn")
			}
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d update failed: %v", id, xerr)
			return "", errors.New("write failed")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			s.removeCoverFile(newCover)
			return "", errors.New("not found")
		}
	} else if !txOwnsRow(tx, "books", uid, id) {
		s.removeCoverFile(newCover)
		return "", errors.New("not found")
	}
	// 0056. Re-verify applies one allowed field at a time and the credit column
	// is one of them, so the link rows are re-derived from whatever landed —
	// unconditionally, because whether this call touched the credit is decided
	// by a map above and re-reading is cheaper than threading that answer down.
	if cerr := store.SyncCreditsFromColumns(tx, uid, "book", id, s.creditSeps(tx, uid)); cerr != nil {
		s.removeCoverFile(newCover)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d credits failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if hasGenres {
		capped := cleanNames(genres)
		if len(capped) > 5 {
			capped = capped[:5]
		}
		if gerr := setGenres(tx, "book", uid, id, capped); gerr != nil {
			s.removeCoverFile(newCover)
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d genres failed: %v", id, gerr)
			return "", errors.New("write failed")
		}
	}
	if cerr := tx.Commit(); cerr != nil {
		s.removeCoverFile(newCover)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify book %d commit failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if newCover != "" && oldCover != "" && oldCover != newCover {
		s.removeCoverFile(oldCover) // best-effort; new row committed
	}
	return note, nil
}

// txOwnsRow is the ownership check for a genre-only apply, where no UPDATE has
// proven the row is the caller's (foreign rows read as "not found" — no
// existence leak).
func txOwnsRow(tx *sql.Tx, table string, uid, id int64) bool {
	var ok bool
	_ = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = ? AND user_id = ?)`, id, uid).Scan(&ok)
	return ok
}

func (s *Server) applyReverifyMovie(ctx context.Context, uid, id int64, set map[string]json.RawMessage, sources map[string]string) (note string, err error) {
	for k := range set {
		if !reverifyMovieFields[k] {
			return "", errors.New("unknown field for a movie: " + k)
		}
	}
	cols := []string{}
	args := []any{}
	addStr := func(key, col string, allowEmpty bool) error {
		v, present, derr := decodeSet[string](set, key)
		if derr != nil {
			return derr
		}
		if !present {
			return nil
		}
		v = strings.TrimSpace(v)
		if v == "" && !allowEmpty {
			return errors.New(key + " cannot be empty")
		}
		cols = append(cols, col+" = ?")
		args = append(args, nullable(v))
		return nil
	}
	if v, present, derr := decodeSet[string](set, "title"); derr != nil {
		return "", derr
	} else if present {
		v = strings.TrimSpace(v)
		if v == "" {
			return "", errors.New("title cannot be empty")
		}
		cols = append(cols, "title = ?")
		args = append(args, v)
	}
	if err := addStr("director", "director", true); err != nil {
		return "", err
	}
	if err := addStr("description", "description", true); err != nil {
		return "", err
	}
	if err := addStr("series", "series", true); err != nil {
		return "", err
	}
	if y, present, derr := decodeSet[int](set, "release_year"); derr != nil {
		return "", derr
	} else if present {
		if !validYear(y) {
			return "", errors.New("release_year out of range")
		}
		cols = append(cols, "release_year = ?")
		args = append(args, nullableInt(y))
	}
	for _, idf := range []string{"tmdb_id", "tvdb_id", "igdb_id"} {
		if v, present, derr := decodeSet[int64](set, idf); derr != nil {
			return "", derr
		} else if present {
			cols = append(cols, idf+" = ?")
			args = append(args, nullableInt64(v))
		}
	}
	cast, hasCast, derr := decodeSet[[]metadata.CastMember](set, "cast")
	if derr != nil {
		return "", derr
	}
	if hasCast {
		raw, merr := json.Marshal(cast)
		if merr != nil {
			return "", errors.New("cast: wrong shape")
		}
		// THE FROZEN BLOB IS FILLED, NEVER OVERWRITTEN. This is the one write to
		// cast_json in the app that is conditional, and the condition is the whole
		// point of keeping the column.
		//
		// 0048 keeps cast_json for exactly one reason: if its backfill turns out to
		// be wrong about somebody's library, that blob is THE ONLY COPY IN EXISTENCE
		// of what the provider said before the mapping took over. Nothing reads it on
		// this path. Rewriting it here would spend the one thing it is for.
		//
		// AND THIS PATH IS THE WRONG ONE TO SPEND IT FROM, which is why it is this
		// statement and not the two beside it that changed. applyReverifyMovie is
		// also the fill's writer, and fill is UNATTENDED AND BULK: up to two
		// thousand titles a job (or fifteen a call from an API caller), no diff on
		// screen. A resync is one title the reader asked for by name; a fill is a
		// button that could walk a library. Before 0048 fill never touched this
		// column at all — missingStored returned false for a []CastMember — so the
		// hole opened with the same change that made the blob worth protecting.
		//
		// FILLED rather than left alone for a reason that has since changed, and the
		// change is written down here because it is what makes the column droppable.
		// The reason WAS the blob's last reader — the quiz's speaker distractors —
		// which would have lost its list on a title that never had one. THAT READER
		// HAS MOVED TO work_cast (quizPools, review_handlers.go), because freezing
		// this write is exactly what starved it: an approved cast diff wrote the
		// mapping and stopped writing the blob, so the pool went stale for good while
		// resyncMovieFromSource went on replacing the blob whole. Nothing reads the
		// column now.
		//
		// The write STAYS anyway, for a smaller reason that is still true: the CASE
		// keeps this in `cols`, so a cast-only approval has an UPDATE to prove
		// ownership with and does not fall through to "no approved fields". Filling a
		// blob that is already '[]' costs nothing and protects the same thing it did
		// before — the pre-0048 copy on every title that has one.
		cols = append(cols, "cast_json = CASE WHEN COALESCE(cast_json, '') IN ('', '[]') THEN ? ELSE cast_json END")
		args = append(args, string(raw))
	}
	genres, hasGenres, derr := decodeSet[[]string](set, "genres")
	if derr != nil {
		return "", derr
	}
	posterURL, hasPoster, derr := decodeSet[string](set, "poster")
	if derr != nil {
		return "", derr
	}

	newPoster, oldPoster := "", ""
	if hasPoster && strings.TrimSpace(posterURL) != "" && ctx.Err() == nil {
		if name, ferr := s.fetchImage(ctx, strings.TrimSpace(posterURL), s.coversDir()); ferr != nil {
			warnOutwardFailure(olog.CodeMetaReverifyImage, ferr, "[meta] re-verify movie %d poster fetch failed: %v", id, ferr)
			note = "poster: fetch failed — other fields applied"
		} else {
			newPoster = name
			_ = s.Store.DB.QueryRow(`SELECT COALESCE(poster_path,'') FROM movies WHERE id = ? AND user_id = ?`,
				id, uid).Scan(&oldPoster)
			cols = append(cols, "poster_path = ?")
			args = append(args, newPoster)
		}
	}
	// The book's rule: a Stop before the write leaves the film as it was.
	if ctx.Err() != nil {
		s.removeCoverFile(newPoster)
		return "", errStoppedItem
	}
	if len(cols) == 0 && !hasGenres {
		s.removeCoverFile(newPoster)
		if note != "" {
			// Poster-only approval whose download failed — degrade to the note.
			return note, nil
		}
		return "", errors.New("no approved fields")
	}

	tx, terr := s.Store.DB.Begin()
	if terr != nil {
		s.removeCoverFile(newPoster)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d begin failed: %v", id, terr)
		return "", errors.New("write failed")
	}
	defer tx.Rollback()
	if len(cols) > 0 {
		args = append(args, id, uid)
		res, xerr := tx.Exec(`UPDATE movies SET `+strings.Join(cols, ", ")+`, updated_at = datetime('now') WHERE id = ? AND user_id = ?`, args...)
		if xerr != nil {
			s.removeCoverFile(newPoster)
			if isUniqueErr(xerr) {
				return "", errors.New("duplicate — another title already carries that source id")
			}
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d update failed: %v", id, xerr)
			return "", errors.New("write failed")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			s.removeCoverFile(newPoster)
			return "", errors.New("not found")
		}
	} else if !txOwnsRow(tx, "movies", uid, id) {
		s.removeCoverFile(newPoster)
		return "", errors.New("not found")
	}
	// 0056. Re-verify applies one allowed field at a time and the credit column
	// is one of them, so the link rows are re-derived from whatever landed —
	// unconditionally, because whether this call touched the credit is decided
	// by a map above and re-reading is cheaper than threading that answer down.
	if cerr := store.SyncCreditsFromColumns(tx, uid, "movie", id, s.creditSeps(tx, uid)); cerr != nil {
		s.removeCoverFile(newPoster)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d credits failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if hasGenres {
		capped := cleanNames(genres)
		if len(capped) > 5 {
			capped = capped[:5]
		}
		if gerr := setGenres(tx, "movie", uid, id, capped); gerr != nil {
			s.removeCoverFile(newPoster)
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d genres failed: %v", id, gerr)
			return "", errors.New("write failed")
		}
	}
	// WHERE THESE FIELDS NOW COME FROM (0054). The keys of `set` are exactly the
	// diffs the reader ticked, so this records what they actually accepted rather
	// than everything the supplier offered — which is the whole point of a preview
	// somebody approves field by field.
	//
	// The source is RECOMPUTED and not taken from the request: see movieFetchPlan.
	// A plan of "" means the row is unpinned or its supplier has no key, in which
	// case there is nothing true to record and RecordFieldSources returns early.
	if src, srcID := s.movieFetchPlanFor(tx, uid, id); src != "" {
		if perr := recordPerField(tx, uid, "movie", id, arrived(set, "poster", newPoster), sources, knownMovieSource, src, srcID); perr != nil {
			// NOT FATAL. The fields are written; this is the note beside them. A
			// failed audit line must not undo a re-verify the reader approved.
			olog.Warnf(olog.CodeMetaReverifyApply,
				"[meta] re-verify movie %d field sources not recorded: %v", id, perr)
		}
	}
	if hasCast {
		// THE MERGE RULE, on the third and last of the provider write paths. An
		// approved cast diff is still a refetch: it may add credits and rewrite
		// untouched ones, and it may not touch a row the reader has corrected,
		// typed or deleted. Which is why approving the cast here does NOT
		// necessarily silence the diff that offered it — see reverifyMovie.
		//
		// The cast_json statement above FILLS the superseded blob and never
		// overwrites it, for the reason argued there: on this path — which is also
		// the unattended bulk fill's — that blob is the only copy of what the
		// provider said before 0048, and nothing reads it here.
		//
		// Fatal rather than warned, unlike the refill below: this is the write the
		// reader approved, and reporting success over a cast that did not land is
		// the failure shape this endpoint has no business inventing.
		if merr := mergeProviderCast(tx, uid, "movie", id, castSourceForWork(tx, id), cast); merr != nil {
			s.removeCoverFile(newPoster)
			olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d cast merge failed: %v", id, merr)
			return "", errors.New("write failed")
		}
		// A refreshed cast can name speakers for dialogues whose actor is blank.
		if _, ferr := refillMovieActors(tx, uid, id, s.creditSeps(tx, uid)); ferr != nil {
			olog.Warnf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d actor refill failed: %v", id, ferr)
		}
	}
	if cerr := tx.Commit(); cerr != nil {
		s.removeCoverFile(newPoster)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify movie %d commit failed: %v", id, cerr)
		return "", errors.New("write failed")
	}
	if newPoster != "" && oldPoster != "" && oldPoster != newPoster {
		s.removeCoverFile(oldPoster)
	}
	return note, nil
}

func (s *Server) applyReverifyPerson(ctx context.Context, uid int64, kind, name string, set map[string]json.RawMessage) (note string, err error) {
	if !validPersonKind(kind) || name == "" {
		return "", errors.New("kind must be author, actor or director, with a name")
	}
	allowed := map[string]bool{"links": true, "identity": true, "source": true, "source_id": true, "portrait": true, "bio": true, "born": true, "died": true}
	for k := range set {
		if !allowed[k] {
			return "", errors.New("unknown field for a person: " + k)
		}
	}
	p, exists := s.getPerson(uid, kind, name)
	if !exists {
		return "", errors.New("not found")
	}
	links, hasLinks, derr := decodeSet[string](set, "links")
	if derr != nil {
		return "", derr
	}
	// identity ships as "source:id" (the preview's diff value); a split
	// source/source_id pair is accepted too.
	source, sourceID := p.Source, p.SourceID
	if v, present, derr := decodeSet[string](set, "identity"); derr != nil {
		return "", derr
	} else if present {
		src, sid, ok := strings.Cut(strings.TrimSpace(v), ":")
		if !ok || src == "" || sid == "" {
			return "", errors.New("identity must be source:id")
		}
		source, sourceID = src, sid
	}
	if v, present, derr := decodeSet[string](set, "source"); derr != nil {
		return "", derr
	} else if present {
		source = strings.TrimSpace(v)
	}
	if v, present, derr := decodeSet[string](set, "source_id"); derr != nil {
		return "", derr
	} else if present {
		sourceID = strings.TrimSpace(v)
	}
	portraitURL, hasPortrait, derr := decodeSet[string](set, "portrait")
	if derr != nil {
		return "", derr
	}
	newBio := p.Bio
	if v, present, derr := decodeSet[string](set, "bio"); derr != nil {
		return "", derr
	} else if present {
		newBio = strings.TrimSpace(v)
	}
	newBorn := p.Born
	if v, present, derr := decodeSet[string](set, "born"); derr != nil {
		return "", derr
	} else if present {
		newBorn = strings.TrimSpace(v)
	}
	newDied := p.Died
	if v, present, derr := decodeSet[string](set, "died"); derr != nil {
		return "", derr
	} else if present {
		newDied = strings.TrimSpace(v)
	}

	newImage := ""
	if hasPortrait && strings.TrimSpace(portraitURL) != "" && ctx.Err() == nil {
		if img, ferr := s.fetchImage(ctx, strings.TrimSpace(portraitURL), s.coversDir()); ferr != nil {
			warnOutwardFailure(olog.CodeMetaReverifyImage, ferr, "[meta] re-verify person %q portrait fetch failed: %v", name, ferr)
			note = "portrait: fetch failed — other fields applied"
		} else {
			newImage = img
		}
	}
	// The book's rule: a Stop before the write leaves the record as it was.
	if ctx.Err() != nil {
		s.removeCoverFile(newImage)
		return "", errStoppedItem
	}
	newLinks := p.Links
	if hasLinks {
		newLinks = strings.TrimSpace(links)
	}
	image := p.ImagePath
	if newImage != "" {
		image = newImage
	}
	// Full upsert. bio/born/died now flow through too (only diffed when the stored
	// field was empty, so a user's own text still can't be overwritten here).
	// Find-or-create then UPDATE — 0056 dropped the ON CONFLICT target. The
	// fields written are exactly the ones this handler wrote before; the diffing
	// that decides WHICH of them changed happens above, as it always did.
	//
	// ONE TRANSACTION, the find-or-create, the fields and the role alike, so the
	// record is changed whole or not at all: no row made and then left bare, no
	// fields written without the role they were fetched as.
	tx, terr := s.Store.DB.Begin()
	if terr != nil {
		s.removeCoverFile(newImage)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify person %q begin failed: %v", name, terr)
		return "", errors.New("write failed")
	}
	defer tx.Rollback()
	pid, perr := personRowByNameOn(tx, uid, name)
	if perr != nil {
		s.removeCoverFile(newImage)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify person %q upsert failed: %v", name, perr)
		return "", errors.New("write failed")
	}
	// Who supplied the picture, from its address (the reader can take the
	// portrait without the identity, so `source` may be the old pin), and each
	// fetched link credited to the supplier, read inside this transaction.
	var curLinks, curSources string
	_ = tx.QueryRow(`SELECT links, link_sources FROM people WHERE id = ? AND user_id = ?`, pid, uid).Scan(&curLinks, &curSources)
	linkSources := curSources
	if hasLinks {
		linkSources = relinkSources(curLinks, newLinks, readLinkSources(curSources), linkSupplierFor(kind))
	}
	if _, xerr := tx.Exec(`
		UPDATE people SET bio = ?, image_path = ?, born = ?, died = ?, links = ?,
		                  source = ?, source_id = ?, link_sources = ?,
		                  image_source = CASE WHEN ? <> '' THEN ? ELSE image_source END
		WHERE id = ? AND user_id = ?`,
		newBio, image, newBorn, newDied, newLinks, source, sourceID, linkSources,
		newImage, pictureSupplier(portraitURL, source), pid, uid); xerr != nil {
		s.removeCoverFile(newImage)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify person %q upsert failed: %v", name, xerr)
		return "", errors.New("write failed")
	}
	if rerr := recordPersonKindOn(tx, pid, kind); rerr != nil {
		olog.Warnf(olog.CodePeopleRowScan, "[meta] re-verify person role record failed: %v", rerr)
	}
	if cerr := tx.Commit(); cerr != nil {
		s.removeCoverFile(newImage)
		olog.Errorf(olog.CodeMetaReverifyApply, "[meta] re-verify person %q commit failed: %v", name, cerr)
		return "", errors.New("write failed")
	}
	if newImage != "" && p.ImagePath != "" && p.ImagePath != newImage {
		s.removeCoverFile(p.ImagePath)
	}
	return note, nil
}

// movieFetchPlan decides who to ask about a STORED film: the ids it carries,
// crossed with the clients that are actually configured.
//
// ONE FUNCTION BECAUSE TWO CALLERS NEED THE SAME ANSWER AND ONLY ONE OF THEM CAN
// FETCH. The preview asks a supplier and knows who answered; the apply path is
// handed a map of approved VALUES and nothing else — castSourceForWork's comment
// has complained about exactly that for two releases. Recording where a field
// came from means apply has to know too, and the honest way to tell it is to let
// it recompute the same decision from the same inputs rather than to have the
// browser send back a claim about provenance.
//
// THE DEFAULT SOURCE FIRST — see preferredSourceFor in cast.go for why the order
// is TheTVDB's. The second case is a genuine fallback rather than a second
// preference: a work pinned to TheTVDB on an install whose TheTVDB key is missing
// still re-verifies against TMDB rather than reporting itself broken. That is
// also why the CLIENTS are arguments: "who would answer" is not a property of the
// row alone, and a plan computed without them would name a supplier that cannot
// be reached.
//
// A GAME'S IS IGDB, third, as preferredSourceFor orders them. It was missing, so a
// game filled or re-verified from IGDB recorded no source for any field it took
// (a rating found it: field_sources came back empty where a TheTVDB film's say
// "tvdb"), which is the defect this path's IGDB read was written to end, one step
// further on.
func movieFetchPlan(tmdbID, tvdbID, igdbID int64, tmdb *metadata.TMDB, tvdb *metadata.TVDB, igdb *metadata.IGDB) (source, sourceID string) {
	switch {
	case tvdbID != 0 && tvdb != nil:
		return "tvdb", strconv.FormatInt(tvdbID, 10)
	case tmdbID != 0 && tmdb != nil:
		return "tmdb", strconv.FormatInt(tmdbID, 10)
	case igdbID != 0 && igdb != nil:
		return "igdb", strconv.FormatInt(igdbID, 10)
	}
	return "", ""
}

// movieFetchPlanFor is movieFetchPlan for a work the caller has only an id for.
// Scoped by user_id; a row that is not theirs plans nothing, which is the same
// answer an unpinned row gives and leaks nothing about whether it exists.
//
// READ INSIDE THE APPLY'S TRANSACTION, because the apply may be the write that
// pins the work: a game found by its IGDB title gets its igdb_id in the same
// UPDATE, and a read on another connection would still see none.
func (s *Server) movieFetchPlanFor(tx *sql.Tx, uid, id int64) (source, sourceID string) {
	var tmdbID, tvdbID, igdbID int64
	if err := tx.QueryRow(
		`SELECT COALESCE(tmdb_id, 0), COALESCE(tvdb_id, 0), COALESCE(igdb_id, 0) FROM movies WHERE id = ? AND user_id = ?`,
		id, uid).Scan(&tmdbID, &tvdbID, &igdbID); err != nil {
		return "", ""
	}
	tmdb, _ := s.resolveTMDB()
	tvdb, _ := s.resolveTVDB()
	igdb, _ := s.resolveIGDB()
	return movieFetchPlan(tmdbID, tvdbID, igdbID, tmdb, tvdb, igdb)
}

// knownBookSource validates a client-supplied supplier name, returning "" for
// anything not in the vocabulary. A WHITELIST rather than a sanitiser: these
// strings are rendered to the reader as "where this came from", and the safe
// failure is to record nothing rather than to record whatever arrived.
func knownBookSource(source string) string {
	switch strings.TrimSpace(source) {
	case "google", "openlibrary", "amazon", "hardcover", store.SourceManual:
		return strings.TrimSpace(source)
	}
	return ""
}

// fetchAllMovieSources asks every supplier the work is pinned to AND has a client
// for, in preference order. Returns the answers that came back plus the last
// error, so the caller can tell "nobody answered" from "nobody was asked".
func (s *Server) fetchAllMovieSources(ctx context.Context, uid, id int64, mediaType, title, storedWiki, series string,
	tmdbID, tvdbID, igdbID int64, tmdb *metadata.TMDB, tvdb *metadata.TVDB, igdb *metadata.IGDB) ([]fetchedSource, error) {
	var out []fetchedSource
	var lastErr error
	add := func(source, sourceID string, det *metadata.MovieDetails, err error) {
		// Every supplier this fill asked says so on its Sources row.
		area := faultAreaFilms
		if source == "igdb" || (source == "fandom" && mediaType == "game") {
			area = faultAreaGames
		}
		// LETTERBOXD AND FANDOM ARE SILENT ON EVERY MISS, a host never reached
		// included (their own notes say why), so a nil from either is not an
		// answer and is not recorded as "found nothing". A page they returned is.
		if det != nil || err != nil || (source != "letterboxd" && source != "fandom") {
			s.recordAsk(ctx, area, source, one(det != nil), "", err)
		}
		if err != nil {
			// Logged and remembered, not returned: another supplier may still
			// answer, and one being down must not cost the reader the other's.
			// One a Stop cut is not down, and is no warning (warnOutwardFailure).
			warnOutwardFailure(olog.CodeMetaReverifyFetch, err, "[meta] re-verify %s#%s: %v", source, sourceID, err)
			lastErr = err
			return
		}
		if det != nil {
			out = append(out, fetchedSource{Source: source, SourceID: sourceID, Det: det})
		}
	}
	// PREFERENCE ORDER, and it is the same order preferredSourceFor states —
	// TheTVDB leads for films and shows because that is the default source.
	//
	// AND NOT ONE SUPPLIER MORE ONCE THE CONTEXT HAS ENDED: a Stop, or the
	// reader gone. What the ones before it said is not used either — the caller
	// abandons the work (job_stop.go) — so asking the rest only spends requests.
	if tvdbID != 0 && tvdb != nil {
		id := strconv.FormatInt(tvdbID, 10)
		if mediaType == "show" {
			det, err := tvdb.SeriesDetails(ctx, id)
			add("tvdb", id, det, err)
		} else {
			det, err := tvdb.MovieDetails(ctx, id)
			add("tvdb", id, det, err)
		}
	}
	if ctx.Err() != nil {
		return out, ctx.Err()
	}
	if tmdbID != 0 && tmdb != nil {
		id := strconv.FormatInt(tmdbID, 10)
		if mediaType == "show" {
			det, err := tmdb.DetailsTV(ctx, tmdbID)
			add("tmdb", id, det, err)
		} else {
			det, err := tmdb.Details(ctx, tmdbID)
			add("tmdb", id, det, err)
		}
	}
	if ctx.Err() != nil {
		return out, ctx.Err()
	}
	// A GAME'S RECORD, BY ITS IGDB ID. Last of the three in preferredSourceFor's
	// order, which only matters for a work carrying a film id as well.
	if igdbID != 0 && igdb != nil {
		id := strconv.FormatInt(igdbID, 10)
		det, err := igdb.Details(ctx, id)
		add("igdb", id, det, err)
	}
	// THE KEYLESS RUNGS, BELOW THE PINNED ONES AND ONLY WHEN THERE IS ALREADY A
	// PINNED ONE.
	//
	// Letterboxd and Fandom need no credential, so nothing stops them answering
	// for every title — which is exactly why they are gated on the work being
	// pinned to somebody first. Both find their page by GUESSING a slug from the
	// title, and a guess is worth making beside a record that is already
	// identified: the reader can see the two side by side and reject a wrong one.
	// Offered as the ONLY answer, on an unpinned row, the same guess would be a
	// confident wrong record with nothing to check it against — which is the
	// mistake igdb_cast.go watched a fuzzy title search make.
	//
	// A SHOW OR A GAME IS NOT A LETTERBOXD FILM. It catalogues cinema, so asking
	// it about a series spends a request to guarantee a 404 — or worse, finds a
	// film that shares the name.
	if ctx.Err() != nil {
		return out, ctx.Err()
	}
	if len(out) > 0 && strings.TrimSpace(title) != "" {
		if mediaType == "movie" {
			det, err := metadata.LetterboxdDetails(ctx, title)
			add("letterboxd", metadata.LetterboxdSlug(title), det, err)
		}
		// The wiki is resolved once and remembered on the row; see fandomWikiFor.
		// THE SERIES RIDES ALONG, because a franchise wiki is named for the
		// franchise rather than for this instalment — see FandomWikiCandidatesFor.
		if wiki := s.fandomWikiFor(ctx, uid, id, storedWiki, title, series); wiki != "" {
			det, err := metadata.FandomWorkDetails(ctx, title, wiki)
			add("fandom", wiki, det, err)
		}
	}
	return out, lastErr
}

// recordPerField writes provenance for an approved set, honouring a PER-FIELD
// source where the client supplied one and falling back to the item's single
// source where it did not.
//
// ONE FUNCTION FOR BOTH KINDS, because the rule is the same rule and the two
// copies it replaces had already drifted once. `valid` is the only per-kind part:
// a film's suppliers and a book's are different vocabularies, and validating
// against the wrong one would either reject a real source or accept a nonsense
// one.
//
// AN UNRECOGNISED SOURCE FALLS BACK rather than failing. The fields are already
// written; this is the note beside them, and a note that refused to be written
// because one entry was unrecognised would lose the provenance of every other
// field in the same apply.
func recordPerField(tx *sql.Tx, uid int64, kind string, id int64,
	set map[string]json.RawMessage, sources map[string]string,
	valid func(string) string, fallback, fallbackID string) error {
	// Grouped by source so each distinct supplier is one call rather than one per
	// field, which matters because a full apply is a dozen fields and this runs
	// inside the write transaction.
	bySource := map[string][]string{}
	for field := range set {
		src := fallback
		if s := valid(sources[field]); s != "" {
			src = s
		}
		if src == "" {
			continue
		}
		bySource[src] = append(bySource[src], field)
	}
	for src, fields := range bySource {
		srcID := ""
		if src == fallback {
			srcID = fallbackID
		}
		if err := store.RecordFieldSources(tx, uid, kind, id, src, srcID, fields); err != nil {
			return err
		}
	}
	return nil
}

// arrived is `set` without its picture field when no picture arrived: a download
// that failed, a blank address or a Stop must not leave a supplier's mark on a
// cover the work does not have.
func arrived(set map[string]json.RawMessage, field, got string) map[string]json.RawMessage {
	if _, asked := set[field]; !asked || got != "" {
		return set
	}
	out := make(map[string]json.RawMessage, len(set))
	for k, v := range set {
		if k != field {
			out[k] = v
		}
	}
	return out
}

// recordEdits credits each field a save CHANGED: to the supplier the client says
// it took that field from (per-field `sources`, the wire re-verify apply already
// carries), validated for the kind and the field, and to the reader otherwise.
// A field named in `sources` that the save did not change is not credited: the
// claim is about where a value came from, and an unchanged value came from
// wherever it came from before.
func recordEdits(tx *sql.Tx, uid int64, kind string, id int64, edited []string, sources map[string]string) error {
	bySource := map[string][]string{}
	for _, f := range edited {
		src := fieldSupplier(kind, f, sources[f])
		if src == "" {
			src = store.SourceManual
		}
		bySource[src] = append(bySource[src], f)
	}
	for src, fields := range bySource {
		if err := store.RecordFieldSources(tx, uid, kind, id, src, "", fields); err != nil {
			return err
		}
	}
	return nil
}

// fieldSupplier is the supplier a client may credit one field of one kind to, or
// "". A cover or poster may also come from a picture rung, Google Images or
// Amazon, which no catalogue whitelist names.
func fieldSupplier(kind, field, source string) string {
	if field == "cover" || field == "poster" {
		if s := knownPictureSource(source); s != "" {
			return s
		}
	}
	if kind == "book" {
		return knownBookSource(source)
	}
	return knownMovieSource(source)
}

// knownPictureSource: the picture rungs a cover or poster strip offers.
func knownPictureSource(source string) string {
	switch strings.TrimSpace(source) {
	case "google-images", "amazon":
		return strings.TrimSpace(source)
	}
	return ""
}

// knownMovieSource is knownBookSource's counterpart. Same whitelist discipline,
// different vocabulary — the two are separate functions rather than one union
// because accepting "openlibrary" for a film would record a supplier that cannot
// have answered.
func knownMovieSource(source string) string {
	switch strings.TrimSpace(source) {
	case "tmdb", "tvdb", "igdb", "wikidata", "imdb", "letterboxd", "fandom", store.SourceManual:
		return strings.TrimSpace(source)
	}
	return ""
}

// resolveGameByTitle asks IGDB for a game with no id of its own, and answers the
// one id that is exactly it, or 0 and why not in words the reader can act on.
//
// EXACTLY IT: the same title, compared with case, punctuation and spacing folded
// (gameTitleKey) and nothing cut, so "The Witcher 3: Wild Hunt" is not its Game of
// the Year edition; and the same year when the work has one and IGDB does. The
// search is recorded where every lookup is, so the Sources row says what IGDB last
// said. An id another of this reader's works already carries is not taken: igdb_id
// is unique per reader, and the write would fail.
func (s *Server) resolveGameByTitle(ctx context.Context, uid, workID int64, igdb *metadata.IGDB, title string, year int) (int64, string, error) {
	cands, err := igdb.Search(ctx, title, year)
	s.recordAsk(ctx, faultAreaGames, "igdb", len(cands), "", err)
	if err != nil {
		return 0, "", err
	}
	want := gameTitleKey(title)
	var hits []metadata.MovieCandidate
	for _, c := range cands {
		if gameTitleKey(c.Title) == want && (year == 0 || c.ReleaseYear == 0 || c.ReleaseYear == year) {
			hits = append(hits, c)
		}
	}
	switch {
	case len(hits) == 0:
		return 0, "IGDB has no game called exactly this — use Look up to pin it", nil
	case len(hits) > 1:
		return 0, "IGDB has several games called exactly this — use Look up to choose one", nil
	}
	n, perr := strconv.ParseInt(hits[0].SourceID, 10, 64)
	if perr != nil || n <= 0 {
		return 0, "IGDB answered with an id this app cannot read — use Look up to pin it", nil
	}
	var other string
	switch qerr := s.Store.DB.QueryRow(`SELECT title FROM movies WHERE user_id = ? AND igdb_id = ? AND id <> ?`, uid, n, workID).Scan(&other); {
	case qerr == nil:
		return 0, "IGDB's game by this title is already «" + other + "» in your library — use Look up to choose another", nil
	case !errors.Is(qerr, sql.ErrNoRows):
		return 0, "", qerr
	}
	return n, "", nil
}

// gameTitleKey folds a title for an exact comparison: lower case, letters and
// digits kept, every run of anything else one space. Unlike normalizeTitle it
// keeps the subtitle, which is what tells a game from its re-releases.
func gameTitleKey(s string) string {
	var b strings.Builder
	gap := false
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			if gap && b.Len() > 0 {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			gap = false
			continue
		}
		gap = true
	}
	return b.String()
}
