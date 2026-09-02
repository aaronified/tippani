package metadata

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Test seams: real endpoints in production, httptest servers in tests.
var (
	googleBase      = "https://www.googleapis.com"
	openLibraryBase = "https://openlibrary.org"
)

// maxBookCandidates caps the merged list — the user picks from a short
// candidate list (PLAN §6); more is noise.
const maxBookCandidates = 12

// ErrQuota signals Google Books answered 429 — the shared anonymous daily
// quota is exhausted. Google gives every keyless caller one global quota, so
// this is common. The handler turns it into a "add a free key in Settings"
// hint rather than a generic failure.
var ErrQuota = errors.New("google books daily quota exceeded (429)")

type BookCandidate struct {
	Source        string   `json:"source"` // "google" | "openlibrary"
	SourceID      string   `json:"source_id"`
	Title         string   `json:"title"`
	Author        string   `json:"author"`
	ISBN13        string   `json:"isbn13"`
	Description   string   `json:"description"`
	PublishedYear int      `json:"published_year"`
	Genres        []string `json:"genres"`
	CoverURL      string   `json:"cover_url"`
	Series        string   `json:"series"`       // franchise/series name, where the source has it
	SeriesIndex   float64  `json:"series_index"` // position within the series (0 = unknown)
	// 0061. All three have been in both providers' replies since the beginning
	// and were parsed by neither: Google carries `subtitle`, `publisher` and
	// `pageCount`; Open Library's search doc carries `subtitle`, `publisher` and
	// `number_of_pages_median`. Nothing new is fetched to fill them.
	Subtitle  string `json:"subtitle"`
	Publisher string `json:"publisher"`
	Pages     int    `json:"pages"` // 0 = the source did not say

	// Both provider ids, not just the one in SourceID. A merged candidate is
	// assembled from two providers and has two identities; keeping only the
	// primary would throw away the pin that re-verify needs to re-check the
	// other one later.
	GoogleID      string `json:"google_id"`
	OpenLibraryID string `json:"openlibrary_id"`
}

// seriesRe splits a raw series string like "Discworld #5", "Discworld (5)" or
// "The Malazan Book of the Fallen, Book 6" into its name and numeric position.
var seriesRe = regexp.MustCompile(`^(.*?)[\s,]*(?:#|book|no\.?|vol\.?|\()?\s*(\d+(?:\.\d+)?)\)?\s*$`)

// parenRe pulls parenthetical groups out of a title, e.g. the "(Malazan Book of
// Fallen 7)" in "Reaper's Gale (Malazan Book of Fallen 7)".
var parenRe = regexp.MustCompile(`\(([^)]+)\)`)

// parseSeries pulls a name + position out of a provider's series label. When no
// trailing number is present the whole string is the name (index 0).
func parseSeries(raw string) (string, float64) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", 0
	}
	if m := seriesRe.FindStringSubmatch(s); m != nil && strings.TrimSpace(m[1]) != "" {
		if idx, err := strconv.ParseFloat(m[2], 64); err == nil {
			return strings.TrimSpace(strings.Trim(m[1], " ,-")), idx
		}
	}
	return s, 0
}

// deriveSeriesFromTitle recovers a "<Series> <N>" that rides in a book's
// subtitle — either a separate subtitle field (Google) or the part after the
// last ':' in the title (Open Library folds it in), e.g. "Reaper's Gale: The
// Malazan Book of the Fallen 7". A trailing number is REQUIRED, so a plain
// descriptive subtitle ("A Brief History of Humankind") is not mistaken for a
// series. Returns ("", 0) when nothing series-like is found.
func deriveSeriesFromTitle(title, subtitle string) (string, float64) {
	cands := []string{subtitle}
	// parenthetical groups, e.g. "Reaper's Gale (Malazan Book of Fallen 7)"
	for _, m := range parenRe.FindAllStringSubmatch(title, -1) {
		cands = append(cands, m[1])
	}
	// the part after the last colon, e.g. "Title: The Malazan Book of the Fallen 7"
	if i := strings.LastIndex(title, ":"); i >= 0 {
		cands = append(cands, title[i+1:])
	}
	for _, c := range cands {
		if strings.TrimSpace(c) == "" {
			continue
		}
		if name, idx := parseSeries(c); idx > 0 && name != "" {
			return name, idx
		}
	}
	return "", 0
}

