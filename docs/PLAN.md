# Self-Hosted Book Annotations App — Plan v2

Multi-user, localhost-bound annotation store: paste or bulk-import quotes, attach notes/colours/tags,
fetch cover + metadata, and search author / title / genre / annotation text near-instantly.
Target host: a low-powered NAS also running ~100 other services → **CPU frugality is a first-class requirement.**

**Changes from v1:**

- **Hardcover dropped entirely** (read + write). No documented write mutation exists for `reading_journals`; per-quote push is likely impossible via the public API, and the read integration isn't worth keeping alone. Removes: `hardcover_id`, `sync_state`, `/sync/*`, token handling.
- **Wikidata dropped** (weak fuzzy data, extra integration + throttling rules).
- **Added:** multi-user with form login, CSRF, per-user libraries; genre model; unified FTS5 search with input escaping; explicit CPU budget.
- `external_id` column dropped — `dedupe_hash` alone makes re-imports idempotent.

---

## 1. Stack

| Layer | Choice | Why |
| :--- | :--- | :--- |
| Backend | **Go 1.25+** | Static binary ~15–25 MB; idle RSS ~20–40 MB; idle CPU ≈ 0 (no polling); stdlib router (1.22+ patterns) and stdlib CSRF (1.25 `http.CrossOriginProtection`) |
| DB | **SQLite + FTS5** via `modernc.org/sqlite` | Pure Go → `CGO_ENABLED=0`, trivial static/cross builds and distroless images; **FTS5 compiled in by default, no build tag** |
| Frontend | **React + Tailwind v4**, static build embedded via `go:embed` | Built on the dev machine; the NAS never runs Node; assets precompressed at build time |
| Deploy | Single binary + `data/` dir; **binds `127.0.0.1`** | Exposure/TLS delegated to the user's own reverse proxy / Tailscale / Netbird / Twingate |

Driver tradeoff: `modernc` costs ~1.5–2× the per-query CPU of CGo `mattn/go-sqlite3`, but queries at this scale are single-digit milliseconds either way; build/deploy simplicity wins. **Confidence: High.**

---

## 2. Users, Auth, Exposure

**Model: per-user isolated libraries.** Every book, annotation, tag, and genre row belongs to one user; nothing is shared. (Assumption — confirm, see §11. Duplicate book rows across users cost kilobytes; strongest isolation, simplest queries.)

- **Login:** SPA form → `POST /auth/login` → server-side session stored in SQLite. Token = 256-bit random; **only its SHA-256 is stored**. Cookie: `HttpOnly; SameSite=Lax; Path=/`; `Secure` flag via config (enable when your proxy terminates TLS). Absolute expiry 30 d with sliding refresh; expired rows deleted lazily on next login — no cleanup cron.
- **Passwords:** **bcrypt, cost 10** (tunable). ~60–100 ms per login on weak ARM — a rare event, acceptable. *Primary downside:* not memory-hard. Argon2id rejected deliberately: its ~64 MB per hash is exactly wrong on a RAM-shared NAS.
- **CSRF:** Go 1.25 **`http.CrossOriginProtection`** (Sec-Fetch-Site / Origin check) wrapping all non-GET routes — stdlib, zero tokens, zero deps. *Primary downside:* requires Go 1.25+ and evergreen browsers (both fine here).
- **Brute force:** `golang.org/x/time/rate` limiter keyed on (client IP, username), e.g. 5/min burst 5. Client IP read from `X-Forwarded-For` **only when** `TRUSTED_PROXY` is configured.
- **User management:** CLI subcommands — `app user add|passwd|del` — plus an in-app change-password form. No admin UI (YAGNI).
- **Binding:** default `127.0.0.1:8080`, overridable via `BIND`. Docker note: inside a container bind `0.0.0.0` and publish host-locally: `-p 127.0.0.1:8080:8080`.
- **Headers:** CSP `default-src 'self'` (+ nothing external — covers are served locally, §6), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. **No CORS** — same-origin SPA; none needed.

---

## 3. Data Model

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,          -- sha256 of cookie token
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,                            -- always normalized to ISBN-13, no hyphens
  asin TEXT,
  cover_path TEXT,                      -- local file under data/covers/ (see §6)
  description TEXT,
  published_year INTEGER,
  google_id TEXT, openlibrary_id TEXT,
  genre_text TEXT NOT NULL DEFAULT '',  -- denormalized, space-joined genre names (FTS input)
  source_metadata TEXT,                 -- raw API payloads (json)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_books_user_isbn ON books(user_id, isbn) WHERE isbn IS NOT NULL;
