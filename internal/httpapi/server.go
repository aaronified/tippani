// Package httpapi wires routes, sessions, CSRF, and security headers (PLAN §2, §7).
package httpapi

import (
	"context"
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"strings"

	"golang.org/x/time/rate"

	"tippani/internal/auth"
	"tippani/internal/store"
)

type Server struct {
	Store        *store.Store
	Sessions     auth.Sessions
	CookieSecure bool // set true when your reverse proxy terminates TLS
	TrustedProxy bool // read client IP from X-Forwarded-For (only behind your own proxy)
	Static       fs.FS

	loginLimiter *auth.KeyedLimiter
}

func New(st *store.Store, static fs.FS, cookieSecure, trustedProxy bool) *Server {
	return &Server{
		Store:        st,
		Sessions:     auth.Sessions{DB: st.DB},
		CookieSecure: cookieSecure,
		TrustedProxy: trustedProxy,
		Static:       static,
		loginLimiter: auth.NewKeyedLimiter(rate.Limit(5.0/60.0), 5), // 5/min, burst 5
	}
}

// Handler builds the full middleware chain:
// security headers -> stdlib CSRF (Go 1.25 CrossOriginProtection) -> mux.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Auth (login is the only unauthenticated API route).
	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.Handle("POST /auth/logout", s.requireAuth(s.handleLogout))
	mux.Handle("GET /auth/me", s.requireAuth(s.handleMe))
	mux.Handle("POST /auth/password", s.requireAuth(s.handlePassword))

	// Search (PLAN §4).
	mux.Handle("GET /search", s.requireAuth(s.handleSearch))

	// Not yet implemented (PLAN §5–§7 build order).
	for _, pattern := range []string{
		"POST /books/lookup",
		"POST /books", "GET /books", "GET /books/{id}", "PUT /books/{id}", "DELETE /books/{id}",
		"POST /annotations", "GET /annotations", "PUT /annotations/{id}", "DELETE /annotations/{id}",
		"GET /genres", "GET /tags",
		"POST /import/markdown", "POST /import/kindle-clippings", "POST /import/bookcision",
		"GET /covers/{file}",
	} {
		mux.Handle(pattern, s.requireAuth(notImplemented))
	}

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
)

const sessionCookie = "tippani_session"

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not logged in")
			return
		}
		userID, username, err := s.Sessions.Validate(c.Value)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not logged in")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, userID)
		ctx = context.WithValue(ctx, ctxUsername, username)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func userID(r *http.Request) int64    { v, _ := r.Context().Value(ctxUserID).(int64); return v }
func username(r *http.Request) string { v, _ := r.Context().Value(ctxUsername).(string); return v }

func (s *Server) clientIP(r *http.Request) string {
	if s.TrustedProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if i := strings.IndexByte(xff, ','); i >= 0 {
				return strings.TrimSpace(xff[:i])
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
