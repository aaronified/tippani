# Self-Hosted Book Annotations App — Plan v3

Multi-user, localhost-bound annotation store: paste or bulk-import quotes, attach notes/colours/tags,
fetch cover + metadata, and search author / title / genre / annotation text near-instantly.
Target host: a low-powered NAS also running ~100 other services → **CPU frugality is a first-class requirement.**

**Changes from v2:**

- **Added: movie dialogues** (§3b). Movies mirror books; dialogues mirror annotations but carry
  `timestamp`, `character`, `actor` instead of chapter/location, and have **no colour/tags/importers**
  (not needed — YAGNI). Metadata comes from **TMDB** (§6): one lookup call returns details + credits;
  posters reuse the local cover store. When a dialogue's `character` matches the stored cast list,
  the server auto-fills `actor`.
- No new Go deps: TMDB is another plain-HTTP JSON client behind the same outbound hygiene rules.

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

- **Login:** SPA form → `POST /auth/login` → server-side session stored in SQLite. Token = 256-bit random; **only its SHA-256 is stored**. Cookie: `HttpOnly; SameSite=Lax; Path=/`; `Secure` flag via config (enable when your proxy terminates TLS). **30 d sliding idle window** (each use past the halfway mark bumps expiry forward) capped by a **90 d absolute limit from creation** (`created_at + SessionMaxLifetime`), so a token can't renew indefinitely; a password change revokes all of the user's sessions. Expired rows deleted lazily on next login — no cleanup cron.
- **Passwords:** **bcrypt, cost 10** (tunable). ~60–100 ms per login on weak ARM — a rare event, acceptable. *Primary downside:* not memory-hard. Argon2id rejected deliberately: its ~64 MB per hash is exactly wrong on a RAM-shared NAS.
- **CSRF:** Go 1.25 **`http.CrossOriginProtection`** (Sec-Fetch-Site / Origin check) wrapping all non-GET routes — stdlib, zero tokens, zero deps. *Primary downside:* requires Go 1.25+ and evergreen browsers (both fine here).
- **Brute force:** `golang.org/x/time/rate` limiter keyed on (client IP, username), e.g. 5/min burst 5. Client IP read from `X-Forwarded-For` **only when** `TRUSTED_PROXY` is configured.
- **User management:** the **first user is the admin** — created by first-run onboarding (`GET /auth/status` → `POST /auth/signup`, which only succeeds while the users table is empty) or by the CLI when the DB is empty. The admin adds/removes other users from an in-app panel (`GET/POST /admin/users`, `DELETE /admin/users/{id}`); onboarding closes once any user exists. CLI subcommands (`app user add|passwd|del`) remain for bootstrapping/scripting, plus an in-app change-password form. Roles are a single `is_admin` flag — no finer-grained permissions (YAGNI).
- **Binding:** the binary defaults to `127.0.0.1:8080` (overridable via `TIPPANI_BIND`). The Docker image binds `0.0.0.0:8080` and the shipped compose publishes `8080:8080`, so a NAS deployment is reachable on the LAN by default — that's the point of a NAS app. Trade-off to accept/document: first-run onboarding is unauthenticated (first caller claims admin), so onboard promptly or bind host-local (`-p 127.0.0.1:8080:8080`) behind a proxy until you have. After onboarding, every route requires a session.
- **Headers:** CSP `default-src 'self'` (+ nothing external — covers are served locally, §6), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. **No CORS** — same-origin SPA; none needed.

---

## 3. Data Model

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  preferences TEXT NOT NULL DEFAULT '{}',  -- UI prefs JSON: aesthetic/theme/accent (0005, §10 note)
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
  cover_path TEXT,                      -- local file under data/MediaCover/ (see §6)
  description TEXT,
  published_year INTEGER,
  google_id TEXT, openlibrary_id TEXT,
  genre_text TEXT NOT NULL DEFAULT '',  -- denormalized, space-joined genre names (FTS input)
  source_metadata TEXT,                 -- raw API payloads (json)
  favorite INTEGER NOT NULL DEFAULT 0,  -- star flag (migration 0006, mirrors annotations)
  rating INTEGER NOT NULL DEFAULT 0     -- inert — ratings retired (dead column; migration 0006)
    CHECK (rating BETWEEN 0 AND 5),
  series TEXT, series_index REAL,       -- series/collection name + fractional order (0006)
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
  source TEXT NOT NULL,                 -- 'manual'|'md'|'bookcision'|'hardcover_html'|… validated in app code (the source list grows; SQLite can't alter a CHECK, so migration 0004 dropped it)
  favorite INTEGER NOT NULL DEFAULT 0,  -- star flag (added in migration 0004)
  dedupe_hash TEXT NOT NULL,            -- sha256(lower(collapse_ws(coalesce(quote, note))))
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (quote IS NOT NULL OR note IS NOT NULL),
  UNIQUE (book_id, dedupe_hash)
);
CREATE INDEX idx_ann_book ON annotations(book_id);

