package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"tippani/internal/metadata"
)

// handleBookLookup implements POST /books/lookup (PLAN §6): on-demand only,
// candidate list -> user picks -> POST /books persists.
func (s *Server) handleBookLookup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ISBN  string `json:"isbn"`
		Title string `json:"title"`
		ASIN  string `json:"asin"` // Kindle/print ASIN — enables the Amazon source
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.ISBN = strings.TrimSpace(req.ISBN)
	req.ASIN = strings.TrimSpace(req.ASIN)
	if req.ISBN == "" && req.Title == "" && req.ASIN == "" {
		writeErr(w, http.StatusBadRequest, "isbn, title, or asin is required")
		return
	}
	var isbn string
	if req.ISBN != "" {
		if isbn = metadata.NormalizeISBN(req.ISBN); isbn == "" {
			writeErr(w, http.StatusBadRequest, "invalid isbn")
			return
		}
	}
	gkey, err := s.Store.GetSetting(settingGoogleBooksKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Google Books + Open Library, only when there's an isbn/title to query.
	var cands []metadata.BookCandidate
	var searchErr error
	if isbn != "" || req.Title != "" {
		cands, searchErr = s.searchBooks(r.Context(), isbn, req.Title, gkey)
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
func (s *Server) handleMovieLookup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title     string `json:"title"`
		Year      int    `json:"year"`
		MediaType string `json:"media_type"` // "movie" (default) | "show"
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title = strings.TrimSpace(req.Title); req.Title == "" {
		writeErr(w, http.StatusBadRequest, "title is required")
		return
	}
	mediaType := "movie"
	if req.MediaType == "show" {
		mediaType = "show"
	}

	tmdb, _ := s.resolveTMDB()
	tvdb, _ := s.resolveTVDB()
	if tmdb == nil && tvdb == nil {
		writeErr(w, http.StatusServiceUnavailable, tmdbKeyMissing)
		return
	}

	cands := []metadata.MovieCandidate{}
	var firstErr error
	if tmdb != nil {
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
			cands = append(cands, c...)
		}
	}
	if tvdb != nil {
		if c, err := tvdb.Search(r.Context(), req.Title, req.Year, mediaType); err != nil {
			if firstErr == nil {
				firstErr = err
			}
		} else {
			cands = append(cands, c...)
		}
	}

	// Only surface an error when nothing came back at all — a partial failure
	// (one source down, the other returning hits) still yields useful results.
	if len(cands) == 0 && firstErr != nil {
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
