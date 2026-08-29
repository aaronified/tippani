// Package httpapi wires routes, sessions, CSRF, and security headers (PLAN §2, §7).
package httpapi

import (
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"net"
	"net/http"
	"path"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/time/rate"

	"tippani/internal/auth"
	"tippani/internal/i18n"
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
	TVDBBuiltin  string         // ditto for TheTVDB, the default film/show source (defaultTVDBKey)
	TVDB         *metadata.TVDB // Key = env-provided TheTVDB key; resolveTVDB falls through to settings (no built-in)
	// IGDB is the games supplier (0040). Unlike the others it needs a PAIR of
	// credentials — a Twitch client id and secret — so resolveIGDB treats them
	// as one setting that is either complete or absent.
	IGDB *metadata.IGDB

	// Devices holds the bearer credentials native clients carry (the Android app
	// under mobile/). Separate from Sessions on purpose — see auth.DeviceTokens.
	Devices auth.DeviceTokens

	loginLimiter *auth.KeyedLimiter

	// pairingLimiter throttles the one unauthenticated route that hands out a
	// credential (POST /auth/devices/claim), on the same reasoning as the login
	// limiter: a short pairing code is only unguessable while guessing is slow.
	pairingLimiter *auth.KeyedLimiter

	// pairingCodes are the outstanding device-pairing codes, code -> owner and
	// expiry. In memory by design (see pairing_handlers.go): they live minutes,
	// so a restart costs one extra tap and the schema stays clean.
	pairingMu    sync.Mutex
	pairingCodes map[string]pairingCode

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

	// backupMu serializes backup/restore (backup_handlers.go) — concurrent runs
	// would race on the backups dir and the swap. TryLock → 409 when busy.
	backupMu sync.Mutex

	// locales caches the parsed contents of <DataDir>/Locales, re-read when a file
	// there changes. Not a sync.Once like internal/changelog's: those bytes are
	// embedded and cannot move, these are edited under a running server and design
	// §4's promise is "drop it in and it appears". See internal/i18n.
	locales i18n.Overrides
}

func New(st *store.Store, static fs.FS, dataDir string, cookieSecure, trustedProxy bool) *Server {
	return &Server{
		Store:        st,
		Sessions:     auth.Sessions{DB: st.DB},
		Devices:      auth.DeviceTokens{DB: st.DB},
		CookieSecure: cookieSecure,
		TrustedProxy: trustedProxy,
		SeedNewUsers: true,
		Static:       static,
		DataDir:      dataDir,
		// TMDB.Key is a direct/programmatic override (embedders/tests); it is no
		// longer read from the environment — production keys come from Settings
		// or the built-in slot (see resolveTMDB).
		TMDB:         &metadata.TMDB{},
		TVDB:         &metadata.TVDB{},                              // key configured in Settings (resolveTVDB); no env slot
		loginLimiter: auth.NewKeyedLimiter(rate.Limit(5.0/60.0), 5), // 5/min, burst 5
		// Pairing is a deliberate, one-at-a-time act, so it can be tighter than
		// login: a burst of 10 covers a mistyped code or two, then 5/min.
		pairingLimiter: auth.NewKeyedLimiter(rate.Limit(5.0/60.0), 10),
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
		newDocker:     func() UpdateDocker { return updater.NewDocker(updater.DockerEndpoint()) },
	}
}

