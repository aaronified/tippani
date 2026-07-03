# Tippani

**Tippani** (ṭippaṇī, टिप्पणी — *a marginal annotation*) is a self-hosted, multi-user store for
book annotations: paste or bulk-import your quotes and highlights, attach notes/colours/tags,
fetch cover + metadata, and search author / title / genre / annotation text near-instantly.

Built for low-powered NAS boxes that run a hundred other things: a single static Go binary
(~10 MB), SQLite + FTS5, ~11 MB idle RSS, zero background jobs, and it binds to
`127.0.0.1` only — you bring your own reverse proxy / Tailscale / Netbird / Twingate.

The full design lives in [`docs/PLAN.md`](docs/PLAN.md).

## Status

Scaffold / milestone 2 of the build order (PLAN §9):

- [x] Schema + migrations, FTS5 external-content tables + triggers (tested)
- [x] Auth: form login, SQLite sessions (hashed tokens), bcrypt, stdlib CSRF (Go 1.25 `CrossOriginProtection`), login rate limiting
- [x] Users: first-run onboarding (creates the admin), in-app admin user management, CLI user management
- [x] `GET /search` — injection-safe FTS5 across books (title/author/genre) and annotations (quote/note)
- [x] React UI shell: onboarding, login, admin users panel
- [ ] Annotation/book CRUD
- [ ] Markdown importer
- [ ] Kindle `My Clippings.txt` importer
- [ ] Bookcision JSON importer
- [ ] Google Books + Open Library metadata, local cover store
- [ ] Library / annotations / search UI

## Run it (Docker Compose)

The simplest way to host Tippani — pulls the prebuilt multi-arch image
(`linux/amd64` + `linux/arm64`) from GHCR:

```sh
curl -O https://raw.githubusercontent.com/aaronified/tippani/main/docker-compose.yml
docker compose up -d
```

Then open `http://<host>:8080` and **create the admin account** on the first-run
onboarding screen. The admin adds any further users from inside the app.

How you expose port 8080 (reverse proxy, TLS, VPN, Tailscale/Twingate, LAN, or
localhost-only) is your call — the shipped compose file stays out of it. When a
TLS-terminating proxy sits in front, set `TIPPANI_COOKIE_SECURE=1`.

## Build from source

Requires Go 1.25+ (Node only if you rebuild the frontend, and only on your dev machine).

```sh
make build                                   # -> bin/tippani (CGO_ENABLED=0, static)
./bin/tippani serve                          # http://127.0.0.1:8080, then onboard in the browser
```

To bootstrap without the browser (or for scripting), the CLI still works — the
first user created becomes the admin:

```sh
printf '%s\n' 'a-long-password' | ./bin/tippani user add alice
```

Rebuild the frontend after changing it (re-embeds into the binary):

```sh
make frontend    # builds the SPA into web/dist
make build       # re-embed
```

## Configuration

| Env | Default | Meaning |
| :-- | :-- | :-- |
| `TIPPANI_BIND` | `127.0.0.1:8080` | Listen address. Keep it localhost; expose via your own proxy/VPN |
| `TIPPANI_DATA` | `./data` | Data dir (SQLite DB, later covers) |
| `TIPPANI_COOKIE_SECURE` | `0` | Set `1` when TLS terminates in front of the app |
| `TIPPANI_TRUSTED_PROXY` | `0` | Set `1` to trust `X-Forwarded-For` for login rate limiting |

Runtime tuning for a shared NAS (see `deploy/tippani.service`): `GOMAXPROCS=1`,
`GOMEMLIMIT=64MiB`, `GOGC=200`.

Backup: nightly `sqlite3 data/tippani.db "VACUUM INTO 'backup.db'"` from cron, off-peak.

## Users

The **first user** is the admin, created either by the browser onboarding screen
on first run or by the CLI when the database is still empty. The admin manages
everyone else from the in-app **Users** panel (add / remove). Onboarding closes
automatically once a user exists.

The CLI remains available for bootstrapping and scripting:

```sh
tippani user add <name>      # password read from stdin (first user -> admin)
tippani user passwd <name>
tippani user del <name>      # cascades to that user's books/annotations
```

Each user has a fully isolated library (PLAN §2). Passwords change in-app via
`POST /auth/password`.

## Layout

```text
cmd/tippani/          entrypoint: serve + user subcommands
internal/store/       SQLite open (WAL etc.), embedded migrations, schema tests
internal/auth/        bcrypt, hashed-token sessions, login rate limiter
internal/httpapi/     routes (Go 1.22 patterns), CSRF, security headers, handlers
internal/search/      FTS5 MATCH escaping (never pass raw input to MATCH)
web/frontend/         Vite + React 19 + Tailwind v4 source
web/dist/             built SPA, embedded via go:embed
deploy/               Caddyfile + systemd examples
docs/PLAN.md          the design document this repo implements
.github/workflows/    CI (go test/vet, frontend build) + GHCR image publish
```

## Publishing note

The module path is plain `tippani`. When you push this as `github.com/YOU/tippani`:

```sh
grep -rl '"tippani/' --include='*.go' . | xargs sed -i 's|"tippani/|"github.com/YOU/tippani/|g'
sed -i 's|^module tippani$|module github.com/YOU/tippani|' go.mod
```

## License

MIT — see [`LICENSE`](LICENSE).