-- Spaced-repetition daily review (migration 0013, ROADMAP №2). One state row
-- per annotation, created lazily on the first answer; annotations without a
-- row are the "unseen" pool. Model: exponential forgetting curve — recall
-- p = 2^(-elapsed_days/stability) with stability the memory half-life in
-- days; a card is due when elapsed >= stability (p <= 0.5), and both due-ness
-- and most-forgotten-first ordering reduce to plain julianday() arithmetic at
-- query time (no math functions, no background jobs — §2 holds). Answers:
-- got → stability' = min(365, max(stability*2.5, elapsed*1.2));
-- forgot → max(1, stability*0.25); skip → last_touched_at only (benched for
-- the local day). Mastery soon/later/someday derives from stability (7/30
-- day thresholds), never stored. Outcome vocabulary app-validated (no CHECK).
-- Review state never enters dedupe hashes and is invisible to FTS.
CREATE TABLE annotation_reviews (
  annotation_id    INTEGER PRIMARY KEY REFERENCES annotations(id) ON DELETE CASCADE,
  stability        REAL NOT NULL DEFAULT 1.0,  -- memory half-life, days
  review_count     INTEGER NOT NULL DEFAULT 0, -- got/forgot answers recorded
  lapse_count      INTEGER NOT NULL DEFAULT 0, -- "forgot" answers
  last_result      TEXT NOT NULL DEFAULT '',   -- got | forgot | skip
  last_reviewed_at TEXT,                       -- UTC; moved by got/forgot only
  last_touched_at  TEXT NOT NULL               -- UTC; moved by every answer
);