// Handler builds the full middleware chain:
// security headers -> stdlib CSRF (Go 1.25 CrossOriginProtection) -> mux.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Auth. /auth/status and /auth/login are the only unauthenticated routes;
	// /auth/signup and /auth/restore self-guard (they only work during
	// first-run onboarding, while the users table is empty).
	// Version handshake for independently-updated clients (mobile/), before any
	// credential exists — see capabilities_handler.go.
	mux.HandleFunc("GET /capabilities", s.handleCapabilities)

	// The words the interface is in. PUBLIC, and it has to be: the login screen
	// and the first-run screen render before a session exists, and they are the
	// two screens a reader who does not read English meets first. See
	// locale_handlers.go for the whole argument.
	mux.HandleFunc("GET /locales", s.handleLocales)

	mux.HandleFunc("GET /auth/status", s.handleStatus)
	mux.HandleFunc("POST /auth/signup", s.handleSignup)
	mux.HandleFunc("POST /auth/restore", s.handleOnboardRestore)
	mux.HandleFunc("POST /auth/restore/upload", s.handleOnboardRestoreUpload)
	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.Handle("POST /auth/logout", s.requireAuth(s.handleLogout))
	mux.Handle("GET /auth/me", s.requireAuth(s.handleMe))
	mux.Handle("PUT /auth/me", s.requireAuth(s.handleUpdateMe))
	mux.Handle("PUT /auth/me/preferences", s.requireAuth(s.handleUpdatePreferences))
	mux.Handle("POST /auth/me/avatar", s.requireAuth(s.handleUploadAvatar))
	mux.Handle("DELETE /auth/me/avatar", s.requireAuth(s.handleDeleteAvatar))
	mux.Handle("POST /auth/password", s.requireAuth(s.handlePassword))

	// Device pairing for native clients (mobile/). /auth/devices/claim is the
	// only unauthenticated one — the phone has no credential yet — and is rate
	// limited in the handler; see pairing_handlers.go.
	mux.Handle("POST /auth/devices/pair", s.requireAuth(s.handleStartPairing))
	mux.HandleFunc("POST /auth/devices/claim", s.handleClaimPairing)
	mux.Handle("GET /auth/devices", s.requireAuth(s.handleListDevices))
	mux.Handle("DELETE /auth/devices/{id}", s.requireAuth(s.handleRevokeDevice))
	mux.Handle("POST /auth/devices/revoke-all", s.requireAuth(s.handleRevokeAllDevices))

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
	// Backup & restore (backup_handlers.go): dated tar.gz of the whole data
	// dir, newest kept server-side; restore swaps the data dir in-process, from
	// either that kept archive or one uploaded from another server (…/upload).
	mux.Handle("GET /admin/backup", s.requireAdmin(s.handleBackupStatus))
	mux.Handle("POST /admin/backup", s.requireAdmin(s.handleBackupCreate))
	mux.Handle("GET /admin/backup/download", s.requireAdmin(s.handleBackupDownload))
	mux.Handle("POST /admin/restore", s.requireAdmin(s.handleRestore))
	mux.Handle("POST /admin/restore/upload", s.requireAdmin(s.handleRestoreUpload))
	// Updates (admin): check GitHub for a newer release, and (Docker socket
	// permitting) pull it and recreate this container in one click.
	// The release history is READ-ONLY and public knowledge, so it is behind
	// requireAuth rather than requireAdmin even though the button that opens it
	// sits on the admin-only Updates card. See handleChangelog.
	mux.Handle("GET /changelog", s.requireAuth(s.handleChangelog))
	mux.Handle("GET /admin/update/check", s.requireAdmin(s.handleUpdateCheck))
	mux.Handle("POST /admin/update/apply", s.requireAdmin(s.handleUpdateApply))
	mux.Handle("POST /admin/update/channel", s.requireAdmin(s.handleUpdateChannel))

	// Search (PLAN §4).
	mux.Handle("GET /search", s.requireAuth(s.handleSearch))
	// The reader's own vocabulary, for the facet dropdown: one call on first focus,
	// held for the session, narrowed in the browser. Per user without exception.
	mux.Handle("GET /search/vocabulary", s.requireAuth(s.handleSearchVocabulary))
	// Its own route rather than a flag on /search: the counts are wanted when
	// the Filters panel is open and never while somebody is typing, and folding
	// them in would put thirty GROUP BYs behind every keystroke of a typeahead.
	mux.Handle("GET /search/facets", s.requireAuth(s.handleSearchFacetCounts))

	// Serendipity (roadmap §1). Neither touches item_reviews — see the header of
	// serendipity_handlers.go for why that is a rule rather than an omission.
	// Find and replace across a selection (roadmap §7). TWO ROUTES, NOT ONE WITH
	// A FLAG: the preview writes nothing and the apply writes everything, and a
	// caller cannot reach the second by getting a boolean wrong.
	mux.Handle("POST /replace/preview", s.requireAuth(s.handleReplacePreview))
	mux.Handle("POST /replace/apply", s.requireAuth(s.handleReplaceApply))

	mux.Handle("GET /shuffle", s.requireAuth(s.handleShuffle))
	mux.Handle("GET /on-this-day", s.requireAuth(s.handleOnThisDay))

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
	// One route for three pickers — a book's cover, a film's poster, a person's
	// portrait. Not admin-only: it reads no secret back, it only spends one.
	mux.Handle("POST /images/search", s.requireAuth(s.handleImageSearch))
	mux.Handle("POST /books/lookup", s.requireAuth(s.handleBookLookup))
	mux.Handle("POST /books", s.requireAuth(s.handleCreateBook))
	mux.Handle("GET /books", s.requireAuth(s.handleListBooks))
	mux.Handle("GET /books/{id}", s.requireAuth(s.handleGetBook))
	mux.Handle("PUT /books/{id}", s.requireAuth(s.handleUpdateBook))
	// Shelf status is its own endpoint, not part of the full-state PUT: the
	// transition and the read log have to move together (PLAN §3f).
	mux.Handle("PUT /books/{id}/status", s.requireAuth(s.handleSetBookStatus))
	// Editing the read log itself. The open read stays the status
	// endpoint's to own; these three edit history. See read_history_handlers.go.
	mux.Handle("POST /books/{id}/reads", s.requireAuth(s.handleAddRead("book")))
	mux.Handle("POST /movies/{id}/reads", s.requireAuth(s.handleAddRead("movie")))
	mux.Handle("PUT /reads/{id}", s.requireAuth(s.handleUpdateRead))
	mux.Handle("DELETE /reads/{id}", s.requireAuth(s.handleDeleteRead))
	// A work's cast (0048) — one row per character, with the actor beside it on a
	// film or a show, the voice actor on a game, and nothing on a book. Seeded by
	// a metadata fetch and editable by hand, which is the whole point: the blob it
	// replaces had no edit surface and was empty for nearly every game. Shaped
	// like the read log above — nested to add, flat by row id to correct or
	// remove. See cast_handlers.go.
	mux.Handle("GET /books/{id}/cast", s.requireAuth(s.handleListCast("book")))
	// The chapters this book's own highlights already name (2.2.1) — what the capture
	// surface and the highlight editor offer while you type a locator. See
	// chapters_handler.go for why it is per book rather than part of the search
	// vocabulary.
	mux.Handle("GET /books/{id}/chapters", s.requireAuth(s.handleBookChapters))
	mux.Handle("POST /books/{id}/cast", s.requireAuth(s.handleAddCast("book")))
	mux.Handle("GET /movies/{id}/cast", s.requireAuth(s.handleListCast("movie")))
	mux.Handle("POST /movies/{id}/cast", s.requireAuth(s.handleAddCast("movie")))
	mux.Handle("PUT /cast/{id}", s.requireAuth(s.handleUpdateCast))
	mux.Handle("DELETE /cast/{id}", s.requireAuth(s.handleDeleteCast))
	// One on-demand pass at IMDb for a work whose structured sources have no cast —
	// which is most games (see igdb_cast.go's measurement). One request per press, no
	// search, no crawl; see imdb_handlers.go.
	mux.Handle("POST /movies/{id}/cast/imdb", s.requireAuth(s.handleCastFromIMDb))
	// And the same for TheTVDB, which is the only source with an image PER ROLE —
	// the character in costume. Separate from the resync (PUT /movies/{id}) because
	// that one re-pulls the poster, the genres and the year with it, and a reader
	// who has corrected those by hand will not press it. See tvdb_cast_handlers.go.
	mux.Handle("POST /movies/{id}/cast/tvdb", s.requireAuth(s.handleCastFromTVDB))
	// The character's own picture, fetched once and served from here afterwards
	// (0050). A POST because it may write — idempotent, so a client may call it for
	// every chip it is about to draw. See cast_image_handlers.go.
	mux.Handle("POST /cast/{id}/image", s.requireAuth(s.handleCastImage))
	// The cleanup sweep (Settings): read every quote, report what a page left
	// behind in it, change nothing. See cleanup.go for the rules and why there is
	// no companion write.
	mux.Handle("GET /cleanup", s.requireAuth(s.handleCleanup))
	// The three that make the list a worklist (2.2.1): the rewrite a finding would
	// make, accepted one at a time; and a refusal that is remembered (0052) so the
	// finding that was somebody's real writing is dismissed once rather than every
	// visit. See cleanup_apply_handlers.go.
	mux.Handle("POST /cleanup/accept", s.requireAuth(s.handleCleanupAccept))
	mux.Handle("POST /cleanup/ignore", s.requireAuth(s.handleCleanupIgnore))
	mux.Handle("POST /cleanup/unignore", s.requireAuth(s.handleCleanupUnignore))
	mux.Handle("POST /books/{id}/cover", s.requireAuth(s.handleUploadBookCover))
	mux.Handle("DELETE /books/{id}", s.requireAuth(s.handleDeleteBook))

	// The bin (0031). Every route is scoped to the caller's own entries — an
	// admin's bin is not a superset of anybody else's — and a foreign id is 404.
	mux.Handle("GET /trash", s.requireAuth(s.handleListTrash))
	mux.Handle("GET /trash/{id}", s.requireAuth(s.handleGetTrashEntry))
	mux.Handle("POST /trash/{id}/restore", s.requireAuth(s.handleRestoreTrash))
	mux.Handle("DELETE /trash/{id}", s.requireAuth(s.handleDeleteTrashEntry))
	mux.Handle("DELETE /trash", s.requireAuth(s.handleEmptyTrash))
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
	mux.Handle("PUT /movies/{id}/status", s.requireAuth(s.handleSetMovieStatus))
	mux.Handle("POST /movies/{id}/cover", s.requireAuth(s.handleUploadMoviePoster))
	mux.Handle("DELETE /movies/{id}", s.requireAuth(s.handleDeleteMovie))
	mux.Handle("POST /dialogues", s.requireAuth(s.handleCreateDialogue))
	mux.Handle("GET /dialogues", s.requireAuth(s.handleListDialogues))
	mux.Handle("PUT /dialogues/{id}", s.requireAuth(s.handleUpdateDialogue))
	mux.Handle("DELETE /dialogues/{id}", s.requireAuth(s.handleDeleteDialogue))
	// Quotes with no book and no film (ROADMAP §24) — a line from a speech, a
	// letter, an interview, a song. /quotes is the public spelling because that
	// is what they are called everywhere the user can see; `utterances` is the
	// table, since quoteRow already means "the shared shape of all three kinds".
	// The only kind whose ownership is a column rather than a parent join.
	mux.Handle("POST /quotes", s.requireAuth(s.handleCreateUtterance))
	mux.Handle("GET /quotes", s.requireAuth(s.handleListUtterances))
	mux.Handle("PUT /quotes/{id}", s.requireAuth(s.handleUpdateUtterance))
	mux.Handle("DELETE /quotes/{id}", s.requireAuth(s.handleDeleteUtterance))
	// The starter proverbs (0035), offered on an empty Proverbs board and written
	// only when asked — one language at a time. A literal path beats the {id}
	// wildcard above under Go's pattern precedence, the same way /quotes/bulk
	// already does.
	mux.Handle("GET /quotes/starters", s.requireAuth(s.handleListProverbStarters))

	// Boards (0036) — the shelves /quotes lists, the way the Library lists books.
	// Registered as their own noun rather than under /quotes/{id} because a board
	// is not a quote, and nesting them would put a board id in the same wildcard
	// slot a quote id already occupies.
	mux.Handle("GET /boards", s.requireAuth(s.handleListBoards))
	mux.Handle("POST /boards", s.requireAuth(s.handleCreateBoard))
	mux.Handle("PUT /boards/{id}", s.requireAuth(s.handleUpdateBoard))
	mux.Handle("DELETE /boards/{id}", s.requireAuth(s.handleDeleteBoard))
	mux.Handle("POST /boards/{id}/cover", s.requireAuth(s.handleUploadBoardImage))
	mux.Handle("POST /quotes/starters", s.requireAuth(s.handleSeedProverbs))

	// Anthologies (0043) — a made document rather than a container: a title, an
	// introduction, and quotes in an order with the reader's commentary between
	// them. Their own noun for the same reason boards have theirs: an anthology
	// draws from all three kinds of quote at once, so it belongs under none of them.
	//
	// The entry routes spell (kind, item) into the PATH because that IS an entry's
	// identity — there is no entry id — and because a DELETE with a body is a shape
	// half the HTTP stacks in the world treat as optional.
	mux.Handle("GET /anthologies", s.requireAuth(s.handleListAnthologies))
	mux.Handle("POST /anthologies", s.requireAuth(s.handleCreateAnthology))
	mux.Handle("GET /anthologies/{id}", s.requireAuth(s.handleGetAnthology))
	mux.Handle("PUT /anthologies/{id}", s.requireAuth(s.handleUpdateAnthology))
	mux.Handle("DELETE /anthologies/{id}", s.requireAuth(s.handleDeleteAnthology))
	mux.Handle("POST /anthologies/{id}/entries", s.requireAuth(s.handleAddAnthologyEntries))
	mux.Handle("PUT /anthologies/{id}/entries", s.requireAuth(s.handleAnthologyEntryNote))
	mux.Handle("DELETE /anthologies/{id}/entries/{kind}/{itemID}", s.requireAuth(s.handleRemoveAnthologyEntry))
	mux.Handle("POST /anthologies/{id}/order", s.requireAuth(s.handleReorderAnthology))
	mux.Handle("GET /anthologies/{id}/export", s.requireAuth(s.handleExportAnthology))

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
	// Bring your own type (Settings → Type). The bytes are stored and never
	// parsed — see font_handlers.go.
	mux.Handle("GET /fonts", s.requireAuth(s.handleListFonts))
	mux.Handle("POST /fonts", s.requireAuth(s.handleUploadFont))
	mux.Handle("GET /fonts/{id}/file", s.requireAuth(s.handleFontFile))
	mux.Handle("DELETE /fonts/{id}", s.requireAuth(s.handleDeleteFont))
	mux.Handle("POST /stickers", s.requireAuth(s.handleUploadSticker))
	mux.Handle("PUT /stickers/{id}", s.requireAuth(s.handleUpdateSticker))
	mux.Handle("DELETE /stickers/{id}", s.requireAuth(s.handleDeleteSticker))
	mux.Handle("POST /import/markdown", s.requireAuth(s.handleImportMarkdown))
	mux.Handle("POST /import/bookcision", s.requireAuth(s.handleImportBookcision))
	mux.Handle("POST /import/hardcover-html", s.requireAuth(s.handleImportHardcover))
	mux.Handle("POST /import/goodreads-html", s.requireAuth(s.handleImportGoodreads))
	mux.Handle("POST /import/kindle-notebook", s.requireAuth(s.handleImportKindleNotebook))   // read.amazon.com/notebook
	mux.Handle("POST /import/imdb-quotes", s.requireAuth(s.handleImportIMDb))                 // movies/dialogues (PLAN §5)
	mux.Handle("POST /import/kindle-clippings", s.requireAuth(s.handleImportKindleClippings)) // the device's My Clippings.txt
	// Import staging: every import above parses into this queue, and nothing
	// reaches the library until it is approved (ROADMAP 1.2.0).
	mux.Handle("GET /import/staged", s.requireAuth(s.handleListStaged))
	mux.Handle("POST /import/staged/bulk", s.requireAuth(s.handleBulkStaged))
	mux.Handle("POST /import/staged/approve", s.requireAuth(s.handleApproveStaged))
	mux.Handle("DELETE /import/staged", s.requireAuth(s.handleDiscardStaged))
	mux.Handle("GET /covers/{file}", s.requireAuth(s.handleCover))

	// Export (PLAN §6b): single-item markdown + whole-library zip.
	mux.Handle("GET /books/{id}/export", s.requireAuth(s.handleExportBook))
	mux.Handle("GET /movies/{id}/export", s.requireAuth(s.handleExportMovie))
	mux.Handle("GET /export", s.requireAuth(s.handleExportAll))
	// Export a chosen set (the in-view/filtered set the UI passes) as one
	// multi-item markdown file; empty ids => everything of that kind.
	mux.Handle("POST /export/books", s.requireAuth(s.handleExportBooks))
	mux.Handle("POST /export/movies", s.requireAuth(s.handleExportMovies))
	mux.Handle("POST /export/quotes", s.requireAuth(s.handleExportQuotes))

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
	mux.Handle("POST /movies/merge", s.requireAuth(s.handleMergeMovies))
	mux.Handle("GET /metadata/duplicates", s.requireAuth(s.handleBookDuplicates))
	// Bulk actions over a selection (e.g. from search results): tag a set of
	// annotations/dialogues, field-correct a set of films/shows.
	mux.Handle("POST /movies/bulk", s.requireAuth(s.handleBulkUpdateMovies))
	mux.Handle("POST /annotations/bulk", s.requireAuth(s.handleBulkTagAnnotations))
	mux.Handle("POST /dialogues/bulk", s.requireAuth(s.handleBulkTagDialogues))
	mux.Handle("POST /quotes/bulk", s.requireAuth(s.handleBulkTagQuotes))
	// Bulk delete is its own route per kind, never a flag on the bulk edit above: a
	// body that can both retag and delete is a body where one typo does the wrong
	// one. Each requires a typed phrase naming the count and the kind.
	mux.Handle("POST /annotations/bulk/delete", s.requireAuth(s.handleBulkDeleteAnnotations))
	mux.Handle("POST /dialogues/bulk/delete", s.requireAuth(s.handleBulkDeleteDialogues))
	mux.Handle("POST /quotes/bulk/delete", s.requireAuth(s.handleBulkDeleteQuotes))
	// Deleting works is the heaviest of the five: a book carries its highlights,
	// their tags, their review schedules, its genres and its read log, and all of
	// it lands in one bin entry.
	mux.Handle("POST /books/bulk/delete", s.requireAuth(s.handleBulkDeleteBooks))
	mux.Handle("POST /movies/bulk/delete", s.requireAuth(s.handleBulkDeleteMovies))
	// Shelf state over a selection ("I finished these four"). Status only, no
	// position: "page 143" is not a fact about forty books.
	mux.Handle("POST /books/bulk/status", s.requireAuth(s.handleBulkStatusBooks))
	mux.Handle("POST /movies/bulk/status", s.requireAuth(s.handleBulkStatusMovies))
	// Fill in what is MISSING from a selection's metadata, and touch nothing that
	// is already there. The unattended half of re-verify — see metadata_fill.go.
	mux.Handle("POST /metadata/fill", s.requireAuth(s.handleMetadataFill))

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
	// gzip sits inside logRequests so the logged byte count is what actually
	// went over the wire, not the pre-compression size.
	return logRequests(gzipResponses(securityHeaders(exceptBearer(csrf.Handler(root), root))))
}

