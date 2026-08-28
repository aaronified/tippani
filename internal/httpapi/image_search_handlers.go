package httpapi

// POST /images/search — "what pictures can this app find for this thing?"
//
// ONE ROUTE FOR THREE PICKERS, and that is the point of it. A book's cover, a
// film's poster and a person's portrait are three surfaces asking the same
// question of the same suppliers, and until now each answered it differently: a
// book's picker read whatever art the CATALOGUE lookup happened to return, a
// film's the same, and a person's had no answer at all — the people console
// opened a web image search in a browser tab and asked the reader to copy an
// address back into a text field.
//
// WHY IT IS NOT PART OF /books/lookup. That route answers with RECORDS — title,
// author, year, blurb, the fields a reader adopts to fill a form — and its
// candidates are things you can BE. Art is a different question with different
// suppliers and a different failure mode (a source with no key contributes
// nothing rather than making the call fail), and folding image results into a
// candidate list would put rows in the metadata picker that cannot be adopted as
// a record.
//
// THE SOURCES ARE WHATEVER IS CONFIGURED, and none of them is required:
//
//	amazon-by-id  keyless. A print ISBN (converted to the ISBN-10 the image CDN
//	              indexes by) or an ASIN addresses a cover directly. Checked with
//	              a HEAD before it is offered, because that CDN answers 200 with
//	              a placeholder for a book it does not stock.
//	google        the reader's own Custom Search key + engine id.
//	amazon-search the stored session cookie, which is the opt-in for scraping.
//
// Nothing here writes anything. The reader picks a URL and the existing
// user-image path stores it — which is the same path a pasted address has always
// taken, and is why an image from a host no allowlist knows about can be stored
// at all.

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// The image kinds a strip can be asked for. Named for the thing being pictured
// rather than for the screen asking, because two screens ask for a poster.
const (
	imageKindCover    = "cover"    // a book
	imageKindPoster   = "poster"   // a film, show or game
	imageKindPortrait = "portrait" // a person
)

// imageSearchMax is how many pictures one strip may carry, across all sources.
const imageSearchMax = 18

// handleImageSearch: POST /images/search
//
//	{kind, title, author, year, isbn, asin, media_type, name}
//	-> {images: [{url, thumb, source}], sources: {google: bool, amazon: bool}}
//
// `sources` is what the client needs to say something useful when the strip
// comes back empty: "nothing found" and "nothing is configured" are different
// answers and only one of them is the reader's to fix.
func (s *Server) handleImageSearch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind      string `json:"kind"`
		Title     string `json:"title"`
		Author    string `json:"author"`
		Name      string `json:"name"` // portrait: the person
		Year      int    `json:"year"`
		ISBN      string `json:"isbn"`
		ASIN      string `json:"asin"`
		MediaType string `json:"media_type"` // movie | show | game
	}
	if !decodeBody(w, r, &req) {
		return
	}
	kind := strings.TrimSpace(req.Kind)
	switch kind {
	case imageKindCover, imageKindPoster, imageKindPortrait:
	default:
		writeErr(w, http.StatusBadRequest, "kind must be cover, poster or portrait")
		return
	}
	subject := strings.TrimSpace(req.Name)
	if subject == "" {
		subject = strings.TrimSpace(req.Title)
	}
	if subject == "" && strings.TrimSpace(req.ISBN) == "" && strings.TrimSpace(req.ASIN) == "" {
		writeErr(w, http.StatusBadRequest, "a title, a name, an isbn or an asin is required")
		return
	}
	gkey, err1 := s.Store.GetSetting(settingGoogleCSEKey)
	gcx, err2 := s.Store.GetSetting(settingGoogleCSECX)
	cookie, err3 := s.Store.GetSetting(settingAmazonCookie)
	domain, err4 := s.Store.GetSetting(settingAmazonDomain)
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		internalError(w, r, "load image search settings", err1)
		return
	}
	olog.Tracef("[meta] handleImageSearch kind=%s subject=%q google=%t amazon=%t",
		kind, subject, gkey != "" && gcx != "", cookie != "")

	seen := map[string]bool{}
	images := []metadata.ImageHit{}
	add := func(hits ...metadata.ImageHit) {
		for _, h := range hits {
			if h.URL == "" || seen[h.URL] || len(images) >= imageSearchMax {
				continue
			}
			seen[h.URL] = true
			images = append(images, h)
		}
	}

	// KEYLESS FIRST, so a reader who has configured nothing at all still gets
	// something for a book they typed an ISBN into. This is the half of "Amazon"
	// that needs no permission and no cookie: the CDN indexes covers by ISBN-10.
	if kind == imageKindCover {
		for _, u := range amazonCoverURLs(req.ISBN, req.ASIN) {
			if metadata.ImageIsReal(r.Context(), u) {
				add(metadata.ImageHit{URL: u, Source: "amazon"})
			}
		}
	}

	query := imageSearchQuery(kind, subject, req.Author, req.MediaType, req.Year)
	if gkey != "" && gcx != "" {
		if hits, err := metadata.GoogleImageSearch(r.Context(), gkey, gcx, query, 10); err != nil {
			// One source failing is not the request failing — the others may have
			// answered. The reason is logged rather than shown, exactly as the
			// catalogue lookups do with a provider error.
			olog.Warnf(olog.CodeMetaLookupFailed, "[meta] google image search %q: %v", query, err)
		} else {
			add(hits...)
		}
	}
	if cookie != "" {
		if hits, err := metadata.AmazonImageSearch(r.Context(), query, cookie, domain, 8); err == nil {
			add(hits...)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"images": images,
		"sources": map[string]bool{
			"google": gkey != "" && gcx != "",
			"amazon": cookie != "",
		},
	})
}