// SearchBooks queries Google Books and Open Library and merges the candidates.
// With an ISBN it's an exact isbn: lookup (title/author ignored). Otherwise it
// searches by title AND author — Google `intitle:… inauthor:…`, OL
// `title=&author=` — then ranks the merged list by title+author similarity so
// the edition the reader means sorts above the box-sets, study guides and
// foreign reprints a title-only search surfaces first. Author-scoping can
// over-constrain (a slightly-off author string, or a supplier that indexes the
// author differently), so an empty author-scoped result falls back to a
// title-only query — never fewer results than before. Best-effort: any source's
// hits win; when none return a candidate the explaining error is surfaced
// (notably ErrQuota). isbn should be normalized (PLAN §3); googleKey is the
// optional settings-managed Google Books key (PLAN §6); "" stays anonymous.
func SearchBooks(ctx context.Context, isbn, title, author, googleKey string) ([]BookCandidate, error) {
	var out []BookCandidate
	var gErr, olErr error

	if isbn != "" {
		out, gErr = searchGoogle(ctx, "isbn:"+isbn, googleKey)
		ol, e := searchOpenLibrary(ctx, url.Values{"isbn": {isbn}}, isbn)
		out, olErr = append(out, ol...), e
	} else {
		gq := "intitle:" + title
		olp := url.Values{"title": {title}}
		if author != "" {
			gq += " inauthor:" + author
			olp.Set("author", author)
		}
		out, gErr = searchGoogle(ctx, gq, googleKey)
		ol, e := searchOpenLibrary(ctx, olp, "")
		out, olErr = append(out, ol...), e
		if len(out) == 0 && author != "" {
			out, gErr = searchGoogle(ctx, "intitle:"+title, googleKey)
			ol2, e2 := searchOpenLibrary(ctx, url.Values{"title": {title}}, "")
			out, olErr = append(out, ol2...), e2
		}
	}

	if len(out) == 0 {
		// Nothing found. Surface an error so the handler can explain (the quota
		// case especially); a clean empty result stays a non-error empty list.
		if gErr != nil {
			return nil, gErr
		}
		if olErr != nil {
			return nil, olErr
		}
	}
	// Backfill series for any candidate a provider didn't tag directly — the name
	// + index often ride in the title's subtitle ("Title: The Malazan Book of the
	// Fallen 7"). Requires a trailing number, so descriptive subtitles are safe.
	for i := range out {
		if strings.TrimSpace(out[i].Series) == "" {
			if name, idx := deriveSeriesFromTitle(out[i].Title, ""); name != "" {
				out[i].Series = name
				out[i].SeriesIndex = idx
			}
		}
	}
	// An ISBN identifies one book, so the providers are not offering a choice —
	// they are each half-describing the same object. Merge them into one record
	// rather than making the reader pick a row and inherit all of its gaps.
	if isbn != "" {
		out = mergeSameBook(out)
	} else {
		adoptFirstPublished(out, false)
	}
	// Best-match-first when searching by text (an ISBN hit is already exact).
	if isbn == "" && title != "" {
		rankBooks(out, title, author)
	}
	if len(out) > maxBookCandidates {
		out = out[:maxBookCandidates]
	}
	return out, nil
}