// exceptBearer routes requests that carry an Authorization: Bearer credential
// around the CSRF wrapper, and everything else through it.
//
// Cross-origin protection exists to stop a hostile page making a browser spend
// an *ambient* credential — the session cookie, which the browser attaches on
// its own. A bearer token is never attached automatically: it has to be read
// from storage and set deliberately, which a cross-origin page cannot do. So
// the protection buys nothing on that path.
//
// Today a header-less request already passes (no Sec-Fetch-Site, no Origin, so
// nothing to reject — pinned by TestCSRFAllowsHeaderlessPost). This makes the
// native client's exemption explicit rather than incidental, so a stricter
// stdlib default in a future Go release can't silently break every phone.
//
// It deliberately does not weaken the cookie path: a cookie-only request still
// goes through csrf, cross-site or not (TestBearerBypassDoesNotWeakenCookieCSRF).
// Skipping CSRF is also not skipping auth — the token still has to validate in
// requireAuth, so a forged header buys an attacker a 401.
func exceptBearer(protected, bare http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, present := bearerToken(r); present {
			bare.ServeHTTP(w, r)
			return
		}
		protected.ServeHTTP(w, r)
	})
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
		// WHO, as well as what. The roadmap's line for this section is
		// "method · path · user · outcome · cause", and the user was the one part
		// missing — which on a multi-user instance is the difference between "a
		// request failed" and "this account's request failed", the question an
		// operator actually has.
		//
		// A POINTER IN THE CONTEXT, because of the order the middleware runs in.
		// requireAuth wraps individual handlers and puts the identity on ITS copy
		// of the request; this logger wraps the whole chain and only sees the
		// outer one, so a plain context value written downstream is invisible up
		// here. A pointer placed before the chain runs and filled in by
		// requireAuth is the one shape that survives that, and it costs one
		// allocation per request.
		who := &reqUser{}
		ctx := context.WithValue(r.Context(), ctxReqID, rid)
		ctx = context.WithValue(ctx, ctxReqUser, who)
		r = r.WithContext(ctx)
		rec := &statusRecorder{ResponseWriter: w}
		start := time.Now()
		next.ServeHTTP(rec, r)
		if rec.status == 0 {
			rec.status = http.StatusOK
		}
		// rid ties this summary line to any [error]/[warn]/[trace] lines the
		// handler logged for the same request (they all carry "(req rNNN)").
		// An unauthenticated request logs "-" rather than an empty column, so the
		// fields stay in the same positions for anything reading these lines.
		name := who.name
		if name == "" {
			name = "-"
		}
		log.Printf("%s %s %d %s %dB %s %s %s",
			r.Method, r.URL.RequestURI(), rec.status,
			time.Since(start).Round(time.Millisecond), rec.bytes, r.RemoteAddr, name, rid)
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
				"https://commons.wikimedia.org https://upload.wikimedia.org "+
				// A WEB IMAGE SEARCH CANNOT BE ALLOWLISTED, which is why the
				// picture strip previews Google's own thumbnail host rather than
				// the pictures' hosts: a Custom Search hit lives wherever the
				// picture lives, and that set is the web. The full-size image is
				// never loaded by the page — the server fetches it, where no CSP
				// applies, and only once the reader has picked it.
				"https://*.gstatic.com; "+
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
	ctxReqUser
)

