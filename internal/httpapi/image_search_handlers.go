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
	// A ROLE, WHICH IS NOT A PERSON AND NOT A WORK. Amanda Waller is a picture of
	// Viola Davis in costume, and neither "Viola Davis" nor "Suicide Squad" finds
	// it: the first finds the actor on a red carpet and the second finds the
	// poster. TheTVDB has an image per role and is the only supplier that does —
	// so every TMDB-sourced row, every game's typed voice cast, and every
	// character in a BOOK has never had a picture available to it at all.
	imageKindCharacter = "character"
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
		Name      string `json:"name"`  // portrait: the person · character: the role
		Actor     string `json:"actor"` // character: who plays it, when anybody does
		Year      int    `json:"year"`
		ISBN      string `json:"isbn"`
		ASIN      string `json:"asin"`
		MediaType string `json:"media_type"` // movie | show | game | book
		// THE PINNED IDENTITIES, sent as OUR ids and never as a supplier's.
		// The ladder needs a TheTVDB work id to find a role and a TheTVDB person
		// id to find a face, and both are read back from the reader's own rows —
		// so what crosses the wire is a cast row id and a person id, scoped by
		// user_id on arrival. A client that sent a tvdb_id directly could name a
		// work in somebody else's library; one that sends a cast_id can only ever
		// name its own, and a row that is not theirs costs the ladder its top
		// rung rather than leaking that the row exists.
		CastID   int64 `json:"cast_id"`
		PersonID int64 `json:"person_id"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	uid := userID(r)
	kind := strings.TrimSpace(req.Kind)
	switch kind {
	case imageKindCover, imageKindPoster, imageKindPortrait, imageKindCharacter:
	default:
		writeErr(w, http.StatusBadRequest, "kind must be cover, poster, portrait or character")
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

	query := imageSearchQuery(kind, subject, req.Author, req.Actor, req.Title, req.MediaType, req.Year)
	googleOn := gkey != "" && gcx != ""

	// THE LADDER, ASSEMBLED BEFORE ANY RUNG RUNS. Order is priority, every rung
	// that applies still runs, and a rung that cannot run is simply absent — see
	// image_search_tiers.go for why that is the shape rather than a chain of ifs.
	var tiers []imageTier
	tier := func(t *imageTier) {
		if t != nil {
			tiers = append(tiers, *t)
		}
	}

	switch kind {
	case imageKindCharacter:
		// THE ROLE, FROM THE ONE SUPPLIER THAT HAS ROLES. Everything below it is
		// a search engine being asked to guess from a sentence.
		pin := s.castPinFor(uid, req.CastID)
		tier(s.tvdbCharacterTier(pin, subject))
		tier(s.wikimediaCharacterTier(firstNonEmpty(subject, pin.Character), req.Title))
	case imageKindPortrait:
		pin := s.personPinFor(uid, req.PersonID, subject)
		cast := s.castPinFor(uid, req.CastID)
		castPersonID := ""
		if cast.Source == "tvdb" {
			castPersonID = cast.PersonID
		}
		tier(s.tvdbPortraitTier(uid, pin, castPersonID, subject))
		tier(s.tmdbPortraitTier(pin, subject))
		tier(s.wikimediaPortraitTier(pin, subject))
	case imageKindCover:
		// KEYLESS AND FIRST, so a reader who has configured nothing at all still
		// gets something for a book they typed an ISBN into. This is the half of
		// "Amazon" that needs no permission and no cookie: the CDN indexes covers
		// by ISBN-10, and it is a direct address rather than a search.
		isbn, asin := req.ISBN, req.ASIN
		tier(&imageTier{name: "amazon-by-id", run: func(ctx context.Context) []metadata.ImageHit {
			var out []metadata.ImageHit
			for _, u := range amazonCoverURLs(isbn, asin) {
				if metadata.ImageIsReal(ctx, u) {
					out = append(out, metadata.ImageHit{URL: u, Source: "amazon"})
				}
			}
			return out
		}})
	}

	// GOOGLE SITS BELOW EVERY PINNED SUPPLIER AND ABOVE THE SCRAPE. It answers
	// every kind, which is precisely why it cannot be the top rung for the two
	// kinds that have a supplier holding the real thing.
	if googleOn {
		tier(&imageTier{name: "google", run: func(ctx context.Context) []metadata.ImageHit {
			hits, err := metadata.GoogleImageSearch(ctx, gkey, gcx, query, 10)
			if err != nil {
				// One source failing is not the request failing — the others may
				// have answered. Logged rather than shown, exactly as the catalogue
				// lookups do with a provider error.
				olog.Warnf(olog.CodeMetaLookupFailed, "[meta] google image search %q: %v", query, err)
				return nil
			}
			return hits
		}})
	}
	if amazonSuits(kind) && cookie != "" {
		tier(&imageTier{name: "amazon-search", run: func(ctx context.Context) []metadata.ImageHit {
			hits, err := metadata.AmazonImageSearch(ctx, query, cookie, domain, 8)
			if err != nil {
				return nil
			}
			return hits
		}})
	}

	names := make([]string, 0, len(tiers))
	for _, t := range tiers {
		names = append(names, t.name)
		add(t.run(r.Context())...)
		if len(images) >= imageSearchMax {
			break // the cap is spent, and it was spent from the top
		}
	}
	olog.Tracef("[meta] image ladder kind=%s tiers=%v -> %d hit(s)", kind, names, len(images))

	// `sources` NAMES EVERY RUNG THIS REQUEST HAD, not the two it used to have.
	// The client uses it to tell "nothing found" from "nothing configured", and
	// after the ladder those are no longer the same two suppliers for every kind:
	// a character strip can be fully configured with no Google key at all, and
	// reporting only google/amazon would have it announce an unconfigured app to
	// a reader whose TheTVDB key is working.
	srcs := map[string]bool{
		"google": googleOn,
		"amazon": amazonSuits(kind) && cookie != "",
	}
	for _, t := range tiers {
		switch t.name {
		case "tvdb", "tmdb", "wikimedia":
			srcs[t.name] = true
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"images": images, "sources": srcs})
}

// amazonSuits reports whether the Amazon search scrape has any business
// answering this kind of strip.
//
// IT IS A SHOP, AND THAT IS THE WHOLE ARGUMENT. Amazon's search page indexes
// PRODUCTS, so it answers a title with the edition somebody sells and a poster
// with the print somebody sells — which is exactly right for a cover and a
// poster, and worthless for a face. Asked for "Hugo Weaving as V in V for
// Vendetta", it returns the DVD, a T-shirt and a mask, because those are the
// things it has; asked for an author's portrait it returns their books. Every
// one of those is a confident, well-lit, entirely wrong picture, and they crowd
// out the suppliers that do have faces by filling the strip first.
//
// So this is a whitelist and not a blacklist: a kind added later gets no Amazon
// until somebody decides it should, which is the safe direction for a source
// whose failure mode is plausible-looking junk rather than an empty strip.
//
// THE `sources` FLAG FOLLOWS THE SAME RULE, deliberately. That flag exists so
// the client can tell "nothing found" from "nothing configured", and reporting
// Amazon as a live source on a portrait strip it will never contribute to makes
// the client blame the search for a supplier that was never asked.
func amazonSuits(kind string) bool {
	return kind == imageKindCover || kind == imageKindPoster
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
func imageSearchQuery(kind, subject, author, actor, title, mediaType string, year int) string {
	parts := []string{subject}
	switch kind {
	case imageKindCover:
		if a := strings.TrimSpace(author); a != "" {
			parts = append(parts, a)
		}
		parts = append(parts, "book cover")
	case imageKindPoster:
		// A GAME HAS COVER ART AND NOT A POSTER, which is the word its pictures are
		// published under — so this one does not go through mediaNoun.
		if mediaType == "game" {
			parts = append(parts, "game cover art")
		} else {
			parts = append(parts, mediaNoun(mediaType)+" poster")
		}
	case imageKindPortrait:
		parts = append(parts, "portrait photo")
	case imageKindCharacter:
		// "ACTOR as CHARACTER in TITLE" IS THE SENTENCE THAT FINDS A ROLE, and it
		// is worth writing out rather than concatenating names: "as" is how a
		// still is captioned everywhere pictures of one are published, so the
		// three words carry more than the three names do. `subject` is the
		// character, so the actor goes in FRONT of it and the title after.
		//
		// Without an actor — a book's character, a game's typed cast, anything
		// nobody is credited for — the same sentence loses its subject, so the
		// role is named as a role instead: "character in TITLE the game".
		parts = nil
		if a := strings.TrimSpace(actor); a != "" {
			parts = append(parts, a, "as", subject)
		} else {
			parts = append(parts, subject, "character")
		}
		if tt := strings.TrimSpace(title); tt != "" {
			parts = append(parts, "in", tt)
		}
		parts = append(parts, mediaNoun(mediaType))
	}
	// A YEAR DISAMBIGUATES A WORK AND NOT A FACE. Two films share a title far
	// more often than two people share a name, and a portrait search narrowed by
	// a year finds that person in that year, which is not what was asked.
	if year > 0 && kind != imageKindPortrait {
		parts = append(parts, strconv.Itoa(year))
	}
	return strings.Join(parts, " ")
}

// mediaNoun is what to call the work in a search sentence. "movie" is the
// default because it is the word an image search is indexed under, whatever the
// app calls a film elsewhere.
func mediaNoun(mediaType string) string {
	switch mediaType {
	case "show":
		return "tv series"
	case "game":
		return "game"
	case "book":
		return "book"
	default:
		return "movie"
	}
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