// amazonCoverURLs is the keyless pair: the ASIN the reader typed, and the
// ISBN-10 a print ISBN converts to. Both may be empty, and a 979- ISBN converts
// to nothing at all (the CDN only indexes the 978- range).
func amazonCoverURLs(isbn, asin string) []string {
	var out []string
	if a := strings.TrimSpace(asin); a != "" {
		out = append(out, metadata.AmazonCoverURL(a))
	}
	if i := strings.TrimSpace(isbn); i != "" {
		if u := metadata.AmazonCoverByISBN(metadata.NormalizeISBN(i)); u != "" {
			out = append(out, u)
		}
	}
	return out
}

// imageSearchQuery is the sentence handed to a web image search, and the words
// in it are the difference between a poster and a fan drawing.
//
// The NOUN matters more than the title does: "Heat 1995 movie poster" finds the
// poster, "Heat" finds a thermodynamics diagram. So each kind names what it is
// after, and the year — which a catalogue search uses to disambiguate — is
// included for the same reason here.
func imageSearchQuery(kind, subject, author, mediaType string, year int) string {
	parts := []string{subject}
	switch kind {
	case imageKindCover:
		if a := strings.TrimSpace(author); a != "" {
			parts = append(parts, a)
		}
		parts = append(parts, "book cover")
	case imageKindPoster:
		switch mediaType {
		case "show":
			parts = append(parts, "tv series poster")
		case "game":
			parts = append(parts, "game cover art")
		default:
			parts = append(parts, "movie poster")
		}
	case imageKindPortrait:
		parts = append(parts, "portrait photo")
	}
	if year > 0 && kind != imageKindPortrait {
		parts = append(parts, strconv.Itoa(year))
	}
	return strings.Join(parts, " ")
}

// imageSearchConfigured reports whether any keyed picture source is available —
// read by GET /metadata/status so a picker can offer the strip rather than
// promising a search that has nothing behind it.
func (s *Server) imageSearchConfigured(_ context.Context) bool {
	k, _ := s.Store.GetSetting(settingGoogleCSEKey)
	cx, _ := s.Store.GetSetting(settingGoogleCSECX)
	if k != "" && cx != "" {
		return true
	}
	c, _ := s.Store.GetSetting(settingAmazonCookie)
	return c != ""
}