-- Recall-quiz score history (migration 0014). One row per completed quiz; the
-- questions are generated on the fly (no stored bank) and each answered
-- annotation nudges annotation_reviews, so only the tally persists. Per-user,
-- flushable (DELETE /annotations/quiz/results).
CREATE TABLE quiz_results (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total    INTEGER NOT NULL,
  correct  INTEGER NOT NULL,
  taken_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow'    -- managed vocabulary (0005, §10 note)
    CHECK (color IN ('yellow','blue','pink','orange')),
  style TEXT NOT NULL DEFAULT 'sticker'
    CHECK (style IN ('sticker','banner','flyout','tape','reel')),
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
- **Dedupe:** `location` deliberately excluded from the hash — Kindle locations shift across devices/editions and would break idempotent re-imports of an ever-growing `My Clippings.txt`. Tradeoff accepted: the same passage highlighted twice collapses to one row (usually desirable). Quote text normalized (trim, collapse internal whitespace, casefold, **fold typographic punctuation** — curly quotes/dashes/ellipsis → ASCII) before hashing, so the same passage synced through differently-formatted sources (Bookcision’s `’`/`–` vs a markdown export’s `'`/`-`) still dedupes.
- **Favorite:** annotations and dialogues carry a `favorite` flag, owner-requested. UI: star toggle per row; list filters `favorite=1` alongside tag/color. Other candidate params (page-as-number, language, …) rejected as YAGNI.
- **Tags are shared by annotations and dialogues** (`annotation_tags` / `dialogue_tags` join the same per-user `tags` table), so one tag vocabulary spans books and movies.
- **Hard delete everywhere.** No external sync → no tombstones/soft-delete needed.
- **`genre_text`** is maintained by app code whenever a book's genres change (denormalization so book FTS can match genre words; `book_genres` remains the source of truth for exact filtering).

---

## 3b. Movies & Dialogues

Movies mirror books; dialogues mirror annotations. Same per-user isolation, same hard-delete,
same dedupe rule. The `genres` table is shared between books and movies (it is already per-user
and name-keyed; a second genre table would be pure duplication).

```sql
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  director TEXT,
  release_year INTEGER,
  tmdb_id INTEGER,
  poster_path TEXT,                      -- local file under data/MediaCover/ (shared cover store, §6)
  description TEXT,
  genre_text TEXT NOT NULL DEFAULT '',   -- denormalized, space-joined (FTS input), like books
  cast_json TEXT NOT NULL DEFAULT '[]',  -- [{"character":"…","actor":"…"}] from TMDB credits
  source_metadata TEXT,                  -- raw TMDB/TVDB payload (json)
  favorite INTEGER NOT NULL DEFAULT 0,   -- star flag (migration 0006, mirrors dialogues)
  rating INTEGER NOT NULL DEFAULT 0      -- inert — ratings retired (dead column; migration 0006)
    CHECK (rating BETWEEN 0 AND 5),
  series TEXT, series_index REAL,        -- franchise/collection name + order (0006)
  media_type TEXT NOT NULL DEFAULT 'movie', -- 'movie'|'show'; TV folded into movies (0006), validated in app code
  tvdb_id INTEGER,                       -- TheTVDB id (second supplier, 0006)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_movies_user_tmdb ON movies(user_id, tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX idx_movies_user_tvdb ON movies(user_id, tvdb_id) WHERE tvdb_id IS NOT NULL;

CREATE TABLE movie_genres (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, genre_id)
);
CREATE INDEX idx_mg_genre ON movie_genres(genre_id, movie_id);

CREATE TABLE dialogues (
  id INTEGER PRIMARY KEY,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  note TEXT,
  character TEXT,                        -- who says it
  actor TEXT,                            -- who plays them (auto-filled from cast_json on match)
  timestamp TEXT,                        -- free text, like annotations.location; use HH:MM:SS
                                         --   for clean lexical ordering (no normalization — KISS)
  favorite INTEGER NOT NULL DEFAULT 0,   -- star flag, same as annotations
  dedupe_hash TEXT NOT NULL,             -- sha256(lower(collapse_ws(quote))), same fn as annotations
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (movie_id, dedupe_hash)
);
CREATE INDEX idx_dlg_movie ON dialogues(movie_id);

CREATE TABLE dialogue_tags (                 -- same per-user tags table as annotations
  dialogue_id INTEGER NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (dialogue_id, tag_id)
);
CREATE INDEX idx_dt_tag ON dialogue_tags(tag_id, dialogue_id);
```

Rules:

- **`cast_json`** is the trimmed top-billed cast (≤20 entries) captured at TMDB lookup time. It powers
  the character picker in the UI and server-side actor auto-fill (case-insensitive match on
  `character` when `actor` is empty). Manual movies simply have an empty cast list.
- **No colours, tags, or importers for dialogues** — not requested, easy to add later (YAGNI).
- Dialogue lists order by `(timestamp IS NULL), timestamp, id` — lexical, correct when timestamps
  are consistently formatted; deliberate KISS over parsing/normalizing time formats.

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
-- movies/dialogues mirror the same pattern (§3b); dialogues index character +
-- actor too, so "find that Rick Blaine line" / "everything Bogart says" works:
CREATE VIRTUAL TABLE movies_fts    USING fts5(title, director, genre_text, content='movies', ...);
CREATE VIRTUAL TABLE dialogues_fts USING fts5(quote, note, character, actor, content='dialogues', ...);
```

- **One endpoint:** `GET /search?q=&scope=all|books|annotations|movies|dialogues&limit=`. Free text → `MATCH`. `scope=all` returns bm25-ranked groups (books, annotations, movies, dialogues) in one response; annotation/dialogue hits join their parent for title display. All queries scoped to the session user. Structured filters (tag/color/book_id/movie_id) live on the list endpoints (`GET /annotations`, `GET /dialogues`) where the UI actually uses them — not duplicated onto /search (KISS).
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

- **Typo-tolerant fuzzy pass (0.6.9):** when the exact pass returns **zero** hits across every requested scope and the query is correctable (≥1 token ≥3 runes, ≤8 tokens, ≤64 runes), the handler harvests the indexed terms from per-index `fts5vocab` views (migration `0016`, zero-storage — they read each FTS index's term dictionary, so nothing new can corrupt and `store.Recover()` skips them via the `%_fts_%` name pattern), corrects each token to the nearest term by bounded Levenshtein in Go (`internal/search` — budget 1 for 3–5-rune tokens, 2 for longer; a token that is an indexed term or a prefix of one is left alone so `PrefixQuery` typeahead is preserved), and re-runs the same `MATCH` once with the corrected tokens. Corrected tokens still flow through `PrefixQuery`, so raw input never reaches `MATCH`. The vocab is index-wide, not user-scoped, but the re-run stays `user_id`-filtered and the response's `corrected` field is set **only** when this user actually received rows — so no other user's vocabulary is ever surfaced. A vocab read that fails even after the one-shot index repair logs `TIP-SRCH-004` and degrades to the plain empty result (search never 500s because fuzzy broke). Vocab DDL:

```sql
CREATE VIRTUAL TABLE books_fts_vocab USING fts5vocab('books_fts', 'row'); -- + annotations/movies/dialogues
```

Semantic search remains **deferred** (`sqlite-vec` later, if ever).

---

## 5. Ingestion

### 5a. Manual

`POST /annotations` with `book_id`, `quote`, optional `note/color/tags/chapter/location`.

### 5b. Markdown upload — two shapes, auto-detected

**(a) Tippani frontmatter format** (fixed format — unchanged from v1).
Frontmatter = book; `##` heading = chapter; blockquote = quote; `- key: value` lines bind to the quote above; consecutive `>` lines join; missing `color` → `yellow`.

**Every binding is optional** — a bare blockquote with no `- key:` lines at all is a valid import.
Accepted keys (aliases tolerate files produced by other tools): `note`, `color`/`colour`,
`tags`, `loc`/`location`/`page` → location, `favorite` (`true`/`yes`/`1`).
Unknown keys ignored. Fixture: `internal/importer/testdata/markdown_frontmatter.md`.

**(b) Readest "Highlights & Annotations" export** (verified against a real export, 2026-07-04;
fixture: `internal/importer/testdata/markdown_real.md`): first `# ` heading = title;
`**Author**: name` line = author; `### heading` = chapter (`##` section headers and `---`
rules ignored); consecutive `>` lines = one quote; the trailing
`*[Page: N](readest://…) · Time: …*` line → location `p.N` (deep link + timestamp discarded).
Carries no notes/colours/tags — every extra field must be optional.

Detection: first non-blank line `---` → (a); first non-blank line `# ` → (b); anything else → 400.
After an import the UI offers a **review pass** over annotations missing chapter/location:
fill them in one at a time, skip one, or skip all — no server round-trip beyond normal `PUT`s.

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

### 5c. Kindle — `My Clippings.txt` (verified handling) — **deferred**

> Deferred by owner decision (2026-07-04): Bookcision covers the Kindle path for now. The route
> stays registered as 501 so the API surface is honest; the notes below remain the spec for
> whenever it lands.

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

Map `text→quote`, `location.value→location` (keep `url` optionally), `isNoteOnly:true → quote NULL`. Parse `authors` defensively (string **or** array across versions — confirmed string in the real export, §12). Exports can also be clipping-limit-truncated.

### 5e. Hardcover — saved journal page (verified against a real page)

Hardcover.app has no quote export; a saved "reading journal" HTML page (`…/books/<slug>/journals/@user`)
carries everything as JSON in the Inertia `data-page` attribute of `<div id="app">`
(HTML-escaped; fixture: `internal/importer/testdata/hardcover_html_real.htm`):

- Extract the `data-page="…"` attribute value (scan between markers — no HTML parser dep),
  `html.UnescapeString`, then decode typed JSON.
- Book: `props.book.title`; author = `props.book.contributions[]` names whose `contribution`
  is null/empty (filters out narrators), joined `", "` — fall back to the first name if the
  filter empties. ISBN/ASIN: book-level `isbn13` is often empty — take the first quote entry's
  `edition.isbn13`/`isbn10`/`asin`.
- Quotes: `props.journals[]` entries with `event == "quote"`; quote text = `entry` (string);
  `metadata.position` `{type:"pages", value:N}` → location `p.N` (other position types dropped
  — YAGNI); entry `tags[]` mapped defensively when present (strings, or objects with a
  name-ish field). Other events (progress updates, ratings, status changes) ignored.
- Source value: `hardcover_html`. Endpoint: `POST /import/hardcover-html` (multipart, same 5 MB cap).

**Duplicate enrichment (all importers):** a skipped duplicate (same dedupe hash in the same book)
is not discarded — it **donates whatever the existing row lacks**: chapter/location/note fill when
empty, color upgrades from the yellow default, favorite only ever turns on, tags union.
Existing non-default values always win, so user edits and earlier imports are
never overwritten; a re-import of identical data is a no-op (no writes). Responses report
`added / skipped / enriched`.

**Upload safety (all importers):** `r.Body = http.MaxBytesReader(w, r.Body, 5<<20)` *before* parsing; sniff content, ignore client Content-Type; nothing persisted raw.

---

## 6. Metadata — Google Books + Open Library (books), TMDB (movies)

| Source | Lookup key | Gives | Limits (verified) |
| :--- | :--- | :--- | :--- |
| **Google Books** | ISBN / title | cover, description, year, `categories` → genres | ~1,000 req/day courtesy; add an API key if ever exceeded |
| **Open Library** | ISBN | cover, author, `subjects` → genres | 1 req/s anonymous → **3 req/s with a descriptive User-Agent**; covers 100/IP per 5 min |
| **TMDB** | title (+year) | poster, overview, year, genres, director, **credits → character/actor pairs** | ~50 req/s **per client IP** — which is why a single app key shared by every install works (the Jellyfin/Kodi pattern; TMDB permits embedded open-source app keys, attribution required). Tippani ships a built-in app key (`defaultTMDBKey` in `cmd/tippani/main.go`, registered by the project owner); `TIPPANI_TMDB_API_KEY` (v3 key or v4 read token, auto-detected) overrides. With neither, movie lookup returns 503 with a clear message and manual movie entry still works |

- Send a single descriptive `User-Agent` on **all** outbound calls (the code sends `tippani/1.0 (+https://github.com/aaronified/tippani)`).
- **On-demand only** — `POST /books/lookup {isbn?|title?}` / `POST /movies/lookup {title, year?}` → candidate list → user picks → persist. No background fetching, ever. Raw payloads cached in `source_metadata`; API categories/subjects/genres pre-fill genres, user-editable. TMDB details use `append_to_response=credits` — **one call** for details + cast + crew (director).
- **Covers & posters: download once → store in `data/MediaCover/` → serve locally** at `/covers/{file}` (*arr-style folder name; `serve` renames a legacy `data/covers/` in place on startup). SSRF guard on the one fetch: host allowlist (`covers.openlibrary.org`, `books.google.com`, `books.googleusercontent.com`, `image.tmdb.org`), resolve + block private/link-local IPs, ≤2 redirects, 2 MB size cap, 10 s timeout, server-generated filename. *Primary downside vs hotlinking:* a few KB stored per book — in exchange: no third-party runtime dependence, no browser-IP leakage, CSP stays `'self'`-only. `POST /covers/refetch` (admin) retries rows whose image is missing, across all users, from the URL cached in `source_metadata`.
- Outbound hygiene: `http.Client{Timeout: 10s}`, `io.LimitReader` on bodies, TLS verification on, decode into typed structs tolerant of missing fields.

---

## 6b. Export — Obsidian-friendly markdown

One renderer, three endpoints (all session-scoped):

- `GET /books/{id}/export`, `GET /movies/{id}/export` → a single `.md` (`text/markdown`,
  `Content-Disposition: attachment`).
- `GET /export` → `tippani-export.zip` with `books/<title>.md` + `movies/<title>.md`
  (stdlib `archive/zip`; filenames sanitized `[/\:*?"<>|]` → `-`, collisions get ` (2)` suffixes).

Format: YAML frontmatter (Obsidian Properties) with the item's metadata (title, author/director,
isbn/year, genres); body = the §5b format **(a)** shape — `##` chapter headings (books), one
blockquote per quote (multi-line quotes get `> ` per line), then `- key: value` lines for
**non-default metadata only**: note, color (≠ yellow), tags, loc / timestamp, character, actor,
favorite (true). Books order by insertion (id), dialogues by timestamp — reading order.