// reqSeq numbers requests within a process run so every log line for one request
// shares an id (ROADMAP §12). A counter — not a random id — is enough to correlate
// lines in `docker logs`; it resets on restart, which is fine.
var reqSeq atomic.Uint64

func nextReqID() string { return "r" + strconv.FormatUint(reqSeq.Add(1), 10) }

// reqID returns the current request's correlation id (empty outside a served
// request, e.g. in tests that bypass logRequests).
func reqID(r *http.Request) string { v, _ := r.Context().Value(ctxReqID).(string); return v }

// reqUser is the slot the access logger hands downstream for requireAuth to fill
// in. Written once, on one goroutine, before the response is written and read
// after ServeHTTP returns — so it needs no lock.
type reqUser struct{ name string }

// noteRequestUser records who this request turned out to be, for the access
// line. A no-op when there is no slot, which is every call from a test that
// builds a request by hand.
func noteRequestUser(r *http.Request, name string) {
	if u, ok := r.Context().Value(ctxReqUser).(*reqUser); ok && u != nil {
		u.name = name
	}
}

// reqSuffix renders the request id for a log line as " (req rNNN)", or "" if none.
func reqSuffix(r *http.Request) string {
	if id := reqID(r); id != "" {
		return " (req " + id + ")"
	}
	return ""
}

