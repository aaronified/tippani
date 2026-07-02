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
- [x] Auth: form login, SQLite sessions (hashed tokens), bcrypt, stdlib CSRF (Go 1.25 `CrossOriginProtection`), login rate limiting, CLI user management
- [x] `GET /search` — injection-safe FTS5 across books (title/author/genre) and annotations (quote/note)
- [ ] Annotation/book CRUD
- [ ] Markdown importer
- [ ] Kindle `My Clippings.txt` importer
- [ ] Bookcision JSON importer
- [ ] Google Books + Open Library metadata, local cover store
- [ ] React UI (login shell exists)

## Quick start

Requires Go 1.25+ (Node only if you rebuild the frontend, and only on your dev machine).

```sh
make build                                   # -> bin/tippani (CGO_ENABLED=0, static)
printf '%s\n' 'a-long-password' | ./bin/tippani user add alice
./bin/tippani serve                          # http://127.0.0.1:8080
```

Frontend (optional now — a placeholder page is embedded):

```sh
make frontend    # builds the SPA into web/dist
make build       # re-embed
```

Docker (distroless static, non-root):

```sh
docker build -t tippani .
docker run -d -p 127.0.0.1:8080:8080 -v tippani-data:/data tippani
docker run --rm -it -v tippani-data:/data tippani user add alice
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

```sh
tippani user add <name>      # password read from stdin
tippani user passwd <name>
tippani user del <name>      # cascades to that user's books/annotations
```

Each user has a fully isolated library (PLAN §2). Passwords change in-app via
`POST /auth/password`.

## Layout

```
cmd/tippani/          entrypoint: serve + user subcommands
internal/store/       SQLite open (WAL etc.), embedded migrations, schema tests
internal/auth/        bcrypt, hashed-token sessions, login rate limiter
internal/httpapi/     routes (Go 1.22 patterns), CSRF, security headers, handlers
internal/search/      FTS5 MATCH escaping (never pass raw input to MATCH)
web/frontend/         Vite + React 19 + Tailwind v4 source
web/dist/             built SPA, embedded via go:embed
deploy/               Caddyfile + systemd examples
docs/PLAN.md          the design document this repo implements
```

## Publishing note

The module path is plain `tippani`. When you push this as `github.com/YOU/tippani`:

```sh
grep -rl '"tippani/' --include='*.go' . | xargs sed -i 's|"tippani/|"github.com/YOU/tippani/|g'
sed -i 's|^module tippani$|module github.com/YOU/tippani|' go.mod
```

## License

MIT — see [`LICENSE`](LICENSE).
