// Package httpapi wires routes, sessions, CSRF, and security headers (PLAN §2, §7).
package httpapi

import (
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/time/rate"

	"tippani/internal/auth"
	"tippani/internal/metadata"
	"tippani/internal/olog"
	"tippani/internal/store"
	"tippani/internal/updater"
)

type Server struct {
	Store        *store.Store
	Sessions     auth.Sessions
	CookieSecure bool // set true when your reverse proxy terminates TLS
	TrustedProxy bool // read client IP from X-Forwarded-For (only behind your own proxy)
	SeedNewUsers bool // seed the starter tag/sticker vocabulary on user creation (v3); off in tests
	Static       fs.FS
	DataDir      string         // covers/posters live in <DataDir>/MediaCover (PLAN §6)
	TMDB         *metadata.TMDB // Key = env-provided key; resolveTMDB falls through to settings/built-in
	TMDBBuiltin  string         // built-in app key, the last fallback before 503 (defaultTMDBKey in cmd/tippani)
	TVDB         *metadata.TVDB // Key = env-provided TheTVDB key; resolveTVDB falls through to settings (no built-in)

	loginLimiter *auth.KeyedLimiter

	// Outbound-call seams: production implementations set in New, stubbed in
	// tests (same idea as metadata's TMDB.BaseURL).
	fetchImage     func(ctx context.Context, rawURL, destDir string) (string, error)
	fetchUserImage func(ctx context.Context, rawURL, destDir string) (string, error) // user-typed URL: no host allowlist
	searchBooks    func(ctx context.Context, isbn, title, author, googleKey string) ([]metadata.BookCandidate, error)
	googleVolume   func(ctx context.Context, id, key string) (*metadata.BookCandidate, error) // re-verify by pinned google_id
	authorLinks    func(ctx context.Context, name string) (map[string]string, error)
	actorLinks     func(ctx context.Context, t *metadata.TMDB, name string) (map[string]string, error)
	resolveAuthor  func(ctx context.Context, name string, bookTitles []string) (metadata.AuthorResolution, error)

	// booksLookup remembers the most recent POST /books/lookup outcome for
	// GET /metadata/status; nil = never tried. In-memory by design (§10).
	booksLookup atomic.Pointer[lookupOutcome]

	// Update-check seams (Settings → Updates, admin): the GitHub API base and a
	// factory for the Docker-socket client, both stubbed in tests.
	GitHubAPI string
	newDocker func() UpdateDocker

	// One-shot quote-image downloads (share_handlers.go): token → staged PNG,
	// lazily initialized under the lock.
	shareMu     sync.Mutex
	shareImages map[string]shareEntry
}

