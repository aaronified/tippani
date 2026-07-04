// Package httpapi wires routes, sessions, CSRF, and security headers (PLAN §2, §7).
package httpapi

import (
	"context"
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/time/rate"

	"tippani/internal/auth"
	"tippani/internal/metadata"
	"tippani/internal/store"
)

type Server struct {
	Store        *store.Store
	Sessions     auth.Sessions
	CookieSecure bool // set true when your reverse proxy terminates TLS
	TrustedProxy bool // read client IP from X-Forwarded-For (only behind your own proxy)
	Static       fs.FS
	DataDir      string         // covers/posters live in <DataDir>/covers (PLAN §6)
	TMDB         *metadata.TMDB // empty Key -> movie lookup answers 503

	loginLimiter *auth.KeyedLimiter
}

func New(st *store.Store, static fs.FS, dataDir, tmdbKey string, cookieSecure, trustedProxy bool) *Server {
	return &Server{
		Store:        st,
		Sessions:     auth.Sessions{DB: st.DB},
		CookieSecure: cookieSecure,
		TrustedProxy: trustedProxy,
		Static:       static,
		DataDir:      dataDir,
		TMDB:         &metadata.TMDB{Key: tmdbKey},
		loginLimiter: auth.NewKeyedLimiter(rate.Limit(5.0/60.0), 5), // 5/min, burst 5
	}
}

// Handler builds the full middleware chain:
// security headers -> stdlib CSRF (Go 1.25 CrossOriginProtection) -> mux.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Auth. /auth/status and /auth/login are the only unauthenticated routes;
	// /auth/signup self-guards (it only works during first-run onboarding).
	mux.HandleFunc("GET /auth/status", s.handleStatus)
	mux.HandleFunc("POST /auth/signup", s.handleSignup)
	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.Handle("POST /auth/logout", s.requireAuth(s.handleLogout))
	mux.Handle("GET /auth/me", s.requireAuth(s.handleMe))
	mux.Handle("POST /auth/password", s.requireAuth(s.handlePassword))

	// User management — admin only (PLAN §2). The first user is the admin.
	mux.Handle("GET /admin/users", s.requireAdmin(s.handleListUsers))
	mux.Handle("POST /admin/users", s.requireAdmin(s.handleCreateUser))
	mux.Handle("DELETE /admin/users/{id}", s.requireAdmin(s.handleDeleteUser))

	// Search (PLAN §4).
	mux.Handle("GET /search", s.requireAuth(s.handleSearch))

	// Books + annotations (PLAN §3, §5a, §6).
	mux.Handle("POST /books/lookup", s.requireAuth(s.handleBookLookup))
	mux.Handle("POST /books", s.requireAuth(s.handleCreateBook))
	mux.Handle("GET /books", s.requireAuth(s.handleListBooks))
	mux.Handle("GET /books/{id}", s.requireAuth(s.handleGetBook))
	mux.Handle("PUT /books/{id}", s.requireAuth(s.handleUpdateBook))
	mux.Handle("DELETE /books/{id}", s.requireAuth(s.handleDeleteBook))
	mux.Handle("POST /annotations", s.requireAuth(s.handleCreateAnnotation))
	mux.Handle("GET /annotations", s.requireAuth(s.handleListAnnotations))
	mux.Handle("PUT /annotations/{id}", s.requireAuth(s.handleUpdateAnnotation))
	mux.Handle("DELETE /annotations/{id}", s.requireAuth(s.handleDeleteAnnotation))

	// Movies + dialogues (PLAN §3b, §6).
	mux.Handle("POST /movies/lookup", s.requireAuth(s.handleMovieLookup))
	mux.Handle("POST /movies", s.requireAuth(s.handleCreateMovie))
	mux.Handle("GET /movies", s.requireAuth(s.handleListMovies))
	mux.Handle("GET /movies/{id}", s.requireAuth(s.handleGetMovie))
	mux.Handle("PUT /movies/{id}", s.requireAuth(s.handleUpdateMovie))
	mux.Handle("DELETE /movies/{id}", s.requireAuth(s.handleDeleteMovie))
	mux.Handle("POST /dialogues", s.requireAuth(s.handleCreateDialogue))
	mux.Handle("GET /dialogues", s.requireAuth(s.handleListDialogues))
	mux.Handle("PUT /dialogues/{id}", s.requireAuth(s.handleUpdateDialogue))
	mux.Handle("DELETE /dialogues/{id}", s.requireAuth(s.handleDeleteDialogue))

	// Taxonomy, imports, local cover store (PLAN §5, §6, §7).
	mux.Handle("GET /genres", s.requireAuth(s.handleListGenres))
	mux.Handle("GET /tags", s.requireAuth(s.handleListTags))
	mux.Handle("POST /import/markdown", s.requireAuth(s.handleImportMarkdown))
	mux.Handle("POST /import/bookcision", s.requireAuth(s.handleImportBookcision))
	mux.Handle("POST /import/hardcover-html", s.requireAuth(s.handleImportHardcover))
	mux.Handle("POST /import/kindle-clippings", s.requireAuth(notImplemented)) // deferred (PLAN §5c)
	mux.Handle("GET /covers/{file}", s.requireAuth(s.handleCover))

	// Export (PLAN §6b): single-item markdown + whole-library zip.
	mux.Handle("GET /books/{id}/export", s.requireAuth(s.handleExportBook))
	mux.Handle("GET /movies/{id}/export", s.requireAuth(s.handleExportMovie))
	mux.Handle("GET /export", s.requireAuth(s.handleExportAll))

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Embedded SPA with index.html fallback.
	mux.Handle("/", s.spaHandler())

	csrf := http.NewCrossOriginProtection()
	return securityHeaders(csrf.Handler(mux))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data:; frame-ancestors 'none'")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