CREATE UNIQUE INDEX idx_books_user_asin ON books(user_id, asin) WHERE asin IS NOT NULL;

CREATE TABLE genres (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);
CREATE TABLE book_genres (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);
CREATE INDEX idx_bg_genre ON book_genres(genre_id, book_id);

CREATE TABLE annotations (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quote TEXT, note TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow','blue','pink','orange')),
  chapter TEXT,
  location TEXT,                        -- free text page/loc/%; NOT part of dedupe
  source TEXT NOT NULL CHECK (source IN ('manual','md','kindle_clippings','bookcision')),
  dedupe_hash TEXT NOT NULL,            -- sha256(lower(collapse_ws(coalesce(quote, note))))
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (quote IS NOT NULL OR note IS NOT NULL),
  UNIQUE (book_id, dedupe_hash)
);
CREATE INDEX idx_ann_book ON annotations(book_id);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);
CREATE TABLE annotation_tags (
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (annotation_id, tag_id)
);
CREATE INDEX idx_at_tag ON annotation_tags(tag_id, annotation_id);
```

Rules:

- **ISBN:** convert ISBN-10 → ISBN-13, strip hyphens, before store/lookup/dedupe, so cross-source matches align.
- **Colours fixed at 4**; Kindle sources carry no colour → default `yellow`; recolour in-app.
- **Dedupe:** `location` deliberately excluded from the hash — Kindle locations shift across devices/editions and would break idempotent re-imports of an ever-growing `My Clippings.txt`. Tradeoff accepted: the same passage highlighted twice collapses to one row (usually desirable). Quote text normalized (trim, collapse internal whitespace, casefold) before hashing.
- **Hard delete everywhere.** No external sync → no tombstones/soft-delete needed.
- **`genre_text`** is maintained by app code whenever a book's genres change (denormalization so book FTS can match genre words; `book_genres` remains the source of truth for exact filtering).

---

## 4. Search — author / title / genre / annotation text

Two **external-content FTS5** tables, kept in sync by INSERT/UPDATE/DELETE triggers (UPDATE trigger = FTS `'delete'` row then re-insert; keep an `INSERT INTO x_fts(x_fts) VALUES('rebuild')` maintenance path):

```sql
CREATE VIRTUAL TABLE books_fts USING fts5(
  title, author, genre_text,
  content='books', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);
CREATE VIRTUAL TABLE annotations_fts USING fts5(
  quote, note,
  content='annotations', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);
```

- **One endpoint:** `GET /search?q=&scope=all|books|annotations&genre=&author=&book_id=&tag=&color=&limit=&offset=`. Free text → `MATCH`; structured filters (genre/author/book/tag/color) → indexed joins, not FTS. `scope=all` returns two bm25-ranked groups (matching books, matching annotations) in one response; annotation hits join `books` for title/author display. All queries scoped to the session user.
- **FTS5 injection / syntax safety (mandatory):** user input is parsed as FTS5 *query syntax* even when parameter-bound (`AND OR NOT NEAR`, `col:`, `-`, `*`, `^`, quotes) — malformed input errors, crafted input changes semantics. Never pass raw. Escape per-token (implicit AND), then bind:

```go
// "foo bar" -> `"foo" "bar"`  — safe for MATCH; append * to last token for typeahead.
func ftsQuery(q string) string {
    f := strings.Fields(q)
    for i, t := range f {
        f[i] = `"` + strings.ReplaceAll(t, `"`, `""`) + `"`
    }
    return strings.Join(f, " ")
}
```

- **Speed at scale** (e.g. 5,000 books / 250,000 annotations): FTS5 `MATCH` is an inverted-index lookup, not a table scan — typically ≤5 ms on weak ARM. `prefix='2 3'` keeps 2–3-char typeahead index-backed instead of term-expanding (index ~20–30 % larger; disk is cheap, CPU isn't). `remove_diacritics 2` makes “Bronte” find “Brontë”. Client debounces input ~200 ms. Run `ANALYZE` / `PRAGMA optimize` after bulk imports. Never use `LIKE '%…%'` anywhere. **Confidence: High** (design inference; verify with a generated 250k-row fixture during build).

Semantic search remains **deferred** (`sqlite-vec` later, if ever).

---

## 5. Ingestion

### 5a. Manual

`POST /annotations` with `book_id`, `quote`, optional `note/color/tags/chapter/location`.

### 5b. Markdown upload (fixed format — unchanged from v1)

Frontmatter = book; `##` heading = chapter; blockquote = quote; `- key: value` lines bind to the quote above; consecutive `>` lines join; missing `color` → `yellow`.

