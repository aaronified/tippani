# Milestone 3 — everything after the scaffold (2026-07-04)

This document records what was built in the milestone-3 session: every open item from the
milestone-2 status list, plus the owner-requested additions that arrived during the build
(movie dialogues with TMDB metadata, favourites/ratings, two new real-world import formats,
and markdown export). [`PLAN.md`](PLAN.md) was updated to v3 alongside the code and remains
the design contract; this file is the change record.

## 1. Scope delivered

| Area | Delivered |
| :-- | :-- |
| Book CRUD | `POST/GET /books`, `GET/PUT/DELETE /books/{id}` — genres (shared per-user table + `genre_text` FTS denorm), cover handling, 409 on duplicate ISBN/ASIN |
| Annotation CRUD | quote/note/color/chapter/location + tags, favourite ★, rating 0–5; filters `book_id`, `tag`, `color`, `favorite=1`, `min_rating=N`; duplicate quotes → 409 |
| Movies *(new)* | `movies` mirror books: director, year, TMDB id, poster, genres, trimmed cast (`cast_json`) |
| Dialogues *(new)* | quotes from films: `timestamp`, `character`, `actor` (auto-filled from the stored cast when the character matches), plus the same note/tags/favourite/rating treatment |
| Importers | Markdown — **two shapes auto-detected**: Tippani frontmatter format and real **Readest** exports; **Bookcision** JSON; **Hardcover** saved journal page (HTML). Kindle `My Clippings.txt` deferred by owner decision (route answers 501) |
| Metadata | Google Books + Open Library (books; merged, best-effort), **TMDB** (movies; details + credits in one call, v3 key / v4 token auto-detected). On-demand only, never in the background |
| Covers/posters | Downloaded once into `data/covers/`, served locally at `/covers/{file}` with immutable cache headers; the single outbound fetch sits behind an SSRF guard (host allowlist incl. redirects, private-IP block at connect time, 2 MB cap, content sniffing, server-generated names) |
| Search | `GET /search` extended to movies + dialogues scopes — a dialogue is findable by its text, its character, or its actor ("everything Bogart says") |
| Export *(new)* | `GET /books/{id}/export`, `GET /movies/{id}/export` (Obsidian-friendly markdown), `GET /export` (whole-library zip: `books/*.md` + `movies/*.md`). Book exports are valid importer input — **round-trips are dedupe no-ops** |
| UI | Library + Movies tabs (lookup/manual add, detail, edit, delete), annotation/dialogue lists with color/tag/favourite/min-rating filters, star + rating controls per row, import buttons with added/skipped feedback, **post-import review pass** for quotes missing chapter/location (fill one at a time, skip one, skip all), unified search page, settings (change password + admin users) |

## 2. Schema (migrations `0003`, `0004`)

- **`0003_movies.sql`** — `movies`, `movie_genres` (reuses the per-user `genres` table),
  `dialogues` (timestamp/character/actor, favourite, rating 0–5), `dialogue_tags` (reuses the
  per-user `tags` table), and `movies_fts`/`dialogues_fts` external-content FTS5 tables with the
  standard trigger trio. Dialogue FTS indexes `character` and `actor` columns too.