func New(st *store.Store, static fs.FS, dataDir string, cookieSecure, trustedProxy bool) *Server {
	return &Server{
		Store:          st,
		Sessions:       auth.Sessions{DB: st.DB},
		CookieSecure:   cookieSecure,
		TrustedProxy:   trustedProxy,
		SeedNewUsers:   true,
		Static:         static,
		DataDir:        dataDir,
		// TMDB.Key is a direct/programmatic override (embedders/tests); it is no
		// longer read from the environment — production keys come from Settings
		// or the built-in slot (see resolveTMDB).
		TMDB:           &metadata.TMDB{},
		TVDB:           &metadata.TVDB{},                              // key configured in Settings (resolveTVDB); no env slot
		loginLimiter:   auth.NewKeyedLimiter(rate.Limit(5.0/60.0), 5), // 5/min, burst 5
		fetchImage:     metadata.FetchImage,
		fetchUserImage: metadata.FetchUserImage,
		searchBooks:    metadata.SearchBooks,
		googleVolume:   metadata.FetchGoogleVolume,
		authorLinks:    metadata.AuthorLinks,
		actorLinks: func(ctx context.Context, t *metadata.TMDB, name string) (map[string]string, error) {
			return t.PersonLinks(ctx, name)
		},
		resolveAuthor: metadata.ResolveAuthor,
		GitHubAPI:     updater.DefaultGitHubAPI,
		newDocker:     func() UpdateDocker { return updater.NewDocker(updater.DockerSock()) },
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
	mux.Handle("PUT /auth/me", s.requireAuth(s.handleUpdateMe))
	mux.Handle("PUT /auth/me/preferences", s.requireAuth(s.handleUpdatePreferences))
	mux.Handle("POST /auth/me/avatar", s.requireAuth(s.handleUploadAvatar))
	mux.Handle("DELETE /auth/me/avatar", s.requireAuth(s.handleDeleteAvatar))
	mux.Handle("POST /auth/password", s.requireAuth(s.handlePassword))

	// User management — admin only (PLAN §2). The first user is the admin.
	mux.Handle("GET /admin/users", s.requireAdmin(s.handleListUsers))
	mux.Handle("POST /admin/users", s.requireAdmin(s.handleCreateUser))
	mux.Handle("PATCH /admin/users/{id}", s.requireAdmin(s.handleSetUserAdmin))
	mux.Handle("DELETE /admin/users/{id}", s.requireAdmin(s.handleDeleteUser))

	// Settings-managed metadata keys + admin cover maintenance (§10).
	mux.Handle("GET /admin/metadata-keys", s.requireAdmin(s.handleGetMetadataKeys))
	mux.Handle("PUT /admin/metadata-keys", s.requireAdmin(s.handlePutMetadataKeys))
	mux.Handle("POST /covers/refetch", s.requireAdmin(s.handleCoversRefetch))
	// Maintenance (admin): rebuild the search indexes (non-destructive) and the
	// factory reset (destructive) behind Profile.
	mux.Handle("POST /admin/search/reindex", s.requireAdmin(s.handleReindexFTS))
	mux.Handle("POST /admin/reset", s.requireAdmin(s.handleResetDatabase))
	// Updates (admin): check GitHub for a newer release, and (Docker socket
	// permitting) pull it and recreate this container in one click.
	mux.Handle("GET /admin/update/check", s.requireAdmin(s.handleUpdateCheck))
	mux.Handle("POST /admin/update/apply", s.requireAdmin(s.handleUpdateApply))

	// Search (PLAN §4).
	mux.Handle("GET /search", s.requireAuth(s.handleSearch))

	// One-shot quote-image downloads (share_handlers.go). The GET is public by
	// design: the single-use crypto-random token is the credential, because
	// WebView wrappers download outside the page's cookie jar.
	mux.Handle("POST /share/image", s.requireAuth(s.handleShareImageUpload))
	mux.HandleFunc("GET /share/image/{token}", s.handleShareImageDownload)

	// People metadata (§ author/actor enrichment): per-name bio/photo/links,
	// keyed by (kind, name) and matched to books/films by exact author/actor.
	mux.Handle("GET /people", s.requireAuth(s.handlePeople))
	mux.Handle("GET /people/names", s.requireAuth(s.handlePeopleNames))
	mux.Handle("POST /people/lookup", s.requireAuth(s.handlePersonLookup))
	mux.Handle("POST /people/portrait", s.requireAuth(s.handlePersonPortrait))
	mux.Handle("POST /people/rename", s.requireAuth(s.handleRenamePerson))
	mux.Handle("PUT /people", s.requireAuth(s.handleUpsertPerson))
	mux.Handle("DELETE /people/{id}", s.requireAuth(s.handleDeletePerson))

	// Books + annotations (PLAN §3, §5a, §6).
	mux.Handle("POST /books/lookup", s.requireAuth(s.handleBookLookup))
	mux.Handle("POST /books", s.requireAuth(s.handleCreateBook))
	mux.Handle("GET /books", s.requireAuth(s.handleListBooks))
	mux.Handle("GET /books/{id}", s.requireAuth(s.handleGetBook))
	mux.Handle("PUT /books/{id}", s.requireAuth(s.handleUpdateBook))
	mux.Handle("POST /books/{id}/cover", s.requireAuth(s.handleUploadBookCover))
	mux.Handle("DELETE /books/{id}", s.requireAuth(s.handleDeleteBook))
	mux.Handle("POST /annotations", s.requireAuth(s.handleCreateAnnotation))
	mux.Handle("GET /annotations", s.requireAuth(s.handleListAnnotations))
	mux.Handle("PUT /annotations/{id}", s.requireAuth(s.handleUpdateAnnotation))
	mux.Handle("DELETE /annotations/{id}", s.requireAuth(s.handleDeleteAnnotation))
	// Spaced repetition — Daily Quiz & Practice (v0.5.0, ROADMAP №2). One
	// retrieval model over books (annotations) and films/shows (dialogues).
	mux.Handle("GET /review/daily", s.requireAuth(s.handleDailyQuiz))
	mux.Handle("GET /review/practice", s.requireAuth(s.handlePractice))
	mux.Handle("POST /review/answer", s.requireAuth(s.handleReviewAnswer))
	mux.Handle("POST /review/seen", s.requireAuth(s.handleReviewSeen))
	mux.Handle("GET /review/scores", s.requireAuth(s.handleReviewScores))
	mux.Handle("DELETE /review/practice", s.requireAuth(s.handlePracticeReset))

	// Movies + dialogues (PLAN §3b, §6).
	mux.Handle("POST /movies/lookup", s.requireAuth(s.handleMovieLookup))
	mux.Handle("POST /movies", s.requireAuth(s.handleCreateMovie))
	mux.Handle("GET /movies", s.requireAuth(s.handleListMovies))
	mux.Handle("GET /movies/{id}", s.requireAuth(s.handleGetMovie))
	mux.Handle("PUT /movies/{id}", s.requireAuth(s.handleUpdateMovie))
	mux.Handle("POST /movies/{id}/cover", s.requireAuth(s.handleUploadMoviePoster))
	mux.Handle("DELETE /movies/{id}", s.requireAuth(s.handleDeleteMovie))
	mux.Handle("POST /dialogues", s.requireAuth(s.handleCreateDialogue))
	mux.Handle("GET /dialogues", s.requireAuth(s.handleListDialogues))
	mux.Handle("PUT /dialogues/{id}", s.requireAuth(s.handleUpdateDialogue))
	mux.Handle("DELETE /dialogues/{id}", s.requireAuth(s.handleDeleteDialogue))

	// Taxonomy, imports, local cover store (PLAN §5, §6, §7).
	// Tags are a managed vocabulary with colour + style (§10).
	mux.Handle("GET /genres", s.requireAuth(s.handleListGenres))
	mux.Handle("GET /tags", s.requireAuth(s.handleListTags))
	mux.Handle("POST /tags", s.requireAuth(s.handleCreateTag))
	mux.Handle("PUT /tags/{id}", s.requireAuth(s.handleUpdateTag))
	mux.Handle("DELETE /tags/{id}", s.requireAuth(s.handleDeleteTag))
	// Stickers: uploaded images managed on the Tags page, one attachable per
	// annotation/dialogue (§ sticker feature).
	mux.Handle("GET /stickers", s.requireAuth(s.handleListStickers))
	mux.Handle("POST /stickers", s.requireAuth(s.handleUploadSticker))
	mux.Handle("PUT /stickers/{id}", s.requireAuth(s.handleUpdateSticker))
	mux.Handle("DELETE /stickers/{id}", s.requireAuth(s.handleDeleteSticker))
	mux.Handle("POST /import/markdown", s.requireAuth(s.handleImportMarkdown))
	mux.Handle("POST /import/bookcision", s.requireAuth(s.handleImportBookcision))
	mux.Handle("POST /import/hardcover-html", s.requireAuth(s.handleImportHardcover))
	mux.Handle("POST /import/goodreads-html", s.requireAuth(s.handleImportGoodreads))
	mux.Handle("POST /import/kindle-notebook", s.requireAuth(s.handleImportKindleNotebook)) // read.amazon.com/notebook
	mux.Handle("POST /import/imdb-quotes", s.requireAuth(s.handleImportIMDb))               // movies/dialogues (PLAN §5)
	mux.Handle("POST /import/kindle-clippings", s.requireAuth(notImplemented))              // deferred (PLAN §5c)
	mux.Handle("GET /covers/{file}", s.requireAuth(s.handleCover))

	// Export (PLAN §6b): single-item markdown + whole-library zip.
	mux.Handle("GET /books/{id}/export", s.requireAuth(s.handleExportBook))
	mux.Handle("GET /movies/{id}/export", s.requireAuth(s.handleExportMovie))
	mux.Handle("GET /export", s.requireAuth(s.handleExportAll))
	// Export a chosen set (the in-view/filtered set the UI passes) as one
	// multi-item markdown file; empty ids => everything of that kind.
	mux.Handle("POST /export/books", s.requireAuth(s.handleExportBooks))
	mux.Handle("POST /export/movies", s.requireAuth(s.handleExportMovies))

	// Library stats + metadata source status (§10).
	mux.Handle("GET /stats", s.requireAuth(s.handleStats))
	mux.Handle("GET /metadata/status", s.requireAuth(s.handleMetadataStatus))
	// Force-fetch & re-verify (ROADMAP §2): preview per-field diffs against the
	// live sources (nothing written), then apply only the approved fields. Own
	// rows only, so requireAuth — the per-call cap bounds provider load.
	mux.Handle("POST /metadata/reverify", s.requireAuth(s.handleMetadataReverify))
	mux.Handle("POST /metadata/reverify/apply", s.requireAuth(s.handleMetadataReverifyApply))
	// Metadata tab: review-and-fill overview + bulk dialogue speaker remap.
	mux.Handle("GET /metadata/library", s.requireAuth(s.handleMetadataLibrary))
	mux.Handle("POST /movies/{id}/remap-speakers", s.requireAuth(s.handleRemapSpeakers))
	// Bulk metadata management (Calibre-inspired): batch field correction,
	// duplicate detection, and merge — books.
	mux.Handle("POST /books/bulk", s.requireAuth(s.handleBulkUpdateBooks))
	mux.Handle("POST /books/merge", s.requireAuth(s.handleMergeBooks))
	mux.Handle("GET /metadata/duplicates", s.requireAuth(s.handleBookDuplicates))
	// Bulk actions over a selection (e.g. from search results): tag a set of
	// annotations/dialogues, field-correct a set of films/shows.
	mux.Handle("POST /movies/bulk", s.requireAuth(s.handleBulkUpdateMovies))
	mux.Handle("POST /annotations/bulk", s.requireAuth(s.handleBulkTagAnnotations))
	mux.Handle("POST /dialogues/bulk", s.requireAuth(s.handleBulkTagDialogues))

	// The mux above owns every JSON + covers route. Mount it under /api so the
	// root path space belongs to the client-side router (the SPA); a thin outer
	// mux keeps /healthz at the root for ops and serves the SPA (index.html
	// fallback) for everything else — so a hard refresh on /library or /books/42
	// loads the app instead of hitting an API route.
	root := http.NewServeMux()
	root.Handle("/api/", http.StripPrefix("/api", mux))
	root.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	root.Handle("/", s.spaHandler())

	csrf := http.NewCrossOriginProtection()
	return logRequests(securityHeaders(csrf.Handler(root)))
}

// statusRecorder captures the response status + byte count for request logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

// logRequests logs one line per request (method, path, status, duration, size,
// client) to stdout — visible in `docker logs`. /healthz is skipped so the
// container's periodic probe doesn't drown the log. This is the baseline
// visibility; handlers add [error]/[import]/[movies] lines for detail.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		rid := nextReqID()
		r = r.WithContext(context.WithValue(r.Context(), ctxReqID, rid))
		rec := &statusRecorder{ResponseWriter: w}
		start := time.Now()
		next.ServeHTTP(rec, r)
		if rec.status == 0 {
			rec.status = http.StatusOK
		}
		// rid ties this summary line to any [error]/[warn]/[trace] lines the
		// handler logged for the same request (they all carry "(req rNNN)").
		log.Printf("%s %s %d %s %dB %s %s",
			r.Method, r.URL.RequestURI(), rec.status,
			time.Since(start).Round(time.Millisecond), rec.bytes, r.RemoteAddr, rid)
	})
}

