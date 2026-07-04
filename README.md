<h1 align="center">Tippani</h1>

<p align="center"><em>ṭippaṇī · टिप्पणी · টিপ্পণী — a marginal annotation</em></p>

<p align="center">
  A self-hosted, multi-user home for your <strong>book highlights</strong> and <strong>movie dialogues</strong> —<br>
  paste or bulk-import quotes, tag · colour · favourite · rate them, auto-fetch covers &amp; metadata,<br>
  search everything instantly, and export it all back out as Obsidian-friendly Markdown.
</p>

<p align="center">
  <a href="https://github.com/aaronified/tippani/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/aaronified/tippani/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/aaronified/tippani/releases"><img alt="Release" src="https://img.shields.io/github/v/release/aaronified/tippani?sort=semver&color=blue"></a>
  <a href="go.mod"><img alt="Go" src="https://img.shields.io/github/go-mod/go-version/aaronified/tippani"></a>
  <a href="https://github.com/aaronified/tippani/pkgs/container/tippani"><img alt="Container" src="https://img.shields.io/badge/ghcr.io-aaronified%2Ftippani-2496ED?logo=docker&logoColor=white"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-amd64%20%C2%B7%20arm64%20(untested)-informational">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/aaronified/tippani?color=blue"></a>
</p>

<!-- The CI / Release / Go / License badges are dynamic and resolve once the repo is
     public and pushed; until then GitHub renders them as "repo not found". -->


---

Built for low-powered NAS boxes that already run a hundred other things: a single static Go
binary (~12 MB, `linux/amd64`), SQLite + FTS5, **~10 MB idle RSS** (measured; set `GOMEMLIMIT`
to cap it — the systemd unit uses 64 MiB), and **zero background jobs** (no pollers, timers, or
cron). It serves plain HTTP on port 8080 for your LAN — bring your own TLS via a reverse proxy /
Tailscale / Netbird / Twingate when you want remote or encrypted access. No Node at runtime;
metadata lookups are on-demand and optional (nothing external is required to run); covers and
posters are served from your own disk.

The full design lives in [`docs/PLAN.md`](docs/PLAN.md); what shipped most recently is in
[`docs/MILESTONE-3.md`](docs/MILESTONE-3.md).

## Screenshots

<!--
Screenshots coming soon. Drop PNGs in docs/img/ and reference them here, e.g.:

<p align="center">
  <img src="docs/img/library.png" width="49%" alt="Library">
  <img src="docs/img/movie-detail.png" width="49%" alt="Movie dialogues">
</p>
-->

_Coming soon._

## Features

- 📚 **Books & annotations** — quotes and notes with 4 highlight colours, tags, chapter/location,
  a favourite ★, and a 1–5 rating. Filter a book's annotations by any combination.
- 🎬 **Movies & dialogues** — capture memorable lines with timestamp, character, and actor; the
  actor auto-fills from the film's cast. Same tags / favourite / rating / filters as books.
- 📥 **Bulk import** — Markdown (Tippani frontmatter **and** Readest exports, auto-detected),
  Kindle **Bookcision** JSON, and saved **Hardcover** journal pages. Re-imports are idempotent,
  and the same passage synced from differently-formatted tools collapses to one row.
- 📤 **Export** — any book or movie to Obsidian-friendly Markdown, or the whole library as a zip.
  Book exports round-trip cleanly back through the importer.
- 🔎 **Instant search** — injection-safe SQLite FTS5 across titles, authors, genres, quotes,
  notes, and dialogue (find a line by its text, its character, or its actor).
