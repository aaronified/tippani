// Tippani (ṭippaṇī, टिप्पणी: a marginal annotation) — self-hosted book
// annotations. See docs/PLAN.md.
//
// Usage:
//
//	tippani serve                 start the server (default)
//	tippani user add <name>       create a user (password read from stdin)
//	tippani user passwd <name>    reset a user's password (stdin)
//	tippani user del <name>       delete a user and their data
//	tippani healthcheck           probe /healthz; exit 0 if healthy (Docker HEALTHCHECK)
//
// Configuration (env):
//
//	TIPPANI_BIND           listen address        (default 127.0.0.1:8080)
//	TIPPANI_DATA           data directory        (default ./data)
//	TIPPANI_COOKIE_SECURE  "1" when TLS-fronted  (default 0)
//	TIPPANI_TRUSTED_PROXY  "1" to trust X-Forwarded-For (default 0)
//
// Metadata API keys (TMDB, TheTVDB, Google Books) are configured in-app
// (Settings → metadata keys) — there are no metadata-key env vars. TMDB also has
// the optional built-in slot below for shipping a shared app key.
package main

import (
	"bufio"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"tippani/internal/auth"
	"tippani/internal/httpapi"
	"tippani/internal/store"
	"tippani/web"
)

func main() {
	args := os.Args[1:]
	cmd := "serve"
	if len(args) > 0 {
		cmd = args[0]
	}
	switch cmd {
	case "serve":
		serve()
	case "user":
		userCmd(args[1:])
	case "healthcheck":
		healthcheck()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", cmd)
		os.Exit(2)
	}
}

// healthcheck probes GET /healthz and exits 0 when healthy, non-zero otherwise.
// It is the container HEALTHCHECK command: the distroless image has no shell or
// curl, so the binary checks itself. It dials the loopback interface on the
// configured port (TIPPANI_BIND may be 0.0.0.0, which isn't a valid dial target).
func healthcheck() {
	host, port, err := net.SplitHostPort(envOr("TIPPANI_BIND", "127.0.0.1:8080"))
	if err != nil {
		host, port = "127.0.0.1", "8080"
	}
	switch host {
	case "", "0.0.0.0", "::": // SplitHostPort strips brackets, so [::] arrives as "::"
		host = "127.0.0.1"
	}
	url := "http://" + net.JoinHostPort(host, port) + "/healthz"
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "healthcheck: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "healthcheck: unhealthy (status %d)\n", resp.StatusCode)
		os.Exit(1)
	}
}

func openStore() (*store.Store, string) {
	dataDir := envOr("TIPPANI_DATA", "data")
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		log.Fatalf("create data dir: %v", err)
	}
	st, err := store.Open(filepath.Join(dataDir, "tippani.db"))
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	if err := st.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	// Startup health: a structural corruption sweep of the whole DB file
	// (alerted loudly on stdout+stderr if the image is malformed), then an
	// FTS-index check that self-heals any corrupt full-text index by rebuilding
	// it from the intact base tables — so search recovers on the next boot
	// instead of 500ing until someone notices.
	st.CheckIntegrity()
	st.RepairFTS()
	return st, dataDir
}

// defaultTMDBKey is Tippani's registered TMDB application key, embedded
// Jellyfin-style so installs work without configuration: TMDB permits
// open-source apps shipping their app key (attribution required, see README)
// and rate-limits per client IP, so a shared key never pools into one quota.
// Register a free key at themoviedb.org (Settings → API) and paste it here;
// until then movie lookup answers 503 and manual entry still works.
// Resolution order per request (PLAN §6): Settings-saved custom key >
// this built-in > none. (No env slot — the key is managed in-app.)
const defaultTMDBKey = ""