// ---- session middleware ----

type ctxKey int

const (
	ctxUserID ctxKey = iota
	ctxUsername
	ctxIsAdmin
)

const sessionCookie = "tippani_session"

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not logged in")
			return
		}
		uid, uname, isAdmin, err := s.Sessions.Validate(c.Value)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not logged in")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, uid)
		ctx = context.WithValue(ctx, ctxUsername, uname)
		ctx = context.WithValue(ctx, ctxIsAdmin, isAdmin)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireAdmin is requireAuth plus an is_admin check, for user management.
func (s *Server) requireAdmin(next http.HandlerFunc) http.Handler {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		if !isAdmin(r) {
			writeErr(w, http.StatusForbidden, "admin only")
			return
		}
		next(w, r)
	})
}

func userID(r *http.Request) int64    { v, _ := r.Context().Value(ctxUserID).(int64); return v }
func username(r *http.Request) string { v, _ := r.Context().Value(ctxUsername).(string); return v }
func isAdmin(r *http.Request) bool    { v, _ := r.Context().Value(ctxIsAdmin).(bool); return v }

func (s *Server) clientIP(r *http.Request) string {
	if s.TrustedProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			// Trust only the RIGHTMOST entry: a single reverse proxy appends the
			// real client IP to whatever the client already sent, so everything
			// left of the last comma is client-forgeable. Reading the leftmost
			// entry let an attacker rotate a fake IP per request and mint a fresh
			// rate-limiter bucket each time, defeating the login brute-force /
			// bcrypt-DoS protection (PLAN §2).
			if i := strings.LastIndexByte(xff, ','); i >= 0 {
				return strings.TrimSpace(xff[i+1:])
			}
			return strings.TrimSpace(xff)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---- helpers ----

// maxCRUDBody caps JSON request bodies; imports have their own 5 MB cap.
const maxCRUDBody = 64 << 10

// decodeBody reads a JSON body (capped at maxCRUDBody) into v.
// On failure it writes a 400 and returns false.
func decodeBody(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxCRUDBody)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

// pathID parses the {id} wildcard.
func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

// nullable maps "" to NULL so the partial unique indexes (isbn/asin/tmdb_id)
// and COALESCE reads behave — an absent value is not an identity.
func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableInt(n int) any {
	if n == 0 {
		return nil
	}
	return n
}

// validYear: 0 means absent; anything else must be a plausible year.
func validYear(y int) bool { return y == 0 || (y >= 1000 && y <= 3000) }

// trimCap trims s and enforces the rune cap on short free-text fields
// (chapter/location/timestamp/character/actor).
func trimCap(s string, max int) (string, bool) {
	s = strings.TrimSpace(s)
	return s, len([]rune(s)) <= max
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func notImplemented(w http.ResponseWriter, _ *http.Request) {
	writeErr(w, http.StatusNotImplemented, "not implemented yet")
}

func (s *Server) spaHandler() http.Handler {
	fileServer := http.FileServerFS(s.Static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(s.Static, path); err != nil {
			// SPA fallback: unknown paths get index.html.
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
