package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"tippani/internal/metadata"
	"tippani/internal/olog"
)

// handleBookLookup implements POST /books/lookup (PLAN §6): on-demand only,
// candidate list -> user picks -> POST /books persists.
func (s *Server) handleBookLookup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ISBN   string `json:"isbn"`
		Title  string `json:"title"`
		Author string `json:"author"` // when known, refines + ranks the match (name AND author)
		ASIN   string `json:"asin"`   // Kindle/print ASIN — enables the Amazon source
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Author = strings.TrimSpace(req.Author)
	req.ISBN = strings.TrimSpace(req.ISBN)
	req.ASIN = strings.TrimSpace(req.ASIN)
	olog.Tracef("[meta] handleBookLookup isbn=%q title=%q asin=%q", req.ISBN, req.Title, req.ASIN)
	if req.ISBN == "" && req.Title == "" && req.ASIN == "" {
		writeErr(w, http.StatusBadRequest, "isbn, title, or asin is required")
		return
	}
	var isbn string
	if req.ISBN != "" {
		// The same reason the save form gives. A look-up is the OTHER place somebody
		// types an ISBN by hand, and it is where a mistyped one is most likely — the
		// number is being copied off a book at the time.
		if why := metadata.ISBNProblem(req.ISBN); why != "" {
			writeErr(w, http.StatusBadRequest, why)
			return
		}
		isbn = metadata.NormalizeISBN(req.ISBN)
	}
	gkey, err := s.Store.GetSetting(settingGoogleBooksKey)
	if err != nil {
		internalError(w, r, "load google books key", err)
		return
	}

	// Google Books + Open Library, only when there's an isbn/title to query.
	var cands []metadata.BookCandidate
	var searchErr error
	if isbn != "" || req.Title != "" {
		cands, searchErr = s.searchBooks(r.Context(), isbn, req.Title, req.Author, gkey)
		s.recordBooksLookup(searchErr) // GET /metadata/status surfaces this (§10)
	}

	// Amazon (opt-in): an ASIN + a stored session cookie. Best-effort and
	// prepended, since for Kindle books it's usually the best match; its errors
	// are swallowed so Google/OL results still show.
	if req.ASIN != "" {
		if cookie, _ := s.Store.GetSetting(settingAmazonCookie); cookie != "" {
			domain, _ := s.Store.GetSetting(settingAmazonDomain)
			if a, aerr := metadata.FetchAmazonBook(r.Context(), req.ASIN, cookie, domain); aerr == nil {
				if a.ISBN13 == "" {
					a.ISBN13 = isbn
				}
				cands = append([]metadata.BookCandidate{*a}, cands...)
			}
		}
	}

	if len(cands) == 0 {
		// Nothing found. The dominant keyless failure is Google's shared daily
		// quota (429) — say so with the one-step remedy, not a generic error.
		if errors.Is(searchErr, metadata.ErrQuota) {
			olog.Errorf(olog.CodeMetaLookupFailed, "[meta] book lookup isbn=%q title=%q: google quota/key rejected (own key set=%t): %v",
				isbn, req.Title, gkey != "", searchErr)
			msg := "Google Books' free shared quota is used up for today, and Open Library " +
				"had no match. Add your own free Google Books API key in Settings → Metadata " +
				"sources — it's instant and gives you a private quota."
			if gkey != "" {
				msg = "Your Google Books API key was rejected or is out of quota, and Open " +
					"Library had no match. Check the key in Settings → Metadata sources."
			}
			writeErr(w, http.StatusBadGateway, msg)
			return
		}
		if searchErr != nil {
			// The client only sees "book lookup failed" — log the real cause.
			olog.Errorf(olog.CodeMetaLookupFailed, "[meta] book lookup isbn=%q title=%q failed: %v", isbn, req.Title, searchErr)
			writeErr(w, http.StatusBadGateway, "book lookup failed")
			return
		}
	}
	if cands == nil {
		cands = []metadata.BookCandidate{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": cands})
}

// handleMovieLookup implements POST /movies/lookup (PLAN §6). It queries every
// configured supplier (TMDB and/or TheTVDB) for the requested media_type and
// merges the candidates, each tagged with its source — mirroring how book
// lookup blends Google Books + Open Library. A source with no key is skipped;
// only when NO source is configured do we answer 503.
//
// A tmdb_id/tvdb_id in the body PINS that supplier's record: it is fetched by
// id and listed first, ahead of whatever the title search guessed at. That is
// the point of being able to type the ids — a title search cannot tell two films
// called "Persuasion" apart, and an id can.
func (s *Server) handleMovieLookup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title     string `json:"title"`
		Year      int    `json:"year"`
		MediaType string `json:"media_type"` // "movie" (default) | "show" | "game"
		TMDBID    int64  `json:"tmdb_id"`    // pin TMDB's record for this id
		TVDBID    int64  `json:"tvdb_id"`    // pin TheTVDB's record for this id
		IGDBID    int64  `json:"igdb_id"`    // pin IGDB's record for this id
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" && req.TMDBID <= 0 && req.TVDBID <= 0 && req.IGDBID <= 0 {
		writeErr(w, http.StatusBadRequest, "title, tmdb_id, tvdb_id, or igdb_id is required")
		return
	}
	mediaType := "movie"
	switch req.MediaType {
	case "show", "game":
		mediaType = req.MediaType
	}

	// GAMES TAKE A DIFFERENT SUPPLIER ENTIRELY, so they branch before the
	// TMDB/TVDB pair rather than joining their candidate merge. Neither of those
	// two has games at all, so running them for a game would spend two requests
	// to guarantee zero hits — and, worse, a title that happens to name both a
	// film and a game ("Alan Wake") would return the FILM as a candidate for a
	// game lookup, which reads as a successful match.
	if mediaType == "game" {
		s.gameLookup(w, r, req.Title, req.Year, req.IGDBID)
		return
	}

	olog.Tracef("[meta] handleMovieLookup title=%q year=%d media=%s tmdb_id=%d tvdb_id=%d",
		req.Title, req.Year, mediaType, req.TMDBID, req.TVDBID)

	tmdb, _ := s.resolveTMDB()
	tvdb, _ := s.resolveTVDB()
	if tmdb == nil && tvdb == nil {
		writeErr(w, http.StatusServiceUnavailable, tmdbKeyMissing)
		return
	}

	// Pinned first, so the record the user named outranks every guess. A pin
	// that fails (wrong id, supplier down) is not fatal on its own — the title
	// search is still worth running — so its message is only surfaced at the end
	// if nothing at all came back.
	cands := []metadata.MovieCandidate{}
	pinMsg, pinCode := "", 0
	pin := func(source, sourceID string) {
		d, msg, code := s.fetchSourceDetails(r.Context(), source, sourceID, mediaType)
		if d == nil {
			olog.Tracef("[meta] movie lookup pin %s#%s failed: %s", source, sourceID, msg)
			if pinMsg == "" {
				pinMsg, pinCode = msg, code
			}
			return
		}
		cands = append(cands, d.Candidate())
	}
	if req.TMDBID > 0 && tmdb != nil {
		pin("tmdb", strconv.FormatInt(req.TMDBID, 10))
	}
	if req.TVDBID > 0 && tvdb != nil {
		pin("tvdb", strconv.FormatInt(req.TVDBID, 10))
	}
	// A pinned record would otherwise appear twice — once by id, once as its own
	// search hit — and the duplicate reads as two different matches.
	seen := map[string]bool{}
	for _, c := range cands {
		seen[c.Source+"#"+c.SourceID] = true
	}
	add := func(found []metadata.MovieCandidate) {
		for _, c := range found {
			if seen[c.Source+"#"+c.SourceID] {
				continue
			}
			seen[c.Source+"#"+c.SourceID] = true
			cands = append(cands, c)
		}
	}

	var firstErr error
	if tmdb != nil && req.Title != "" {
		var c []metadata.MovieCandidate
		var err error
		if mediaType == "show" {
			c, err = tmdb.SearchTV(r.Context(), req.Title, req.Year)
		} else {
			c, err = tmdb.Search(r.Context(), req.Title, req.Year)
		}
		if err != nil {
			firstErr = err
		} else {
			add(c)
		}
	}
	if tvdb != nil && req.Title != "" {
		if c, err := tvdb.Search(r.Context(), req.Title, req.Year, mediaType); err != nil {
			if firstErr == nil {
				firstErr = err
			}
		} else {
			add(c)
		}
	}
	olog.Tracef("[meta] movie lookup %q year=%d media=%s: tmdb=%t tvdb=%t -> %d candidate(s), err=%v",
		req.Title, req.Year, mediaType, tmdb != nil, tvdb != nil, len(cands), firstErr)

	// A lookup that was nothing but a pin has no search error to report, so the
	// pin's own failure is the only thing left to say.
	if len(cands) == 0 && firstErr == nil && pinMsg != "" {
		writeErr(w, pinCode, pinMsg)
		return
	}

	// Only surface an error when nothing came back at all — a partial failure
	// (one source down, the other returning hits) still yields useful results.
	if len(cands) == 0 && firstErr != nil {
		// The client only sees a short message; log the real provider cause.
		olog.Errorf(olog.CodeMetaLookupFailed, "[meta] movie lookup %q year=%d media=%s failed: %v",
			req.Title, req.Year, mediaType, firstErr)
		switch {
		case errors.Is(firstErr, metadata.ErrTMDBAuth):
			writeErr(w, http.StatusBadGateway,
				"TMDB rejected the key. A v4 token starts with 'ey' — paste the v3 API key "+
					"(not the account username) in Settings → Metadata sources, or re-check the token.")
		case errors.Is(firstErr, metadata.ErrTVDBAuth):
			writeErr(w, http.StatusBadGateway,
				"TheTVDB rejected the key — re-check it in Settings → Metadata sources.")
		default:
			writeErr(w, http.StatusBadGateway, "movie lookup failed")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": cands})
}

// gameLookup is the games arm of POST /movies/lookup. Same response shape as the
// film path — {candidates: [...]} — so the picker needs no second code path.
//
// A 503 for "no key" rather than an empty result, matching the film path: an
// empty candidate list means "IGDB has no such game", and answering that when the
// truth is "you never entered a key" sends the reader looking for a game that is
// there.
func (s *Server) gameLookup(w http.ResponseWriter, r *http.Request, title string, year int, igdbID int64) {
	olog.Tracef("[meta] gameLookup title=%q year=%d igdb_id=%d", title, year, igdbID)
	igdb, _ := s.resolveIGDB()

	cands := []metadata.MovieCandidate{}
	seen := map[string]bool{}
	add := func(found []metadata.MovieCandidate) {
		for _, c := range found {
			if seen[c.SourceID] {
				continue
			}
			seen[c.SourceID] = true
			cands = append(cands, c)
		}
	}

	// The pinned record first, exactly as the film path does it: an id names one
	// game and a title search cannot.
	var pinMsg string
	if igdbID > 0 && igdb != nil {
		if d, err := igdb.Details(r.Context(), strconv.FormatInt(igdbID, 10)); err == nil {
			add([]metadata.MovieCandidate{d.Candidate()})
		} else {
			olog.Tracef("[meta] game lookup pin igdb#%d failed: %v", igdbID, err)
			pinMsg = "that IGDB id did not resolve to a game"
			if errors.Is(err, metadata.ErrIGDBAuth) {
				pinMsg = ""
			}
		}
	}

	var searchErr error
	if title != "" && igdb != nil {
		if c, err := igdb.Search(r.Context(), title, year); err != nil {
			searchErr = err
		} else {
			add(c)
		}
	}

	// WIKIDATA IS THE FLOOR UNDER IGDB, and it runs only when IGDB did not
	// answer — never as a second opinion beside it.
	//
	// Games were the one medium in the app with no floor. Books need no key,
	// films run on a shared built-in TMDB key, and a game needed a Twitch
	// application, a client id and a secret before it could be looked up at all
	// — so the medium with the highest setup cost was also the only one that
	// answered 503 and told you to type it in yourself. It now degrades the way
	// the others do.
	//
	// Thinner, and deliberately tagged so: a Wikidata game usually arrives with
	// no cover art (the art is not freely licensed) and a one-line description
	// where IGDB gives a paragraph. The candidate carries `source: "wikidata"`,
	// so the picker can say where a record came from and the reader can see that
	// this one is the fallback before choosing it.
	//
	// The THREE cases are one case: unconfigured (igdb == nil), refused
	// credentials, and a query that errored all leave the reader with nothing,
	// which is the only thing this is for.
	if len(cands) == 0 && title != "" {
		if igdb == nil || searchErr != nil {
			wd, wdErr := metadata.SearchGamesWikidata(r.Context(), title, year)
			if wdErr != nil {
				olog.Tracef("[meta] game lookup wikidata fallback %q failed: %v", title, wdErr)
			} else {
				add(wd)
			}
			if len(cands) > 0 {
				olog.Tracef("[meta] game lookup %q served %d candidate(s) from wikidata", title, len(cands))
				// The fallback answering is not an error, so a search failure that
				// it covered for must not be reported as one below.
				searchErr, pinMsg = nil, ""
			}
		}
	}

	// Nothing anywhere, and no key at all: the message names the missing pair,
	// because "no results" would be false — nothing was asked.
	if len(cands) == 0 && igdb == nil && searchErr == nil {
		writeErr(w, http.StatusServiceUnavailable, igdbKeyMissing)
		return
	}
	if len(cands) == 0 && searchErr == nil && pinMsg != "" {
		writeErr(w, http.StatusNotFound, pinMsg)
		return
	}
	if len(cands) == 0 && searchErr != nil {
		olog.Errorf(olog.CodeMetaIGDBLookup, "[meta] game lookup %q year=%d failed: %v", title, year, searchErr)
		if errors.Is(searchErr, metadata.ErrIGDBAuth) {
			writeErr(w, http.StatusBadGateway,
				"IGDB rejected the credentials. Twitch answers a wrong client id OR secret the same way, "+
					"so re-check both in Settings → Metadata sources.")
			return
		}
		writeErr(w, http.StatusBadGateway, "game lookup failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": cands})
}