Property: a book export is valid §5b(a) importer input, so **exports round-trip** — re-importing
one is a dedupe no-op. (Movie exports are export-only; there is no movie markdown importer — YAGNI.)

```bash
GET    /auth/status         POST /auth/signup    # onboarding (first user only); while onboarding is
                                     #   open, status also reports the kept backup archive
                                     #   ({backup:{name,created,size}|null}) for /auth/restore
POST   /auth/restore                 # onboarding only (users table empty): restore the kept
                                     #   <data>/backups archive — the moving-to-a-new-box path;
                                     #   no confirm needed (nothing to lose), rate-limited
POST   /auth/restore/upload          # onboarding only: restore from an UPLOADED backup file
                                     #   (multipart file=<tar.gz>) — the same path without SSHing
                                     #   an archive onto the fresh box first; rate-limited
POST   /auth/login          POST /auth/logout
POST   /auth/password       GET  /auth/me        # /auth/me includes preferences
PUT    /auth/me                       # {username} — change your own display name
PUT    /auth/me/preferences          # partial merge: appearance + spaced-repetition
                                     # (srDaily, srQuizLen, srQuizScope, srGrow, srShrink) (§10)
                                     # + guided-tour state (tour: done|skipped|postponed,
                                     #   tourStep 0..99 — the resume point while postponed)
GET    /admin/users   POST /admin/users   DELETE /admin/users/{id}   # admin only
PATCH  /admin/users/{id}              # {is_admin} grant/revoke (last admin protected)
GET    /admin/metadata-keys   PUT /admin/metadata-keys               # admin only (§10 note)
POST   /books/lookup
POST   /books    GET /books    GET/PUT/DELETE /books/{id}
POST   /annotations
GET    /annotations?book_id=&tag=&color=&favorite=&limit=   # tag= takes the NAME
GET    /annotations/daily-review?offset=      # today's deck (≤8): due first, then unseen; offset =
                                              #   client UTC-offset minutes (timezone-aware "today");
                                              #   also returns states {unseen,soon,later,someday,total}
POST   /annotations/{id}/review               # {result: got|forgot|skip, offset} → new stability +
                                              #   mastery + deck remaining (ROADMAP №2, DDL §3)
GET    /annotations/quiz?count=              # mastery-weighted MCQ round: which-source (annotations)
                                              #   + who-said (dialogues w/ actor); genre distractors
POST   /annotations/quiz/answer               # {id,correct} → folds one annotation into its review
                                              #   schedule as it's answered (per-answer, not batched)
POST   /annotations/quiz/submit               # {answers:[{id,kind,correct}]} → records the round score
GET    /annotations/quiz/stats                # {taken,total,correct,accuracy}
DELETE /annotations/quiz/results              # flush the quiz score history
PUT    /annotations/{id}    DELETE /annotations/{id}
POST   /movies/lookup                # TMDB search (title, optional year)
POST   /movies   GET /movies   GET/PUT/DELETE /movies/{id}
POST   /dialogues
GET    /dialogues?movie_id=&tag=&favorite=
PUT    /dialogues/{id}    DELETE /dialogues/{id}
GET    /genres                       # minimal management (names only)
GET    /tags     POST /tags    PUT/DELETE /tags/{id}   # managed vocabulary (§10 note)
POST   /import/markdown              # multipart (frontmatter or Readest, auto-detected)
POST   /import/bookcision            # multipart
POST   /import/hardcover-html        # multipart (saved Hardcover journal page)
POST   /import/kindle-clippings      # 501 — deferred (§5c)
GET    /books/{id}/export            # markdown (§6b)
GET    /movies/{id}/export           # markdown (§6b)
GET    /export                       # zip of the whole library (§6b)
GET    /search?q=&scope=all|books|annotations|movies|dialogues&limit=
                                     #   {books,annotations,movies,dialogues}; on a zero-hit
                                     #   query a fuzzy pass may add "corrected":"<query>" (§4)
GET    /stats                        # library counts, superlatives, 12-mo activity, colour + people breakdowns (§10 note)
GET    /admin/backup                 # {backup:{name,created,size}} | {backup:null} — the ONE kept
                                     #   server-side archive (newest only, date in the name)
POST   /admin/backup                 # build a dated tar.gz of the whole data dir (VACUUM INTO
                                     #   snapshot + media) into <data>/backups, drop older ones
GET    /admin/backup/download        # stream the kept archive (attachment; filename with date)
POST   /admin/restore                # {"confirm":"RESTORE"} — replace the data dir from the kept
                                     #   archive in-process: staged extract w/ traversal+bomb guards,
                                     #   validate db, swap, migrate+FTS-heal; one .pre-restore-<ts>
                                     #   safety generation kept; no Docker socket needed
POST   /admin/restore/upload         # multipart (confirm=RESTORE field + file=<tar.gz>, ≤2 GiB) —
                                     #   restore from an UPLOADED archive (from this or another
                                     #   server) via the same pipeline; foreign DBs pass iff their
                                     #   schema ≤ this build's (then migrate forward); 413 over cap
POST   /share/image                  # stage a rendered quote PNG (multipart "file") → {url}: a
                                     #   one-shot download path. For WebView wrappers with no Web
                                     #   Share API whose blob: bridges garble names/bytes.
GET    /share/image/{token}          # serve the staged PNG once (Content-Disposition names it);
                                     #   session-free BY DESIGN — DownloadManager fetches outside
                                     #   the cookie jar; the single-use random token is the credential
GET    /people/names?kind=           # kind=author|actor|director. distinct referenced names + saved-
                                     #   link status; joined multi-credit strings list as split
                                     #   components (§11, per-user creditSeparators pref); each row
                                     #   carries count = works referencing the name (books authored /
                                     #   distinct titles acted in / films directed). Director names come
                                     #   from movies.director (a movie's director; a show's creator)
POST   /people/lookup                # {kind,name} → {links:{imdb,tmdb,tvdb,wikipedia,openlibrary}}
POST   /people/rename                # {kind,from,to} → rename an author/actor/director across all
                                     #   books/dialogues/movies + fold saved metadata onto `to` (unify
                                     #   duplicate spellings); component-aware — renaming one name inside
                                     #   a joined credit never touches the co-credits.
                                     #   GET /people/names also sweeps orphaned rows on load
POST   /people/portrait              # {kind,name} → resolve+store portrait & pin identity: actor from
                                     #   the film's stored cast (no extra call), director from the film's
                                     #   cached TMDB crew (source_metadata, no extra call), author via OL
                                     #   disambiguated by their books (+Wikidata P18). {resolved,image,
                                     #   person,links}. Best-effort; manual Photo URL (PUT /people) overrides
GET    /metadata/status              # TMDB key source, google key set?, last book-lookup outcome
GET    /covers/{file}                # local static (covers + posters, data/MediaCover)
POST   /covers/refetch               # admin: re-fetch missing covers/posters (all users); chunked:
                                     #   {cursor?, limit?} → {fetched, failed, enriched,
                                     #   next_cursor, done, total, remaining}; client loops until done
POST   /metadata/reverify            # force-fetch & re-verify preview (ROADMAP §2): {book_ids?,
                                     #   movie_ids?, people?:[{kind,name}]} (≤15/call, client chunks)
                                     #   → per-item {status, source, diffs:[{field,stored,fresh}]};
                                     #   targets the pinned ids, writes NOTHING
POST   /metadata/reverify/apply      # write only the user-approved fields: {items:[{type, id|kind+
                                     #   name, set:{field:value}}]} → per-item {ok,error,note};
                                     #   whitelisted fields, per-item tx, image miss degrades to note
GET    /healthz                      # public liveness probe (container HEALTHCHECK)
```