// codedError logs the real cause of a 500 server-side with a stable lookup code
// (see internal/olog/codes.go + docs/troubleshoot.md), then returns the opaque
// "internal error" to the client — the cause never leaks into the response
// (ROADMAP §12). The line is `[error] TIP-XXX-NNN METHOD PATH (req rNNN): ctx: err`,
// so an operator greps the code, and the req id ties it to the request's summary
// line. Prefer this over internalError in new/updated handlers.
func codedError(w http.ResponseWriter, r *http.Request, code olog.Code, ctx string, err error) {
	olog.Errorf(code, "%s %s%s: %s: %v", r.Method, r.URL.Path, reqSuffix(r), ctx, err)
	writeErr(w, http.StatusInternalServerError, "internal error")
}

// internalError is the generic 500 funnel — codedError with the catch-all
// TIP-HTTP-000. It stays for the many call sites not yet assigned a specific code;
// the per-subsystem rollout migrates them to codedError with a precise code.
func internalError(w http.ResponseWriter, r *http.Request, ctx string, err error) {
	codedError(w, r, olog.CodeHTTPInternal, ctx, err)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		// img-src also allows the metadata cover CDNs so candidate thumbnails and
		// the cover picker can preview remote images before they're fetched and
		// stored locally (matches metadata.coverHosts).
		// font-src allows data: because Vite inlines small @fontsource subset files
		// (< 4 KB) as base64 data: URIs; without it default-src blocks them and those
		// glyphs silently fall back to a system face. data: fonts are inert (parsed,
		// never executed), same rationale as data: images above.
		h.Set("Content-Security-Policy",
			"default-src 'self'; font-src 'self' data:; img-src 'self' data: "+
				"https://covers.openlibrary.org https://books.google.com "+
				"https://books.googleusercontent.com https://image.tmdb.org "+
				"https://artworks.thetvdb.com "+
				// OL covers redirect to archive.org download nodes; CSP checks
				// redirect targets, so previews need these hosts too.
				"https://archive.org https://*.us.archive.org "+
				"https://images-na.ssl-images-amazon.com https://m.media-amazon.com "+
				// Wikidata portraits (re-verify previews a fresh author photo by URL).
				"https://commons.wikimedia.org https://upload.wikimedia.org; "+
				"frame-ancestors 'none'")
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
	ctxReqID
)

// reqSeq numbers requests within a process run so every log line for one request
// shares an id (ROADMAP §12). A counter — not a random id — is enough to correlate
// lines in `docker logs`; it resets on restart, which is fine.
var reqSeq atomic.Uint64

func nextReqID() string { return "r" + strconv.FormatUint(reqSeq.Add(1), 10) }

// reqID returns the current request's correlation id (empty outside a served
// request, e.g. in tests that bypass logRequests).
func reqID(r *http.Request) string { v, _ := r.Context().Value(ctxReqID).(string); return v }

// reqSuffix renders the request id for a log line as " (req rNNN)", or "" if none.
func reqSuffix(r *http.Request) string {
	if id := reqID(r); id != "" {
		return " (req " + id + ")"
	}
	return ""
}

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

// nullableFloat maps 0 to NULL — used for series_index, where "unset" and
// "position 0" are not meaningfully distinct for a reading/watch order.
func nullableFloat(f float64) any {
	if f == 0 {
		return nil
	}
	return f
}

// nullableInt64 maps 0 to NULL for the partial-unique id columns (tmdb_id/tvdb_id).
func nullableInt64(n int64) any {
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