const sessionCookie = "tippani_session"

// bearerToken returns the Authorization: Bearer credential and whether the
// header was present at all. A present-but-unusable header ("Bearer", "Bearer ",
// a different scheme) returns ok=true with an empty token, so requireAuth fails
// closed on it rather than quietly falling through to a cookie that happens to
// be attached — a revoked device would otherwise keep working alongside one.
func bearerToken(r *http.Request) (token string, ok bool) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", false
	}
	const prefix = "Bearer "
	if len(h) >= len(prefix) && strings.EqualFold(h[:len(prefix)], prefix) {
		return strings.TrimSpace(h[len(prefix):]), true
	}
	return "", true
}

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var (
			uid     int64
			uname   string
			isAdmin bool
			err     error
		)
		// A native client (mobile/) presents a device token; a browser presents
		// the session cookie. Bearer wins when both are somehow present, so the
		// identity doesn't depend on header ordering.
		if token, present := bearerToken(r); present {
			uid, uname, isAdmin, err = s.Devices.Validate(token)
		} else {
			c, cerr := r.Cookie(sessionCookie)
			if cerr != nil {
				writeErr(w, http.StatusUnauthorized, "not logged in")
				return
			}
			uid, uname, isAdmin, err = s.Sessions.Validate(c.Value)
		}
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not logged in")
			return
		}
		noteRequestUser(r, uname)
		ctx := context.WithValue(r.Context(), ctxUserID, uid)
		ctx = context.WithValue(ctx, ctxUsername, uname)
		ctx = context.WithValue(ctx, ctxIsAdmin, isAdmin)
		// The bin's retention sweep, at most once a calendar day, from whichever
		// authenticated request is first after midnight. This is the whole scheduler:
		// no ticker, no goroutine, nothing awake on an idle instance (see PurgeTrash).
		// It costs one settings read and a string compare on every other request.
		s.purgeIfNewDay()
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