Everything except `GET /auth/status`, `POST /auth/signup`, `POST /auth/restore`, `POST /auth/restore/upload` (all self-guarded: first-run only), `POST /auth/login`, `GET /healthz`, and the embedded SPA assets sits behind session middleware; every query is scoped to the session's user, and `/admin/*` + `POST /covers/refetch` additionally require `is_admin`.

### §10 UI surface (implemented 2026-07; from the UI instruction sheet §10)

- **Tags are a managed vocabulary:** `color` (the 4 annotation colours) + `style`
  (`sticker|banner|flyout|tape|reel`) columns (migration 0005), full CRUD with per-user ownership
  and case-insensitive name dedupe (trim, 64-rune cap — unchanged rules). `setTags`/imports still
  auto-create names with the defaults (yellow/sticker). **No auto-GC anymore:** a tag that drops to
  zero usage keeps its colour/style until `DELETE /tags/{id}` (join rows cascade). `GET /tags`
  returns objects with usage counts; list filters (`tag=`) still take the name.
- **Preferences:** `users.preferences` JSON blob; `GET /auth/me` returns it with defaults applied
  (theme `system`, accent `terracotta`, aesthetic per theme: dark→film else paper); `PUT` validates
  all three enums. The 0.3.x `home` start-page key is retired (the Home screen replaced the
  landing-tab choice); stale stored keys and old clients still sending one are silently ignored.