// adoptFirstPublished replaces an edition year with the earliest year any
// provider reported for the same work.
//
// The two sources answer different questions. Open Library's search returns
// first_publish_year -- when the work was written -- and this package has always
// read it. Google Books returns publishedDate, which is the date of the EDITION
// it happens to be describing, so a Penguin reprint of the Meditations comes
// back as 2006 and a Dover Thoreau as 1995. For most of a modern library the two
// agree closely enough not to notice. For anything old they disagree by
// centuries, and the shelf ends up sorted by when the paperback was printed.
//
// Both providers are already queried in the same call and their candidates
// concatenated, so this costs no request: the earlier year is usually sitting a
// few entries away in the same slice.
//
// The rule is min(), not "prefer Open Library". A first publication cannot be
// later than an edition of it, so when the two disagree the earlier one is the
// one that answers the question -- and if OL is the one missing a year, Google's
// edition date survives, which is the fallback that was asked for.
//
// sameWork is deliberately narrow. An ISBN search returns one book, so every
// candidate is that book and no matching is needed. A title search can return
// two different works with one name -- Ulysses is Joyce's and Tennyson's -- so
// there the titles must fold equal AND the authors must share a name. Sharing a
// TOKEN rather than matching whole is what lets "Marcus Aurelius" meet "Marcus
// Aurelius Antoninus", which is the exact case this exists for.
func adoptFirstPublished(cands []BookCandidate, sameWork bool) {
	earliest := func(group []int) int {
		best := 0
		for _, y := range group {
			if y != 0 && (best == 0 || y < best) {
				best = y
			}
		}
		return best
	}
	if sameWork {
		years := make([]int, 0, len(cands))
		for _, c := range cands {
			years = append(years, c.PublishedYear)
		}
		if y := earliest(years); y != 0 {
			for i := range cands {
				cands[i].PublishedYear = y
			}
		}
		return
	}
	for i := range cands {
		group := []int{cands[i].PublishedYear}
		for j := range cands {
			if i != j && normalizeWork(cands[i].Title) == normalizeWork(cands[j].Title) &&
				sharesAuthorToken(cands[i].Author, cands[j].Author) {
				group = append(group, cands[j].PublishedYear)
			}
		}
		if y := earliest(group); y != 0 {
			cands[i].PublishedYear = y
		}
	}
}

// sharesAuthorToken reports whether two credit strings name the same person
// loosely enough for provider spelling. An empty credit matches anything: one
// provider omitting the author is not evidence of a different book, and the
// title has already had to fold equal to get here.
func sharesAuthorToken(a, b string) bool {
	fa, fb := normalizeWork(a), normalizeWork(b)
	if fa == "" || fb == "" || fa == fb {
		return true
	}
	seen := map[string]bool{}
	for _, t := range strings.Fields(fa) {
		if len(t) > 2 { // skip "de", "van", initials
			seen[t] = true
		}
	}
	for _, t := range strings.Fields(fb) {
		if seen[t] {
			return true
		}
	}
	return false
}