```markdown
---
title: The Book Title
author: Author Name
isbn: 9780000000000
---

## Chapter 3 — The Turning Point

> The quote text, which may span
> multiple lines.
- note: my thought about it
- color: yellow
- tags: philosophy, memory
- loc: p.142
```

### 5c. Kindle — `My Clippings.txt` (verified handling)

- Strip UTF-8 BOM at file start; normalize CRLF → LF.
- Split on the exact separator `==========` (ten `=`).
- Type from 2nd line: Highlight → quote; Note → note; Bookmark → skip.
- **Locale-dependent metadata line** (confirmed): never match English keywords — parse structurally on `|` separators + page/location number tokens.
- **Skip the verbatim sentinel** `<You have reached the clipping limit for this item>` (publisher/DRM clipping cap) — never store it as a quote.
- Notes aren't linked to highlights by Kindle: attach a Note to the Highlight at the same/adjacent location; unmatched notes become standalone annotations (`quote` NULL).
- Stream-parse (`bufio` with a raised max-token cap — default 64 KB errors on pathological long lines); **all inserts in one transaction per file**.

### 5d. Kindle — Bookcision JSON (verified shape)

```json
{
  "title": "The Book Title",
  "authors": "Author Name",
  "asin": "B000000000",
  "highlights": [
    { "text": "The highlighted passage.",
      "isNoteOnly": false,
      "note": "optional note",
      "location": { "url": "kindle://...", "value": 1234 } }
  ]
}
```

Map `text→quote`, `location.value→location` (keep `url` optionally), `isNoteOnly:true → quote NULL`. Parse `authors` defensively (string **or** array across versions — confirm against one real export, §12). Exports can also be clipping-limit-truncated.

**Upload safety (all three importers):** `r.Body = http.MaxBytesReader(w, r.Body, 5<<20)` *before* parsing; sniff content, ignore client Content-Type; nothing persisted raw.

---

## 6. Metadata — Google Books + Open Library only

| Source | Lookup key | Gives | Limits (verified) |
| :--- | :--- | :--- | :--- |
| **Google Books** | ISBN / title | cover, description, year, `categories` → genres | ~1,000 req/day courtesy; add an API key if ever exceeded |
| **Open Library** | ISBN | cover, author, `subjects` → genres | 1 req/s anonymous → **3 req/s with a descriptive User-Agent**; covers 100/IP per 5 min |

- Send `User-Agent: bookannot/1.0 (contact@example)` on **all** outbound calls.
- **On-demand only** — `POST /books/lookup {isbn?|title?}` → candidate list → user picks → persist. No background fetching, ever. Raw payloads cached in `books.source_metadata`; API categories/subjects pre-fill genres, user-editable.
- **Covers: download once → store in `data/covers/` → serve locally.** SSRF guard on the one fetch: host allowlist (`covers.openlibrary.org`, `books.google.com`, `books.googleusercontent.com`), resolve + block private/link-local IPs, ≤2 redirects, 2 MB size cap, 10 s timeout, server-generated filename. *Primary downside vs hotlinking:* a few KB stored per book — in exchange: no third-party runtime dependence, no browser-IP leakage, CSP stays `'self'`-only.
- Outbound hygiene: `http.Client{Timeout: 10s}`, `io.LimitReader` on bodies, TLS verification on, decode into typed structs tolerant of missing fields.

---

## 7. API Surface

```bash
POST   /auth/login          POST /auth/logout
POST   /auth/password       GET  /auth/me
POST   /books/lookup
POST   /books    GET /books    GET/PUT/DELETE /books/{id}
POST   /annotations
GET    /annotations?book_id=&tag=&color=&q=
PUT    /annotations/{id}    DELETE /annotations/{id}
GET    /genres   GET /tags            # minimal management
POST   /import/markdown              # multipart
POST   /import/kindle-clippings      # multipart
POST   /import/bookcision            # multipart
GET    /search?q=&scope=&genre=&author=&book_id=&tag=&color=
GET    /covers/{file}                # local static
```