- **Stats:** `GET /stats` — user-scoped library counts, superlatives (most-annotated book,
  most-quoted movie, busiest month), a 12-month activity series, a highlight-colour breakdown,
  top authors/actors/directors + top tags, and "collecting since". Fixed set of aggregate queries.
- **Settings table** (`key`/`value`, migration 0005) holds optional metadata keys. TMDB key
  resolution per request: `TIPPANI_TMDB_API_KEY` env > settings `tmdb_key` > built-in
  `defaultTMDBKey` const > none (503). Google Books key (settings `google_books_key`) is appended
  to the volumes query when set. `GET /metadata/status` also reports the most recent
  `POST /books/lookup` outcome (in-memory; `ok:null` = never tried) so the UI can chip
  `LOOKUP FAILING`.
- **MediaCover:** the cover store moved from `data/covers/` to `data/MediaCover/` (§6).

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
| v3 sticker flow | **Client-side only → zero NAS cost.** pretext measures each quote once and reflows with pure arithmetic (no DOM reflow), runs only on annotation detail views, is lazy-loaded (~17 KB gzip), and falls back to plain text under `prefers-reduced-motion`. Seeding a new user's starter tags is a handful of one-time `INSERT`s |

---

## 9. Phasing

| Phase | Scope | Uncertainty |
| :--- | :--- | :--- |
| **1 — MVP (everything)** | Schema + FTS5 + triggers, auth/multi-user/CSRF, manual + MD + Bookcision import, Google + OL metadata + genres, movies + dialogues + TMDB, local covers/posters, colours/tags, unified search, React UI (dark/light) | Low |
| **Deferred** | Kindle `My Clippings.txt` importer (§5c); semantic search (`sqlite-vec`); shared/household libraries | Optional |