func serve() {
	st, dataDir := openStore()
	defer st.Close()
	// Covers and posters are downloaded once and served locally from
	// <DataDir>/MediaCover (PLAN §6; *arr-style, §9 of the UI instructions).
	// Migrate the pre-rename covers/ directory in place, once.
	mediaDir := filepath.Join(dataDir, "MediaCover")
	if _, err := os.Stat(mediaDir); os.IsNotExist(err) {
		if oldDir := filepath.Join(dataDir, "covers"); dirExists(oldDir) {
			if err := os.Rename(oldDir, mediaDir); err != nil {
				log.Fatalf("migrate covers dir: %v", err)
			}
			log.Printf("migrated cover store %s -> %s", oldDir, mediaDir)
		}
	}
	if err := os.MkdirAll(mediaDir, 0o700); err != nil {
		log.Fatalf("create MediaCover dir: %v", err)
	}

	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		log.Fatalf("embedded frontend: %v", err)
	}
	srv := httpapi.New(st, dist,
		dataDir,
		os.Getenv("TIPPANI_COOKIE_SECURE") == "1",
		os.Getenv("TIPPANI_TRUSTED_PROXY") == "1",
	)
	srv.TMDBBuiltin = defaultTMDBKey // last fallback before 503 (key otherwise set in Settings)

	// One-line config summary at boot so `docker logs` shows what's wired without
	// leaking secrets (presence only). Per-request lines follow (logRequests).
	log.Printf("config: data=%s tmdb(builtin=%t) cookie_secure=%t trusted_proxy=%t",
		dataDir, defaultTMDBKey != "",
		os.Getenv("TIPPANI_COOKIE_SECURE") == "1", os.Getenv("TIPPANI_TRUSTED_PROXY") == "1")

	bind := envOr("TIPPANI_BIND", "127.0.0.1:8080") // localhost-only by default (PLAN §2)
	httpServer := &http.Server{
		Addr:              bind,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Printf("tippani listening on http://%s", bind)
	if err := httpServer.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func userCmd(args []string) {
	if len(args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: tippani user add|passwd|del <username>")
		os.Exit(2)
	}
	action, name := args[0], args[1]
	st, dataDir := openStore()
	defer st.Close()

	switch action {
	case "add":
		hash := readPasswordHash()
		// The first user becomes the admin (same rule as first-run onboarding),
		// so a CLI-bootstrapped instance always has someone who can manage users.
		if _, err := st.DB.Exec(
			`INSERT INTO users (username, password_hash, is_admin)
			 SELECT ?, ?, CASE WHEN NOT EXISTS (SELECT 1 FROM users) THEN 1 ELSE 0 END`,
			name, hash,
		); err != nil {
			log.Fatalf("add user: %v", err)
		}
		var admin bool
		_ = st.DB.QueryRow(`SELECT is_admin FROM users WHERE username = ?`, name).Scan(&admin)
		if admin {
			fmt.Printf("user %q created (admin)\n", name)
		} else {
			fmt.Printf("user %q created\n", name)
		}
	case "passwd":
		hash := readPasswordHash()
		res, err := st.DB.Exec(
			`UPDATE users SET password_hash = ? WHERE username = ?`, hash, name,
		)
		if err != nil {
			log.Fatalf("passwd: %v", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			log.Fatalf("no such user %q", name)
		}
		fmt.Printf("password updated for %q\n", name)
	case "del":
		// Collect the user's cover/poster filenames before the cascade removes
		// their rows, so we can delete the now-orphaned files (mirrors the in-app
		// admin delete). Names are server-generated; filepath.Base guards anyway.
		var covers []string
		if rows, err := st.DB.Query(
			`SELECT cover_path FROM books WHERE user_id = (SELECT id FROM users WHERE username = ?) AND cover_path IS NOT NULL
			 UNION ALL
			 SELECT poster_path FROM movies WHERE user_id = (SELECT id FROM users WHERE username = ?) AND poster_path IS NOT NULL`,
			name, name); err == nil {
			for rows.Next() {
				var f string
				if rows.Scan(&f) == nil && f != "" {
					covers = append(covers, f)
				}
			}
			rows.Close()
		}
		res, err := st.DB.Exec(`DELETE FROM users WHERE username = ?`, name)
		if err != nil {
			log.Fatalf("del: %v", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			log.Fatalf("no such user %q", name)
		}
		for _, f := range covers {
			_ = os.Remove(filepath.Join(dataDir, "MediaCover", filepath.Base(f))) // best-effort
		}
		fmt.Printf("user %q deleted (books/annotations cascade)\n", name)
	default:
		fmt.Fprintln(os.Stderr, "usage: tippani user add|passwd|del <username>")
		os.Exit(2)
	}
}

// readPasswordHash reads one line from stdin and bcrypts it.
// Interactive input echoes; pipe it to avoid that:
//
//	printf '%s' "$PASS" | tippani user add alice
func readPasswordHash() string {
	fmt.Fprint(os.Stderr, "password: ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		log.Fatalf("read password: %v", err)
	}
	pw := strings.TrimRight(line, "\r\n")
	if len(pw) < 8 {
		log.Fatal("password must be at least 8 characters")
	}
	hash, err := auth.HashPassword(pw)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}
	return hash
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