// mergeSameBook folds every candidate for one ISBN into a single best-of record.
//
// An ISBN names one book, so two providers describing it are not two choices to
// pick between -- they are two partial accounts of the same object, and asking
// somebody to choose a ROW means choosing a whole set of fields at once. Pick
// the Google row and you get its blurb and its cover and its edition year. Pick
// the Open Library row and you get the first-publication year but often no
// description at all. Neither row is the best answer; the best answer is
// assembled.
//
// Which source wins which field, and why:
//
//	year        earliest non-zero. Open Library reports first_publish_year and
//	            Google reports the edition's publishedDate, and a work cannot
//	            have been written after an edition of it was printed. This is
//	            the field the whole merge exists for.
//	cover       highest resolution. Google's is rewritten to a w1280-h1920 fife
//	            render (see GoogleHiResCover), which beats Open Library's -L.jpg
//	            comfortably; OL is the fallback when Google has no art.
//	description longest. Google carries real publisher blurbs; OL usually
//	            carries nothing, and occasionally a single line.
//	author      longest. Providers disagree on how much of a name to print, and
//	            "Nassim Nicholas Taleb" is more useful than "Nassim Taleb" --
//	            it is also what the people table wants to match on.
//	title       Open Library's, when it has one. It titles the WORK; Google
//	            titles the edition in hand, which is where "(Penguin Classics)"
//	            and series furniture come from. Since the year is now the work's
//	            too, the two agree about what is being described.
//	genres      union, deduplicated, capped. The two vocabularies barely
//	            overlap -- Google has broad categories, OL has subject headings
//	            -- so taking one and discarding the other loses real signal.
//	series      whichever names one; a non-zero index breaks the tie, because
//	            "Discworld 5" is strictly more than "Discworld".
//
// Both provider ids are kept, so the merged record can still be re-verified
// against either one later.
func mergeSameBook(cands []BookCandidate) []BookCandidate {
	if len(cands) < 2 {
		return cands
	}
	out := cands[0]
	for _, c := range cands[1:] {
		if c.PublishedYear != 0 && (out.PublishedYear == 0 || c.PublishedYear < out.PublishedYear) {
			out.PublishedYear = c.PublishedYear
		}
		if len(c.Description) > len(out.Description) {
			out.Description = c.Description
		}
		if len(c.Author) > len(out.Author) {
			out.Author = c.Author
		}
		if out.CoverURL == "" {
			out.CoverURL = c.CoverURL
		} else if c.Source == "google" && c.CoverURL != "" {
			out.CoverURL = c.CoverURL
		}
		if c.Source == "openlibrary" && strings.TrimSpace(c.Title) != "" {
			out.Title = c.Title
		}
		if out.ISBN13 == "" {
			out.ISBN13 = c.ISBN13
		}
		if c.Series != "" && (out.Series == "" || (out.SeriesIndex == 0 && c.SeriesIndex != 0)) {
			out.Series, out.SeriesIndex = c.Series, c.SeriesIndex
		}
		// GOOGLE WINS THE EDITION FACTS, which is the mirror image of the title
		// rule three lines up rather than a contradiction of it. Open Library
		// describes the WORK — every publisher that ever printed it, the median
		// extent across all of them — and Google describes the copy in your hand,
		// which is what a publisher and a page count are questions about. Where
		// Google is silent, OL's answer is better than none.
		if c.Source == "google" {
			if c.Publisher != "" {
				out.Publisher = c.Publisher
			}
			if c.Pages != 0 {
				out.Pages = c.Pages
			}
			if c.Subtitle != "" {
				out.Subtitle = c.Subtitle
			}
		} else {
			if out.Publisher == "" {
				out.Publisher = c.Publisher
			}
			if out.Pages == 0 {
				out.Pages = c.Pages
			}
			if out.Subtitle == "" {
				out.Subtitle = c.Subtitle
			}
		}
		out.Genres = unionGenres(out.Genres, c.Genres)
		if c.GoogleID != "" {
			out.GoogleID = c.GoogleID
		}
		if c.OpenLibraryID != "" {
			out.OpenLibraryID = c.OpenLibraryID
		}
	}
	// The merged record is not "a Google result" or "an OL result" any more. It
	// keeps a primary source so the existing create path still has one id to
	// pin, and carries both ids besides.
	if out.Source == "" || out.SourceID == "" {
		if out.GoogleID != "" {
			out.Source, out.SourceID = "google", out.GoogleID
		} else if out.OpenLibraryID != "" {
			out.Source, out.SourceID = "openlibrary", out.OpenLibraryID
		}
	}
	return []BookCandidate{out}
}

// unionGenres merges two subject lists case-insensitively, keeping first-seen
// order and the existing candidate cap. Google's categories and Open Library's
// subject headings barely overlap, so this is additive in practice.
func unionGenres(a, b []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(a)+len(b))
	for _, list := range [][]string{a, b} {
		for _, g := range list {
			g = strings.TrimSpace(g)
			k := strings.ToLower(g)
			if g == "" || seen[k] {
				continue
			}
			seen[k] = true
			out = append(out, g)
		}
	}
	if len(out) > maxMergedGenres {
		out = out[:maxMergedGenres]
	}
	return out
}

// maxMergedGenres caps the union. Open Library alone already caps its subjects
// at 6; two vocabularies stitched together needs a little more room without
// turning the genre row into a wall.
const maxMergedGenres = 8

// rankBooks stably reorders candidates best-match-first by title + author
// similarity, with a nudge for actually carrying cover art. This is the
// book-side counterpart to the people disambiguation: matching on name AND
// author keeps a study guide / box set / foreign reprint from outranking the
// edition the reader meant. Stable, so same-score ties keep provider order.
func rankBooks(cands []BookCandidate, title, author string) {
	nt, na := normalizeWork(title), normalizeWork(author)
	score := func(c BookCandidate) int {
		s := 0
		switch ct := normalizeWork(c.Title); {
		case ct == nt:
			s += 4
		case strings.HasPrefix(ct, nt):
			s += 2
		case strings.Contains(ct, nt):
			s++
		}
		if na != "" && strings.Contains(normalizeWork(c.Author), na) {
			s += 3
		}
		if c.CoverURL != "" {
			s++
		}
		return s
	}
	sort.SliceStable(cands, func(i, j int) bool { return score(cands[i]) > score(cands[j]) })
}