**Build order:** schema + migrations → auth/sessions/CSRF (first, not last) → annotation CRUD + search + escaping → MD importer → Bookcision importer (test on your real export) → metadata + covers → movies/dialogues + TMDB → UI → systemd/Docker + backup docs.

---

## 10. Libraries

| Go dep | For | Note |
| :--- | :--- | :--- |
| `modernc.org/sqlite` | DB + FTS5 | pure Go, FTS5 default |
| `gopkg.in/yaml.v3` | MD frontmatter | fixed format — hand-roll it to reach 3 deps if desired |
| `golang.org/x/crypto` | bcrypt | quasi-stdlib |
| `golang.org/x/time` | login rate limit | quasi-stdlib |

Everything else is stdlib: routing (Go 1.22+ method+wildcard patterns), CSRF (Go 1.25 `http.CrossOriginProtection`), multipart, `crypto/sha256`, plain-HTTP JSON clients, `embed`. **Go direct deps: 4.**
Frontend runtime deps: `react`, `react-dom`, and **`@chenglou/pretext`** (**3**). pretext
is the v3 sticker text-flow engine (measures a quote and lays it out line-by-line around
the round sticker); it is **code-split and lazy-loaded** (~17 KB gzip, fetched only the
first time a flowed quote renders), so the main bundle is effectively unchanged. `vite` +
`tailwindcss` dev-only. No react-query/Redux/component kits — `fetch` + `useState` suffices.