// rebindDB repoints every auth store that caches a *sql.DB at the Store's
// current handle. An in-process restore closes the live database and reopens a
// different file (backup_handlers.go), leaving anything holding the old handle
// pointing at a closed connection — which surfaces as an unexplainable 401
// rather than an error, because a failed lookup is indistinguishable from a
// credential that doesn't exist.
//
// Every future DB-holding struct on Server belongs here too. Sessions was the
// only one for a long time and was rebound inline at both restore exits;
// adding Devices made a single place worth having.
func (s *Server) rebindDB() {
	s.Sessions.DB = s.Store.DB
	s.Devices.DB = s.Store.DB
}

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

// nullableCount reads a count that arrives as text, where a blank is the only
// "unset" and 0 is a value in its own right: NULL for blank (or unparseable —
// callers validate first), the number otherwise. The counterpart of nullableInt
// for columns where 0 means something, as a dialogue's season does.
func nullableCount(s string) any {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return nil
	}
	return n
}

// nullableMeasure parses a decimal typed into a bulk field and maps blank-or-junk
// to NULL. It is nullableCount's fractional twin, and exists for the same reason:
// three states have to be distinguishable through one field, and a *float64 carries
// only two. Absent is the pointer being nil (the caller checks that); "" is an
// explicit clear; "12.5" is a value.
func nullableMeasure(s string) any {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil || f == 0 {
		return nil
	}
	return f
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

// yearFloor / yearCeil bound a publication or release year.
//
// The floor is negative because a library that exists to keep quotes holds
// things written before the common era, and the old floor of 1000 refused them
// outright — the Meditations and the Analects could not be entered at all. The
// era boundary needs no sentinel: 0 has always meant "absent" here, and there is
// no year 0 between 1 BCE and 1 CE, so -1 is 1 BCE and nothing had to change
// meaning. -4000 is around the earliest thing anyone has a text of.
const (
	yearFloor = -4000
	yearCeil  = 3000
)

// validYear: 0 means absent; anything else must be a plausible year, BCE
// included. Callers that want "does this row have a year" must test `!= 0`, not
// `> 0` — a BCE year is a year, and > 0 reads it as missing.
func validYear(y int) bool { return y == 0 || (y >= yearFloor && y <= yearCeil) }

// hasYear is that test, named, so it cannot be written the wrong way twice.
func hasYear(y int) bool { return y != 0 }

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

// writeConflictExisting answers a duplicate-create 409 with the row that
// already occupies the slot, alongside the usual "error" string.
//
// A bare 409 is enough for a browser, where a person can see what happened. It
// strands an offline client: the phone POSTs a queued capture, the connection
// drops before the response arrives, it retries, and cannot tell its own
// earlier POST landing from a genuine clash with a different quote. Dropping
// the capture and reporting a permanent failure are both wrong. With the
// existing row attached, a retry returns what a first success would have, and
// the outbox entry is simply marked done.
func writeConflictExisting(w http.ResponseWriter, msg string, existing any) {
	writeJSON(w, http.StatusConflict, map[string]any{"error": msg, "existing": existing})
}

func (s *Server) spaHandler() http.Handler {
	fileServer := http.FileServerFS(s.Static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(s.Static, p); err != nil {
			// A MISSING FILE IS A 404, AND ONLY A ROUTE FALLS BACK.
			//
			// The fallback exists for the client-side router: /library, /quotes,
			// /library/12 are not files and have to be answered with the app. It was
			// applied to EVERYTHING missing, which meant a request for
			// /assets/index-abc123.js that was not in the bundle got index.html —
			// 200, Content-Type text/html — and the browser refused to execute HTML
			// as a module and rendered nothing. No error in the log, no failing
			// health check, no clue in the response status. A blank page.
			//
			// That is what a broken frontend build looked like from the outside, and
			// the fallback is why it looked like nothing at all. A path with an
			// extension is a claim about a file: if the file is absent, say so.
			// None of this app's routes contain a dot (see routes.js), so the test
			// is safe as well as cheap.
			if path.Ext(p) != "" {
				http.NotFound(w, r)
				return
			}
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}
