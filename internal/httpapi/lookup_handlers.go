package httpapi

import (
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
	}
	if !decodeBody(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.ISBN = strings.TrimSpace(req.ISBN)
	if req.ISBN == "" && req.Title == "" {
		writeErr(w, http.StatusBadRequest, "isbn or title is required")
		return
	}
	var isbn string
	if req.ISBN != "" {
		if isbn = metadata.NormalizeISBN(req.ISBN); isbn == "" {
			writeErr(w, http.StatusBadRequest, "invalid isbn")
			return
		}
	}
	cands, err := metadata.SearchBooks(r.Context(), isbn, req.Title)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "book lookup failed")
		return
	}
	if cands == nil {
		cands = []metadata.BookCandidate{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": cands})
}

// handleMovieLookup implements POST /movies/lookup via TMDB (PLAN §6).
func (s *Server) handleMovieLookup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title"`
		Year  int    `json:"year"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title = strings.TrimSpace(req.Title); req.Title == "" {
		writeErr(w, http.StatusBadRequest, "title is required")
		return
	}
	if s.TMDB.Key == "" {
		writeErr(w, http.StatusServiceUnavailable, tmdbKeyMissing)
		return
	}
	cands, err := s.TMDB.Search(r.Context(), req.Title, req.Year)
	if err != nil {
		writeErr(w, http.StatusBadGateway, "movie lookup failed")
		return
	}
	if cands == nil {
		cands = []metadata.MovieCandidate{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": cands})
}