---

## 11. Assumptions & Confidence

| Claim | Confidence |
| :--- | :--- |
| **Per-user isolated libraries** (no sharing) is the desired multi-user model | **Assumed — confirm.** Shared-library model would change §3 materially |
| Go 1.25+ toolchain available at build time (CSRF dep) | High |
| FTS5 search ≤ ~5 ms at 5k books / 250k annotations on weak ARM | High (design inference; validate against a generated fixture) |
| `modernc.org/sqlite` ships FTS5 with no build tag; `CGO_ENABLED=0` static builds | High (verified) |
| Clippings gotchas — locale line, `==========`, BOM, clipping-limit sentinel | High (verified; importer deferred, §5c) |
| Bookcision shape incl. `location:{url,value}` | **Verified against a real export** (2026-07-04): `authors` is a string, `note` can be JSON `null`; parser still accepts the array variant defensively |
| Google ~1,000/day; OL 1→3 req/s with UA, covers 100/5 min | High (official docs) |
| TMDB: free API key required; `append_to_response=credits` gives details+cast+crew in one call | High (official docs) |

---

## 12. Open Items (needed from you, none blocking start)

1. ~~One real Bookcision export — lock the `authors` field type in the §5d parser.~~ **Resolved 2026-07-04:** real export received (string `authors`, nullable `note`); it lives at `internal/importer/testdata/bookcision_real.json`.
2. **One `My Clippings.txt` sample in your Kindle's UI language** — only needed if/when the deferred §5c importer is picked up.
3. **Confirm the per-user-isolated library assumption** (§2/§11).