- 🖼 **Metadata & covers** — Google Books + Open Library for books, [TMDB](https://www.themoviedb.org/)
  for movies. Covers/posters are fetched once through an SSRF-guarded fetcher and served locally.
- 🔐 **Multi-user** — per-user isolated libraries, first-run admin onboarding, in-app user
  management, bcrypt + hashed-token sessions, stdlib CSRF, login rate limiting.
- 🪶 **Frugal** — one static binary, WAL SQLite, no pollers or cron; designed to sit quietly on a
  shared NAS.

> Planned: Kindle `My Clippings.txt` importer (deferred — Bookcision already covers the Kindle path).

## Quick start (Docker Compose)

Pull the prebuilt image from GHCR (multi-arch — see the platform note below). Save this as
`docker-compose.yml`:

```yaml
services:
  tippani:
    image: ghcr.io/aaronified/tippani:latest
    container_name: tippani
    restart: unless-stopped
    ports:
      # Reachable on your LAN. First-run onboarding is unauthenticated (the first
      # visitor claims admin) — onboard promptly, or prefix with 127.0.0.1: to
      # bind host-local and front it with a reverse proxy/VPN.
      - "8080:8080"
    volumes:
      # /data holds the SQLite DB + downloaded covers. Use the named volume
      # below, OR bind-mount any host folder you already back up, e.g.:
      #   - /srv/tippani:/data
      - tippani-data:/data
    # environment:
    #   TIPPANI_COOKIE_SECURE: "1"   # when a TLS-terminating proxy is in front
    #   TIPPANI_TRUSTED_PROXY: "1"   # to trust X-Forwarded-For for the login limiter
    #   TIPPANI_TMDB_API_KEY: ""     # your own key from themoviedb.org (enables movie lookup)
    #   GOMAXPROCS: "1"              # NAS-friendly runtime caps (see PLAN §8)
    #   GOMEMLIMIT: "64MiB"
    #   GOGC: "200"

# Only needed if you use the named volume above; delete this block when you
# bind-mount a host folder instead.
volumes:
  tippani-data:
```

Then:

```sh
docker compose up -d
```

…or grab the file and start in one go:

```sh
curl -O https://raw.githubusercontent.com/aaronified/tippani/main/docker-compose.yml
docker compose up -d
```

Open `http://<nas-ip>:8080` and **create the admin account** on the first-run onboarding screen;
the admin adds any further users from inside the app. When a TLS-terminating proxy sits in front,
set `TIPPANI_COOKIE_SECURE=1`.

> **First-run security:** onboarding is unauthenticated — whoever reaches the port first while the
> user table is empty becomes the admin. On a shared LAN, bring the stack up and create your admin
> right away (or bind host-local with `127.0.0.1:8080:8080` until you have). After that, onboarding
> closes and all routes require a login.

> **Platforms:** published as a multi-arch image — `linux/amd64` is the tested arch; `linux/arm64`
> is built and published too (pure Go, cross-compiles cleanly) but is **untested**. arm64 NAS
> owners (Synology/QNAP/Pi): give it a try and report back.

## Build from source

Requires Go 1.25+ (Node only to rebuild the frontend, and only on your dev machine).

```sh
make build                         # -> bin/tippani (CGO_ENABLED=0, static)
./bin/tippani serve                # http://127.0.0.1:8080, then onboard in the browser
```

Bootstrap a user without the browser (the first user created becomes the admin):

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
| `TIPPANI_BIND` | `127.0.0.1:8080` | Listen address (binary default). The Docker image sets `0.0.0.0:8080` so the published port is LAN-reachable; override to bind elsewhere |
| `TIPPANI_DATA` | `./data` | Data dir (SQLite DB + downloaded covers/posters) |
| `TIPPANI_COOKIE_SECURE` | `0` | Set `1` when TLS terminates in front of the app |
| `TIPPANI_TRUSTED_PROXY` | `0` | Set `1` to trust `X-Forwarded-For` for login rate limiting |
| `TIPPANI_TMDB_API_KEY` | *(none)* | Enables movie metadata lookup. Accepts a v3 key or v4 read token from [themoviedb.org](https://www.themoviedb.org/settings/api). There is also an optional built-in key slot (`defaultTMDBKey` in [`cmd/tippani/main.go`](cmd/tippani/main.go)) for shipping a Jellyfin-style shared app key — **currently empty**, so until you set this env var (or fill that constant) movie lookup answers 503 and manual movie entry still works. Everything else works with no key |

Runtime tuning for a shared NAS (see [`deploy/tippani.service`](deploy/tippani.service)):
`GOMAXPROCS=1`, `GOMEMLIMIT=64MiB`, `GOGC=200`.

Backup: nightly `sqlite3 data/tippani.db "VACUUM INTO 'backup.db'"` from cron, off-peak.

## Users

The **first user** is the admin, created either by the browser onboarding screen on first run or
by the CLI when the database is still empty. The admin manages everyone else from the in-app
**Users** panel (add / remove); onboarding closes automatically once a user exists.

The CLI remains available for bootstrapping and scripting:

```sh
tippani user add <name>      # password read from stdin (first user -> admin)
tippani user passwd <name>
tippani user del <name>      # cascades to that user's books/annotations
```

Each user has a fully isolated library (PLAN §2). Passwords change in-app via `POST /auth/password`.

## Layout

```text
cmd/tippani/          entrypoint: serve + user subcommands + healthcheck
internal/store/       SQLite open (WAL etc.), embedded migrations, dedupe hash, schema tests
internal/auth/        bcrypt, hashed-token sessions, login rate limiter
internal/httpapi/     routes (Go 1.22 patterns), CSRF, security headers, all handlers + exports
internal/search/      FTS5 MATCH escaping (never pass raw input to MATCH)
internal/importer/    markdown (frontmatter + Readest), Bookcision, Hardcover HTML parsers
internal/metadata/    Google Books / Open Library / TMDB clients, SSRF-guarded cover fetcher
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

## Attribution

Book metadata comes from Google Books and Open Library. Movie metadata and posters: this product
uses the TMDB API but is not endorsed or certified by [TMDB](https://www.themoviedb.org/).

## License

MIT — see [`LICENSE`](LICENSE).