func searchGoogle(ctx context.Context, q, key string) ([]BookCandidate, error) {
	// maxResults=20 (default is 10) widens the cover-search grid so there are
	// more editions — and so more cover-art options — to pick from.
	u := googleBase + "/books/v1/volumes?maxResults=20&q=" + url.QueryEscape(q)
	if key != "" { // optional API key raises the ~1,000/day courtesy quota
		u += "&key=" + url.QueryEscape(key)
	}
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	if status == 429 { // shared anonymous quota blown — the common keyless failure
		return nil, fmt.Errorf("google books: %w", ErrQuota)
	}
	if status != 200 {
		return nil, fmt.Errorf("google books: status %d", status)
	}
	var r struct {
		Items []struct {
			ID         string `json:"id"`
			VolumeInfo struct {
				Title               string   `json:"title"`
				Subtitle            string   `json:"subtitle"`
				Authors             []string `json:"authors"`
				Description         string   `json:"description"`
				PublishedDate       string   `json:"publishedDate"`
				Publisher           string   `json:"publisher"`
				PageCount           int      `json:"pageCount"`
				Categories          []string `json:"categories"`
				IndustryIdentifiers []struct {
					Type       string `json:"type"`
					Identifier string `json:"identifier"`
				} `json:"industryIdentifiers"`
				// Google returns whichever sizes it has; prefer the largest.
				ImageLinks googleImageLinks `json:"imageLinks"`
			} `json:"volumeInfo"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("google books: %w", err)
	}
	var out []BookCandidate
	for _, it := range r.Items {
		vi := it.VolumeInfo
		var isbn13, isbn10 string
		for _, id := range vi.IndustryIdentifiers {
			switch id.Type {
			case "ISBN_13":
				isbn13 = id.Identifier
			case "ISBN_10":
				isbn10 = id.Identifier
			}
		}
		if isbn13 == "" {
			isbn13 = NormalizeISBN(isbn10) // "" in, "" out
		}
		gName, gIdx := deriveSeriesFromTitle(vi.Title, vi.Subtitle)
		out = append(out, BookCandidate{
			Source:        "google",
			SourceID:      it.ID,
			GoogleID:      it.ID,
			Title:         vi.Title,
			Author:        strings.Join(vi.Authors, ", "),
			ISBN13:        isbn13,
			Description:   vi.Description,
			PublishedYear: leadingYear(vi.PublishedDate),
			// The subtitle is NOT dropped where deriveSeriesFromTitle read a series
			// out of it: "Reaper's Gale: Malazan Book of the Fallen 7" is both the
			// series and the edition's subtitle line, and which of the two a reader
			// wants on the record is theirs to decide from a field they can see.
			Subtitle:  vi.Subtitle,
			Publisher: vi.Publisher,
			Pages:     vi.PageCount,
			Genres:    vi.Categories,
			CoverURL:  bestGoogleCover(vi.ImageLinks),
			Series:        gName,
			SeriesIndex:   gIdx,
		})
	}
	return out, nil
}

// googleImageLinks is Google Books' imageLinks block; sizes present vary per
// volume (search hits usually carry only smallThumbnail/thumbnail).
type googleImageLinks struct {
	SmallThumbnail string `json:"smallThumbnail"`
	Thumbnail      string `json:"thumbnail"`
	Small          string `json:"small"`
	Medium         string `json:"medium"`
	Large          string `json:"large"`
	ExtraLarge     string `json:"extraLarge"`
}

// bestGoogleCover picks the largest image Google returned. Search results
// usually carry only a thumbnail; the &edge=curl page-curl overlay is stripped
// so the stored cover is a clean front cover, and the URL is upgraded to a
// hi-res render via GoogleHiResCover.
func bestGoogleCover(l googleImageLinks) string {
	for _, u := range []string{l.ExtraLarge, l.Large, l.Medium, l.Small, l.Thumbnail, l.SmallThumbnail} {
		if u != "" {
			return GoogleHiResCover(httpsURL(strings.Replace(u, "&edge=curl", "", 1)))
		}
	}
	return ""
}

// GoogleHiResCover upgrades a Google Books content URL to a larger render: the
// volumes *search* endpoint only ever hands out ~128px zoom=1 thumbnails, but
// the image server honors a fife=WxH bounding box and returns the largest
// available scan that fits it. Exported so covers-refetch can push cached
// low-res URLs (saved verbatim at add time) through the same upgrade.
// Non-Google-Books URLs pass through unchanged.
func GoogleHiResCover(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	h := u.Hostname()
	if h != "books.google.com" && h != "books.googleusercontent.com" {
		return raw
	}
	q := u.Query()
	// The image server returns the largest scan that fits the box, capped by the
	// source resolution — so a generous box (not a fixed 800) pulls the full
	// available quality when the volume has it, and harmlessly returns less when
	// it doesn't. Well above the 500px low-res threshold either way.
	q.Set("fife", "w1280-h1920")
	u.RawQuery = q.Encode()
	return u.String()
}

// searchOpenLibrary queries OL's search.json with the given params (isbn= or
// title=). isbnEcho is stamped onto candidates when the query was by ISBN (OL
// docs don't echo the queried ISBN back).
func searchOpenLibrary(ctx context.Context, params url.Values, isbnEcho string) ([]BookCandidate, error) {
	params.Set("fields", "key,title,subtitle,author_name,first_publish_year,cover_i,subject,series,publisher,number_of_pages_median")
	params.Set("limit", "10")
	u := openLibraryBase + "/search.json?" + params.Encode()
	body, status, err := httpGet(ctx, u, "")
	if err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	if status != 200 {
		return nil, fmt.Errorf("open library: status %d", status)
	}
	var r struct {
		Docs []struct {
			Key              string   `json:"key"`
			Title            string   `json:"title"`
			Subtitle         string   `json:"subtitle"`
			AuthorName       []string `json:"author_name"`
			FirstPublishYear int      `json:"first_publish_year"`
			CoverI           int64    `json:"cover_i"`
			Subject          []string `json:"subject"`
			Series           []string `json:"series"`
			// A WORK doc aggregates every edition, so both of these are plural and
			// neither is the edition in hand: `publisher` is every house that has
			// ever printed it and the median page count is exactly that. The first
			// publisher and the median extent are the honest reading of a work-level
			// record, and Google's edition-level answer beats both in the merge.
			Publisher []string `json:"publisher"`
			Pages     int      `json:"number_of_pages_median"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("open library: %w", err)
	}
	var out []BookCandidate
	for _, d := range r.Docs {
		genres := d.Subject
		if len(genres) > 6 { // subjects are noisy folksonomy; keep the head
			genres = genres[:6]
		}
		var cover string
		if d.CoverI != 0 {
			cover = fmt.Sprintf("https://covers.openlibrary.org/b/id/%d-L.jpg", d.CoverI)
		}
		var seriesName string
		var seriesIdx float64
		if len(d.Series) > 0 {
			seriesName, seriesIdx = parseSeries(d.Series[0])
		}
		out = append(out, BookCandidate{
			Source:        "openlibrary",
			SourceID:      d.Key,
			OpenLibraryID: d.Key,
			Title:         d.Title,
			Subtitle:      d.Subtitle,
			Publisher:     firstOf(d.Publisher),
			Pages:         d.Pages,
			Author:        strings.Join(d.AuthorName, ", "),
			ISBN13:        isbnEcho, // OL docs don't echo the queried ISBN back
			PublishedYear: d.FirstPublishYear,
			Genres:        genres,
			CoverURL:      cover,
			Series:        seriesName,
			SeriesIndex:   seriesIdx,
		})
	}
	return out, nil
}

// firstOf is the first non-blank entry of a provider's plural field. Open
// Library answers with a list wherever a work has had several — publishers,
// mostly — and the first is the one its own record leads with.
func firstOf(vals []string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}