- **`0004_quote_meta.sql`** — rebuilds `annotations` (SQLite can't alter constraints) to:
  add `favorite` + `rating`, and **drop the `source` CHECK** — the importer list keeps growing
  (`hardcover_html`, …), so source validation moved to app code. The rebuild parks
  `annotation_tags` around the implicit cascade, preserves row ids, recreates the FTS triggers,
  and re-syncs the index.
- **Dedupe hardened** (`store.DedupeHash`): casefold + whitespace collapse + **typographic
  folding** (curly quotes/dashes/ellipsis → ASCII), so the same passage synced through
  differently-formatted tools (Bookcision emits `’`/`–`, markdown exports `'`/`-`) collapses to
  one row. This was an explicit owner requirement and is verified end-to-end (see §5).

## 3. Import pipeline details

- One shared multipart flow: 5 MB cap **before** parsing, pure parsers in `internal/importer`
  (no DB/HTTP), one transaction per file, `INSERT OR IGNORE` on `(book_id, dedupe_hash)` with
  honest `added`/`skipped` counts — re-imports are idempotent.
- **Book identity falls through** normalized ISBN → ASIN → `lower(title)+lower(author)`, and a
  weaker-identity match backfills the row's missing ISBN/ASIN. This is what makes a Readest
  export (no ISBN) and a Hardcover page (has ISBN) of the same book land in **one** row.
  (Found live in E2E — the original lookup stopped at the first present identity and split the
  book; fixed with a regression test.)
- **Frontmatter markdown**: every `- key:` binding optional; aliases `loc|location|page`,
  `color|colour`; `favorite` and `rating` bindings supported.
- **Readest**: `# Title`, `**Author**:`, `###` chapters, `*[Page: N](readest://…)*` → `p.N`.
- **Hardcover**: the saved journal page's Inertia `data-page` JSON; `event == "quote"` entries;
  narrator filtered out of the author line; page positions → `p.N`; entry tags preserved.
- Real exports live in `internal/importer/testdata/*_real.*` — **gitignored** (they contain the
  owner's reading history and account handle); tests skip when absent, and committed synthetic
  fixtures cover the same formats in CI. A `.dockerignore` keeps testdata and docs out of the
  image build context entirely (the distroless image only ever contained the binary).

## 4. Security posture (unchanged principles, new surface)

Every new route sits behind the session middleware; every statement is scoped to the session
user (foreign rows 404, no existence leak — E2E-verified). FTS input still goes exclusively
through `search.Query`. Upload paths cap size before parsing and sniff content. The one new
outbound surface (cover/poster fetch) is allowlist + private-IP guarded per PLAN §6, and
`/covers/{file}` validates names against a strict pattern (path traversal → 404, E2E-verified).
TMDB lookup without a configured key degrades to a clear 503; manual movie entry keeps working.

## 5. Verification

- **Unit/integration**: `go vet ./...` clean; `go test ./...` green across all packages
  (store schema/FTS/dedupe, importer parsers incl. real + synthetic fixtures, metadata clients
  via httptest incl. SSRF-guard rejection cases, httpapi end-to-end handler tests incl.
  ownership isolation, filters, import idempotency, export round-trip, TMDB-backed movie
  creation). Frontend `npm run build` green.
- **Docker Compose** (image built from this tree, loopback port, throwaway volume): stack comes
  up **healthy** and onboarding → book/annotation CRUD → search → SPA serving → TMDB route all
  work from inside the container. This test caught a real deployment bug: the distroless image
  runs as `nonroot`, but a fresh `/data` named volume initialized **root-owned**, so startup died
  with `unable to open database file` — a first `docker compose up` would have failed for every
  user. Fixed by staging a `nonroot`-owned `/data` in the image (Dockerfile) so the volume
  inherits that ownership.
- **Live E2E** (real binary, scratch data dir, flushed afterwards): 25/25 checks passed —
  onboarding → CRUD with favourite/rating/tags → **typographic-dedupe 409** → filters → search
  (incl. dialogue-by-actor) → imports of the owner's real Readest (24 quotes), Bookcision
  (11), and Hardcover (45 events) exports → **cross-source collapse confirmed**: the Hardcover
  journal of the same book attached to the Readest-imported row and 33/45 quotes deduped →
  markdown export → re-import round-trip added 0 → zip export → covers traversal 404 →
  second-user isolation.
- A second, pre-push verification pass (README/doc claims + code regression + security/ownership
  re-sweep, skeptic-verified) confirmed **50 checks OK** — the code and security dimensions came
  back fully clean (no bugs; the milestone-1 review fixes all hold). It surfaced only
  documentation/default-config discrepancies, all fixed: the README's "binds to 127.0.0.1 only"
  claim was corrected — a NAS app is meant to be LAN-reachable, so the compose keeps `8080:8080`
  and the docs now state the trade-off plainly (unauthenticated first-run onboarding → onboard
  promptly or bind host-local behind a proxy); CI publishes a multi-arch image (`amd64` tested,
  `arm64` published but untested, for NAS owners to try); the CLI `user del` now removes
  cover/poster files like the admin route; a redundant per-request session-expiry write was
  guarded; and PLAN §2/§3/§6/§7 + README were reconciled with the code (session 30 d idle / 90 d
  absolute, annotations DDL, User-Agent, `/healthz`, `GOMEMLIMIT` is opt-in not a hard default).
- An earlier adversarial multi-agent review pass (dimension finders + independent skeptic
  verification) ran over the full diff. Eight findings survived double-skeptic confirmation and
  were **all fixed**, each with a regression test:

  | Sev | Area | Fix |
  | :-- | :-- | :-- |
  | critical | `SearchPage` genres | Book search hits returned the space-joined `genre_text` **string**; the UI called `.map()` on it → TypeError blanked the whole SPA. Search now returns a genre **array** (matching `GET /books`); `genre_text` can't be split safely since names contain spaces |
  | major | rate-limit bypass | `clientIP` trusted the **leftmost** `X-Forwarded-For` entry (client-forgeable behind an appending proxy), so an attacker could rotate a fake IP per request and mint a fresh limiter bucket each time — unlimited login guesses / bcrypt CPU. Now trusts the **rightmost** (proxy-appended) entry |
  | major | session lifetime | A password change didn't revoke sessions, and sliding refresh had no absolute cap → a leaked cookie renewed forever. Password change now revokes all of the user's sessions (re-issuing one for the caller); refresh is capped at `created_at + 90 d` absolute |
  | minor | orphaned files | Deleting a user cascaded DB rows but left their cover/poster files on disk — now removed best-effort |
  | minor | bcrypt limit | Passwords > 72 bytes made bcrypt error → 500; now a clean 400 up front (signup / create-user / change-password) |
  | minor | import identity | Book-identity match backfilled missing ISBN/ASIN only on the *title* path; an ASIN match returned early, so a later ISBN-only import with a different title split the book. Backfill now runs on **every** match path |
  | minor | import overflow | A Hardcover page-position value large enough to overflow `int` wrapped to a negative page number; now bounded (junk values drop the location) |
  | minor | UI races | Review-panel "Save & next" PUT a mount-time snapshot (reverting concurrent star/rating/tag edits) → now re-fetches current state first; annotation/dialogue list reloads had no stale-response guard (fast filter toggling could render stale results) → now sequence-guarded; a non-numeric year silently erased the stored value → now validated |

  Review scratch artifacts (probe/fuzz `zz_*` test files the finder agents wrote to demonstrate
  bugs) were removed after their findings were folded into permanent, named regression tests.

## 6. Deferred / open

- Kindle `My Clippings.txt` importer (PLAN §5c) — deliberately deferred; the route answers 501.
- Semantic search, shared/household libraries — deferred as before (PLAN §9).
- TMDB genre names arrive in the account's default language; fine for now.
- **Owner action:** register a free TMDB application key (themoviedb.org → Settings → API) and
  paste it into `defaultTMDBKey` in `cmd/tippani/main.go` — the Jellyfin-style embedded app key
  that makes movie lookup work on every install with zero configuration (TMDB rate-limits per
  client IP, so a shared key is fine; attribution added to the README). Until then, lookup
  answers 503 and `TIPPANI_TMDB_API_KEY` remains the per-install way to enable it.

## 7. Development infrastructure

- `.claude/` (gitignored) is the project workbench: session skills (`run-tippani`,
  `verify-tippani`, `add-migration`, `add-endpoint`) and all temporary files (`.claude/tmp/`).
- Deploy files document `TIPPANI_TMDB_API_KEY` (compose + systemd); the dev proxy list covers
  the new routes.
- Toolchains on the dev machine: Go 1.26.4 + Node 24 (winget), not on PATH — see
  `.claude/skills/run-tippani/SKILL.md`.