Everything except `POST /auth/login` and the embedded SPA assets sits behind session middleware; every query is scoped to the session's user.

---

## 8. CPU Budget (shared NAS, ~100 co-tenant services)

| Concern | Measure |
| :--- | :--- |
| Idle | No pollers, timers, or background jobs → ~0 % CPU; 20–40 MB RSS |
| Burst cap | `GOMAXPROCS=1` (or 2) — hard-caps the app at one core so imports/searches can't starve neighbours; `GOMEMLIMIT=64MiB`; `GOGC=200` (fewer GC cycles at slightly more RAM) |
| SQLite | `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`; single writer connection |
| Imports | Streaming parse + **one transaction per file** — batched inserts are the difference between a sub-second burst and minutes of fsync churn |
| Static assets | Precompressed (gzip + brotli) at build, served with `Content-Encoding` + `Cache-Control: immutable` → zero runtime compression CPU |
| Search | Inverted-index MATCH (ms-scale), prefix indexes, 200 ms client debounce |
| Auth | bcrypt cost 10 ≈ 60–100 ms, rare event, rate-limited |
| Backup | Nightly `VACUUM INTO 'data/backup.db'` from NAS cron, off-peak — short burst, consistent snapshot. *Primary downside:* daily granularity. Litestream (continuous WAL streaming) rejected: constant background CPU on a box that can't spare it |

---

## 9. Phasing

| Phase | Scope | Uncertainty |
| :--- | :--- | :--- |
| **1 — MVP (everything)** | Schema + FTS5 + triggers, auth/multi-user/CSRF, manual + MD + Clippings + Bookcision import, Google + OL metadata + genres, local covers, colours/tags, unified search, React UI (dark/light) | Low |
| **Deferred** | Semantic search (`sqlite-vec`); admin UI; shared/household libraries | Optional |

**Build order:** schema + migrations → auth/sessions/CSRF (first, not last) → annotation CRUD + search + escaping → MD importer → Clippings importer (test on your real sample) → Bookcision importer (test on your real export) → metadata + covers → UI → systemd/Docker + backup docs.

---

## 10. Libraries

| Go dep | For | Note |
| :--- | :--- | :--- |
| `modernc.org/sqlite` | DB + FTS5 | pure Go, FTS5 default |
| `gopkg.in/yaml.v3` | MD frontmatter | fixed format — hand-roll it to reach 3 deps if desired |
| `golang.org/x/crypto` | bcrypt | quasi-stdlib |
| `golang.org/x/time` | login rate limit | quasi-stdlib |

Everything else is stdlib: routing (Go 1.22+ method+wildcard patterns), CSRF (Go 1.25 `http.CrossOriginProtection`), multipart, `crypto/sha256`, plain-HTTP JSON clients, `embed`. **Go direct deps: 4.**
Frontend runtime deps: `react`, `react-dom` (**2**); `vite` + `tailwindcss` dev-only. No react-query/Redux/component kits — `fetch` + `useState` suffices at this scale.

---

## 11. Assumptions & Confidence

| Claim | Confidence |
| :--- | :--- |
| **Per-user isolated libraries** (no sharing) is the desired multi-user model | **Assumed — confirm.** Shared-library model would change §3 materially |
| Go 1.25+ toolchain available at build time (CSRF dep) | High |
| FTS5 search ≤ ~5 ms at 5k books / 250k annotations on weak ARM | High (design inference; validate against a generated fixture) |
| `modernc.org/sqlite` ships FTS5 with no build tag; `CGO_ENABLED=0` static builds | High (verified) |
| Clippings gotchas — locale line, `==========`, BOM, clipping-limit sentinel | High (verified) |
| Bookcision shape incl. `location:{url,value}` | High (verified; `authors` string-vs-array needs one real export) |
| Google ~1,000/day; OL 1→3 req/s with UA, covers 100/5 min | High (official docs) |

---

## 12. Open Items (needed from you, none blocking start)

1. **One real Bookcision export** — lock the `authors` field type in the §5d parser.
2. **One `My Clippings.txt` sample in your Kindle's UI language** — validate §5c structural parsing.
3. **Confirm the per-user-isolated library assumption** (§2/§11).
