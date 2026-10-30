# Android app (roadmap §20, issues #37 and #61)

Source of truth: this wiki page.

Not built. Rewritten against `3674689` (main, 30 October 2026), replacing the 25 October page (`558059cf`). Each code
claim is `path:line` and the text found there, checked with grep at `3674689`. Claims marked *inferred* were reasoned
from code nearby and not read at the line. Claims about Lexodle and Fluenough are about other repositories and were not
checked in this pass.

## The owner's brief

- A Flutter app for Android in `mobile/`, themed by Material You only: dynamic colour from the wallpaper, and light or
  dark from the system. The web app's material sets, faces and type dials are not used.
- Every web feature is in the app. Screens follow the web app's structure but use Material 3 conventions: navigation
  bar and rail, bottom sheets, FABs, share targets and the camera.
- The end goal is a **fully autonomous app** with its own database, search, review scheduling, import, export and
  metadata lookups. The server adds only sync, a central backup, context search over source files, and locator
  determination.
- **The first build has every screen.** A feature that does not work yet is marked *Upcoming* in the app. The first
  build depends on the server: a sync caches the data so the app can **read offline**, and **writes go straight to the
  server** and only while it is reachable. Autonomy comes in later phases.

**Flagged, not guessed:** does "mark as upcoming" cover every feature that does not work yet, or only the
server-provided ones? This plan assumes **every feature that does not work yet**, so a first build can ship with any
unfinished screen marked Upcoming. This is Owner question 1.

## Phases

| Phase | What works | Exit criteria |
|---|---|---|
| **P1 — server-backed** | Pairing, snapshot sync, offline reading, online writes through the existing routes. Releases `app-v0.x`: the first build marks most features Upcoming, and later P1 releases switch them on. | Every row in the inventory below is **Live** or **Server**, against a real server, in journeys; no row is Upcoming. |
| **P2 — autonomous** | A local-first database: offline writes with an outbox, local search, local review scheduling, local import, export and metadata, delta sync and a central backup. Releases `app-v1.x`. | With the server switched off, every P2 row works. A Go and Dart parity suite passes. Two phones and the web converge after offline edits. |
| **Server** | Context search over source files, locator proposals, corrections, the library scan, jobs, admin and server update. | Always server-provided. Offline, the app shows them as *Needs the server*, which is different from Upcoming. |

**The first thing to build (the P1 vertical slice):** pair by code, run `GET /api/sync/snapshot` into the local
database, then Library, a work page and a quote card read from that database. Editing a quote online goes through `PUT`
and a resync. Offline, edit is disabled with the reason shown. One feature (Import) is marked Upcoming through the flag.
Each step has a journey against a real server.

**Out of scope:** iOS (ADR-0014); the Play Store; material sets, textures, type dials, saved themes, tile slots and
uploaded fonts; server-side OCR (ADR-0012); a built-in reader or book files on the phone (ADR-0010); a web-view bridge
to the web app; anything social (ADR-0011).

## Tasks

### 0. Before starting

- [ ] Re-verify every citation below against HEAD and correct what moved. Use `git diff --stat 3674689..HEAD -- internal/httpapi web/frontend/src internal/store`.
- [ ] Get the owner's answers to questions 1 to 4 below. Questions 1 to 3 are needed before P1; question 4 is needed before P2.
- [ ] ADR: the app's stack, sync model and id model (Decisions D1 to D6), numbered after ADR-0918.

### 1. Feature inventory (one row per web feature)

The P1 column is the first build: **Live** works through the server; **Upcoming** shows the screen with the feature
marked; **Server** stays server-provided. The P2 column says what P2 does: **Local** reimplements the feature in Dart,
and **Server** keeps it on the server. The screens come from `ROUTE_TABS` (`web/frontend/src/routes.js:44`), the drawer
(`routes.js:93` `export const DRAWER_TABS = [`), the Settings sections (`web/frontend/src/Settings.jsx:215`
`export const SETTINGS_SECTIONS = [`), the Metadata sections (`web/frontend/src/MetadataPage.jsx:92`
`const METADATA_SECTIONS = [`), the six Checks pages (`web/frontend/src/ChecksPage.jsx:26-31`), the Add modes
(`web/frontend/src/addModes.js:31` `['work', 'board', 'anthology', 'quote', 'import']`), and the quote and bulk actions
(`web/frontend/src/actions.jsx:98` `export function actionsFor`, `:459` `export function bulkActionsFor`).

**Library, catalogue and Quotes boards**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Library shelf: filter, sort, group, shelf states, wishlist | Library destination | Live | Local |
| Catalogue: films, shows, games | Catalogue destination | Live | Local |
| Quotes: the boards and All quotes, each board's own page | Quotes destination | Live | Local |
| Board create, rename, hide, cover, delete-with-destination | Board bottom sheet | Live | Local |
| Proverb starters (`GET/POST /quotes/starters`) | Empty board | Upcoming | Local (data bundled) |
| Section hide and order (`routes.js:169` `export function visibleSections`) | Settings › Sections; navigation | Live | Local |
| Home: daily deck, practice, favourites, shuffle, on this day, counts | Home destination | Live | Local |
| Long-press selection and the bulk bar | Contextual top app bar | Upcoming | Local |
| Set fields (bulk field editor), find and replace | Full-screen dialog | Upcoming | Local |

**Work pages and details**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Work page: cover, details, credits, links, status, read history | Work screen | Live | Local |
| Edit a work | Full-screen dialog | Live | Local |
| Cover or poster: upload, framing (`FrameEditor.jsx`) | Camera or gallery, then crop | Upcoming | Local |
| Cast, characters, who's in it | Work › Cast tab | Live (read) / Upcoming (edit) | Local |
| Cast from IMDb or TheTVDB, cast art | Work › Cast menu | Upcoming | Local (needs keys, Q4) |
| Episodes: names and orders | Work › Episodes | Upcoming | Local |
| Chapters a book's highlights already name (`GET /books/{id}/chapters`) | Quote form | Live | Local |
| Export one work as Markdown (`GET /books/{id}/export`) | Work menu → share sheet | Upcoming | Local |

**Quote cards and their actions** (`actionsFor`)

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Copy | Card menu → clipboard | Live | Local |
| Share as text, Markdown, WhatsApp, Reddit (`share.jsx:1134` `export function ShareDialog`) | Android share sheet | Live | Local |
| Share as image (drawn on a canvas in the browser, `quoteImage.js:6`) | Rendered widget → share sheet | Upcoming | Local |
| Edit (all three quote kinds) | Full-screen dialog | Live | Local |
| Colour category, favourite, sticker, tags | Card menu and bottom sheet | Live | Local |
| Read aloud (`speak.jsx:12` `export function SpeakButton`) | Card action through Android TTS | Live | Local |
| In context (`GET /quotes/{kind}/{id}/context`, `server.go:672`) | Bottom sheet | Live | Server, cached |
| Review this, practise this, exclude from review | Card menu | Live | Local |
| Add to board or anthology, duplicate, delete with undo from the bin | Card menu and snackbar | Live | Local |
| Signature on the card | Card | Live (read) | Local |

**Capture and add**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Add a work by lookup (`POST /books/lookup`, `/movies/lookup`) | FAB → Add sheet | Live | Local (Q4) |
| Add a quote, board, anthology | FAB → Add sheet | Live | Local |
| Capture a page by camera with on-device OCR (section 8) | FAB long-press → camera | Upcoming | Local |
| Share target: text shared from another app becomes a quote | Android share target → Add quote | Live | Local |

**Import and export**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Import, 8 formats plus auto-detect (`server.go:686` `"POST /import/auto"`) | Add › Import, system file picker | Upcoming | Local |
| Pending imports: approve, discard, bulk (`/import/staged`) | Checks › Imports | Upcoming | Local |
| Export all, a selection, quotes (`GET /export`, `POST /export/*`) | Settings › Data → share sheet | Upcoming | Local |
| Anthology as Markdown or EPUB | Anthology menu | Upcoming | Local |

**Search**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Search with scopes, facets, vocabulary, fuzzy correction (`search_handler.go:1078`) | Search bar in the top app bar | Live (online only) | Local (FTS5) |

**Review, quiz and practise**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Daily deck: source, quote, flip, cloze, speaker cards (`GET /review/daily`, `POST /review/answer`) | Home → full-screen review | Live (answer online) | Local |
| Practice and themed rounds, practice score and reset | Home → practice | Live | Local |
| A card's recall history and half-life popup | Bottom sheet | Live | Local |
| Review tuning: `srDaily`, ladder, tier and so on (Settings › Review) | Settings › Review | Live | Local |

**Anthologies**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| List, page, entry notes, reorder by drag, fill | Anthologies destination (when switched on) | Live (read, notes) / Upcoming (reorder, fill) | Local |

**Metadata consoles** (Metadata sections)

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Works console: duplicates, merge, metadata fill, re-verify review | Metadata › Works | Upcoming | Local (Q4) |
| People: records, merge, split, portraits, aliases, signatures | Metadata › People | Upcoming | Local |
| Characters: merge, split, images, works | Metadata › Characters | Upcoming | Local |
| Languages table | Metadata › Languages | Upcoming | Local |
| Categories: colours, tags, stickers | Metadata › Categories | Upcoming | Local |
| Sources: providers and keys (admin) | Metadata › Sources | Upcoming | Server (admin) |
| Source files: attach, scan, prune, rescan | Metadata › Files | Upcoming | Server |

**Checks and cleanup** (`ChecksPage.jsx:26-31`)

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Stray marks (cleanup): accept, ignore | Checks › Cleanup | Upcoming | Local |
| Found files, attached files | Checks › Files | Upcoming | Server |
| Locator proposals | Checks › Locators | Upcoming | Server |
| Corrections | Checks › Corrections | Upcoming | Server |

**Settings, profile, accounts and pairing**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Interface language: en, bn | Settings › Language | Live | Local |
| Read languages, text order, language marks | Settings › Language | Live | Local |
| Theme section (material sets, type, fonts) | none: Material You only | Not in app | Not in app |
| Profile: name, avatar, password, switch account | Profile | Live | Server |
| Sign-in links (OIDC), widget key, Pushover notifications (`connections.jsx`) | Profile › Connections | Upcoming | Server |
| Paired devices: list, revoke, revoke all | Settings › Devices | Live | Server |
| Admin: users, metadata keys, backup and restore, logs, server update, reset | Settings › Server (admin) | Upcoming | Server |
| Jobs: queue, stop, rerun, log | Settings › Jobs | Live | Server (local jobs in P2) |
| Changelog of the server (`GET /changelog`) | About | Live | Server |

**Stats, bin, episodes and widget**

| Web feature | App screen | P1 | P2 |
|---|---|---|---|
| Stats (`GET /stats`) | Stats (drawer) | Live | Local |
| Bin: list, restore, delete, empty (`/trash`) | Bin (drawer) | Live | Local |
| Dashboard widget numbers (`server.go:249` `"GET /widget"`) | Android home-screen widget | Upcoming | Local |

**App-only (no web equivalent)**

| Feature | App screen | P1 | P2 |
|---|---|---|---|
| Sync now, last synced, cache size | Settings › This phone | Live | Local |
| Update check and install (section 8) | Settings › About | Live | Local |
| Donation (section 8) | Settings › About | Live | Local |
| Report a bug (section 8) | Settings › About | Upcoming | Local |

- [ ] Agree the P1 column with the owner (Q2), then make it the registry's initial state (task 2.6).
- [ ] When the web ships a feature, add a row here, and an Upcoming flag to the app in the same PR.

### 2. Architecture (P1)

- [ ] 2.1 Scaffold `mobile/` with Flutter stable, `android/` committed, and package id per Q8.
- [ ] 2.2 State: **Riverpod** (`flutter_riverpod`). See D1.
- [ ] 2.3 Routing: **go_router** with paths matching the web's (`routes.js:321` `export function statePath`): `/books/:id`, `/catalogue/:id`, `/quotes/:id`, `/anthologies/:id`, `/settings/:section`, `/metadata/:section`.
- [ ] 2.4 Shell: `NavigationBar` on a phone and `NavigationRail` from 600dp. Destinations are Home, Library, Catalogue, Quotes and, when switched on, Anthologies, filtered by `visibleSections`. A modal drawer holds Metadata, Stats, Checks, Bin, Settings and Profile. Search is a `SearchAnchor` in the top app bar.
- [ ] 2.5 Theme: `dynamic_color` builds a `ColorScheme`, with a seed fallback below Android 12. `ThemeMode.system`. No other theme settings.
- [ ] 2.6 Feature registry `lib/features/registry.dart`: one entry per inventory row, holding `state` (live or upcoming), an optional `serverFeature` string, and `writes` (true or false).
- [ ] 2.7 `Gate(feature)` widget. Upcoming draws the control disabled with an "Upcoming" badge, and a tap opens a bottom sheet saying it is coming. Switching a feature on is a one-line change to its `state`.
- [ ] 2.8 Draw *Needs a newer server* (feature missing from `/capabilities`) and *Needs the server* (offline, Server row) differently from Upcoming.
- [ ] 2.9 API client (`dio`): base URL plus `/api` (`internal/httpapi/server.go:765` `root.Handle("/api/", s.admitDB(http.StripPrefix("/api", mux)))`), `Authorization: Bearer`, and gzip.
- [ ] 2.10 Handshake: `GET /api/capabilities`. The wire field is **`api_revision`** (`capabilities_handler.go:207`), not `apiRevision`. Compare `min_client_revision` (`:202`) and `features`.
- [ ] 2.11 Pairing: enter a server URL and a code, or scan a QR (task 3.1), then `POST /api/auth/devices/claim`. Store the token in `flutter_secure_storage`.
- [ ] 2.12 Local database: **drift** over the bundled `sqlite3_flutter_libs`, so FTS5 is available for P2. See D3.
- [ ] 2.13 Mirror tables use the server's names and columns plus `local_id`, `server_id`, `extra` (JSON for unknown columns) and `synced_at`. Foreign keys point at `local_id`.
- [ ] 2.14 Ingest: apply a snapshot in one transaction. Map foreign keys through `server_id` using the snapshot's declared key list (task 3.2).
- [ ] 2.15 Derived-read cache: store the last answer of `/stats`, `/review/daily`, `/changelog` and context reads with an "as of" time, and show that time offline.
- [ ] 2.16 Repositories read only the local database. Screens never read the network directly.
- [ ] 2.17 Connectivity: online means the last API call succeeded or a probe of `/api/capabilities` answered. `connectivity_plus` only starts a probe.
- [ ] 2.18 Write gate: every write control is a `Gate` with `writes: true`. Offline it is disabled, with a snackbar saying why.
- [ ] 2.19 A write sends the full state: the stored row's server JSON, including `extra`, merged with the edit (D5). Then resync the affected rows.
- [ ] 2.20 Offline banner in the top app bar: "Offline · as of <time>".
- [ ] 2.21 Covers and portraits: `GET /api/covers/{file}` (`server.go:701`) with the bearer token, kept on disk for offline use. Settings › This phone shows the cache size.
- [ ] 2.22 Strings: generate Dart lookups from `internal/i18n/en.txt` and `bn.txt` (`key = value`), with a test that the two files have the same keys.
- [ ] 2.23 Share target and capture intents in the manifest. A long-press on the launcher icon opens Capture.

### 3. Server work

- [ ] 3.1 Pairing QR. Bring back `DevicesCard`, which is not shown today (`Settings.jsx:194` `SETTINGS_CARDS` does not list it, and `:3839` says "The code is shown as text rather than a QR"). Draw a QR encoding `tippani://pair?server=<origin>&code=<code>`. Files: `web/frontend/src/Settings.jsx`.
- [ ] 3.2 `GET /sync/snapshot`: every row the reader owns, gzipped JSON, with columns read from `PRAGMA table_info` as the bin does (`0031_trash.sql:10`). It declares tables, foreign keys and polymorphic keys in one Go list, and carries `schema_version`. New file: `internal/httpapi/sync_handlers.go`, registered in `server.go`.
- [ ] 3.3 Test: every table with `user_id` is either in the snapshot list or excused by name.
- [ ] 3.4 Put an `ETag` on the snapshot so an unchanged library answers `304`.
- [ ] 3.5 Add `"sync-snapshot"` to `apiFeatures` and bump `apiRevision` to 9 (`capabilities_handler.go:106`).
- [ ] 3.6 P2: a change log, `sync_log(seq, user_id, tbl, row_id, op)`, written by AFTER triggers that only INSERT into it. Test that `PRAGMA integrity_check` still passes after writes to FTS-backed tables (ADR-0046). New migration.
- [ ] 3.7 P2: `GET /sync/changes?since=<seq>` returns the changed rows and deletes. Answer `410` when `since` is older than the log keeps, so the app falls back to a snapshot.
- [ ] 3.8 P2: an optional `client_uid` on create for the five binnable kinds, echoed on the row, so a retried offline create is idempotent beyond the dedupe hash.
- [ ] 3.9 P2 central backup: the sync copy on the server is the backup. Add a per-user archive (`GET /sync/archive`) that restores into a new phone. Today's backup is admin-only and covers the whole server (`server.go:296` `"POST /admin/backup", s.requireAdmin`).
- [ ] 3.10 Capture: a nullable photo on a quote, on the existing image pipeline (carried from 25 October).
- [ ] 3.11 Capture: shared text cleanup for OCR and imports (roadmap §7), as an endpoint the app calls in P1.
- [ ] 3.12 Release channel: create app releases with `make_latest: false` (risk R5).

### 4. The path to autonomy (P2 ports, each checked against the Go)

- [ ] 4.1 Dedupe hashes: `internal/store/hash.go:29` `func DedupeHash`, `:93` `DialogueDedupeHash`, `:170` `UtteranceDedupeHash`. Golden values are in `hash_wire_test.go:5`.
- [ ] 4.2 FTS: the same tables with `tokenize='unicode61 remove_diacritics 2'` (`0072_drop_transliteration.sql:86-89`), and a port of `internal/search/fts.go:14` `func Query` and `:31` `func PrefixQuery`.
- [ ] 4.3 Search ranking, facets and fuzzy correction: `internal/httpapi/search_handler.go`, `search_facets.go`, `internal/search/correct.go`.
- [ ] 4.4 Review scheduler. It is a half-life ladder, **not FSRS**: `review_handlers.go:284` `var reviewLadder`, `:242` `func nextStability`, `:715` `func recallStatus`, `:97` grace week. Plus `review_tuning.go`, `review_tier.go` and `review_questions.go`.
- [ ] 4.5 Cloze grading (the server grades today, `capabilities_handler.go:77`): `internal/httpapi/cloze.go`.
- [ ] 4.6 Review sync merges answers, not states. `item_recalls` is an append-only log (`0064_recall_log.sql:17` "SO: A LOG, APPEND-ONLY"). Replay the merged log to rebuild `item_reviews`.
- [ ] 4.7 Import parsers: `internal/importer/` (detection at `detect.go:57` `func Detect`), plus staging (`internal/httpapi/import_staging.go`).
- [ ] 4.8 Export: Markdown (`internal/httpapi/export_handlers.go`, `export_quotes.go`) and anthology EPUB (`export_anthology_epub.go`).
- [ ] 4.9 Markdown round trip: `internal/importer/markdown.go`, `movie_markdown.go`, `quote_markdown.go`.
- [ ] 4.10 Metadata providers: `internal/metadata/` (TMDB, TheTVDB, IGDB, Google Books, Open Library, Amazon, Wikidata), according to Q4.
- [ ] 4.11 Cast and characters: `internal/httpapi/cast.go`, `cast_from_quotes.go`, `quote_speaker.go`, `speaker.go`, `internal/store/cast.go`, `quote_cast.go`.
- [ ] 4.12 People identity, merge and near-duplicates: `internal/store/identity.go`, `internal/httpapi/identity_handlers.go`, `web/frontend/src/nearDupes.js`.
- [ ] 4.13 The bin: `internal/httpapi/trash.go`, keeping the same one-entry-per-action payload.
- [ ] 4.14 Stray-mark cleanup: `internal/httpapi/cleanup.go`, `cleanup_fix.go`.
- [ ] 4.15 Stats and serendipity: `stats_handlers.go`, `serendipity_handlers.go`.
- [ ] 4.16 Offline writes: an outbox of the same REST calls P1 makes (D4), replayed in order. Temporary local ids are mapped to `server_id` when the server answers.
- [ ] 4.17 Conflicts: last writer wins per row, and the losing version goes to the local bin (D6, Q5).
- [ ] 4.18 Parity suite: move the Go test tables listed in 5.6 into JSON goldens under `internal/testdata/parity/`, read by both `go test` and `flutter test`.

### 5. Testing

- [ ] 5.1 Journeys: `mobile/integration_test/` on an Android emulator, against a real Go server built from the same commit, on a fresh data directory.
- [ ] 5.2 Dart harness `mobile/integration_test/harness/screen.dart` with the web's vocabulary: `see`, `gone`, `press`, `type`, `choose`, `hold`. Finders use visible text and semantics labels only, never a widget type or a key.
- [ ] 5.3 Setup may use the API (signing in, seeding). The journey may not. A file that does this names its setup routes in its header.
- [ ] 5.4 Mutation-verify every journey: delete its decisive action, watch it fail, and name the mutation in the commit.
- [ ] 5.5 Journeys for the slice: pair, sync, read offline, edit online, edit refused offline, an Upcoming control opening its sheet.
- [ ] 5.6 Unit tests only where the function is the unit: dedupe hash, FTS query escaping, `nextStability` and `recallStatus`, `noted_at` parsing (`capture_fields.go:8`), cloze tokens, snapshot ingest and key mapping, outbox replay, version compare, i18n parse, OCR header and footer heuristics.
- [ ] 5.7 Parity goldens taken from `hash_wire_test.go`, `internal/search/fts_test.go`, `review_adaptive_test.go`, `review_test.go`, `cloze_test.go`, `capture_fields_test.go`, `internal/importer/testdata/*_synth.*` and `markdown_frontmatter.md`, and `internal/i18n/testdata/agree.*`.
- [ ] 5.8 Registry test: the registry is the unit here, so it is a declared exception. Every inventory row has one entry, and no entry is left without a state.
- [ ] 5.9 Snapshot contract: a Go test in `internal/httpapi` for the snapshot's shape and per-user isolation (another reader's rows never appear).

### 6. Release and CI

- [ ] 6.1 `.github/workflows/mobile.yml` on PRs and pushes touching `mobile/` or `internal/httpapi/`: `flutter pub get`, `dart format --set-exit-if-changed`, `flutter analyze`, `flutter test`, a debug build, and journeys on an emulator (`reactivecircus/android-emulator-runner`).
- [ ] 6.2 `.github/workflows/app-release.yml` on `app-v*` tags. The server's release starts on `tags: ["v*"]` (`release.yml:25`); *inferred:* GitHub matches that glob from the start of the tag name, so `app-v…` does not start it.
- [ ] 6.3 Signing as Lexodle does it: secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`, with a new keystore. Check the APK's certificate against the keystore. **Fail if any secret is missing.** Remove the signing material at the end of the job.
- [ ] 6.4 The tag is the version and the run number is the build number. Fail if the tag and `pubspec.yaml` disagree.
- [ ] 6.5 Attach `tippani-app-vX.Y.Z.apk` and its SHA-256, with `make_latest: false` and notes from `mobile/CHANGELOG.md`.
- [ ] 6.6 `mobile/CHANGELOG.md` for the app's own versions. The root `CHANGELOG.md` takes only the server entries the app needs (3.x).
- [ ] 6.7 `docs/wiki/Developing.md`: `mobile/` in "Where things live", both workflows under `.github/`, and the CI table. Then run `node scripts/doc-map-check.mjs`.
- [ ] 6.8 `docs/wiki/Testing.md`: the app's journey tier and how to run it.
- [ ] 6.9 A user page for the app (install, pair, offline), linked from Home.
- [ ] 6.10 When P1 ships, fold this page into an ADR and cut the page down to P2.

### 7. Carried from the 25 October plan

- [ ] 7.1 Capture: `camera` or `image_picker`, crop, ML Kit OCR (`google_mlkit_text_recognition`), lines selected on the photo, and page and chapter proposed from the top and bottom 8% of the page. Every proposal is shown as proposed and never saved without the reader confirming it.
- [ ] 7.2 Update: list releases, take the newest `app-v*` (not `/latest`), download with `ota_update`, check the SHA-256, and hand over to Android's installer. Checking automatically is off by default. Port from Lexodle `lib/update_check.dart` and Fluenough `lib/core/updates/github_release_check.dart`.
- [ ] 7.3 Donation: port Lexodle `lib/donate.dart` and the UPI QR (`das.arani@pingpay`, Arani Das, INR, no amount), with the draft text: "If you want to support development, or just want to buy me a cup of tea, donate." and "Tippani is free and has no ads. Donating is voluntary, buys nothing and is not refundable. Reporting a bug helps just as much."
- [ ] 7.4 Bug report: a form that opens the reader's own mail app addressed to `tippanidev@gmail.com`. `.github/workflows/app-feedback-mail.yml` and `scripts/mail_to_issues.py` (with Python tests) turn the mail into issues. Owner: 2-step verification, IMAP, an app password, and the secrets `FEEDBACK_GMAIL_ADDRESS` and `FEEDBACK_GMAIL_APP_PASSWORD`.

## Owner questions, ranked

1. **Upcoming scope.** Should "mark as upcoming" cover every feature that does not work yet (planned), or only the server-provided ones?
2. **The first build's Live set.** The inventory marks reading, everyday quote work, review, online search, the bin and stats as Live, and the maintenance consoles, import, export and capture as Upcoming. Is that the right split?
3. **Capture while offline in P1.** The 25 October plan queued offline captures. The brief allows writes only while online. Is capture the one exception, or does it wait for P2?
4. **Metadata in P2.** Does each reader enter their own TMDB, TheTVDB and IGDB keys on the phone, does the server hand its keys to paired devices (a secret leaving the server), or do lookups stay server-provided?
5. **No server at all.** Can the P2 app be used without ever pairing? The planned id model (D3) allows it.
6. **Conflicts.** Last writer wins per row, with the losing version kept in the bin (D6). Confirm.
7. **Plain `http://` on a home network.** Android blocks cleartext by default. Allow it for a server URL the reader types?
8. Package id `io.github.aaronified.tippani`, a new keystore, the minimum Android version, the donation wording, and the licence (still open from 25 October).
9. A daily review reminder as a notification on the phone. That is a timer on the phone, not on the server (ADR-0003).

## Risks, ranked

1. **Scope and drift.** About 296 route registrations (`grep -c` over `internal/httpapi`) and a web app that keeps shipping. The inventory rule in section 1 is the only guard until a scanner exists.
2. **Full-state PUTs clear fields an old client does not know** (`capabilities_handler.go:99-102`, "CLEARS one somebody typed"). D5 (`extra`) is the guard.
3. **Two implementations diverging**: hash folding (Go `strings.ToLower` against Dart `toLowerCase`), FTS, and the scheduler. The parity goldens (4.18) are the guard.
4. **Sync without tombstones.** ADR-0049's reason was "there is no external sync partner", and the app is one. 3.6 adds to that ADR without reversing it. Triggers next to FTS failed once (ADR-0046).
5. **App releases on the server's repository.** The server's updater asks for `/releases/latest` (`internal/updater/updater.go:58`), and its pre-release channel reads only `?per_page=30` (`:74`). App releases need `make_latest: false`, and frequent app releases can push server releases out of that window. *Inferred:* `parseSemver` (`:133`) rejects `app-v…`, because `app` is not a number.
6. **Pairing reachability.** The binary binds 127.0.0.1 (ADR-0031), so a phone needs the Docker image or a reverse proxy.
7. **Snapshot size** on a large library, especially stored context text. Measure it on the owner's archive before choosing between delta-first and snapshot-first.
8. **Emulator journeys in CI** are slow and can be flaky. Keep the set small and make each journey decisive.

## Decisions (proposed; each becomes an ADR when built)

- **D1 Riverpod.** Providers can be overridden in tests, so a journey runs the real app against a real server without a service locator. Async caching fits a database-first UI. Bloc was considered: more ceremony for the same result.
- **D2 go_router.** The web's URLs become the app's deep links, so a link copied from the web opens the same screen.
- **D3 drift, with `local_id` and `server_id` from day one.** P1 fills both. P2 creates rows with only `local_id`, so the same schema works with no server, and nothing is renumbered when a phone pairs later.
- **D4 The outbox replays the existing REST calls.** It is not a new push endpoint. Every server-side validation is reused, and the existing `409` with the existing row (`server.go:1333` `func writeConflictExisting`) and `noted_at` (`capture_fields.go:8`) already make a retry safe.
- **D5 Unknown columns travel in `extra`** and go back on every full-state PUT. This is what the revision 8 warning asks of a client.
- **D6 The snapshot for P1, then a change log for P2.** Most tables have no `updated_at`, and books and movies gained it only for a mirror (`0020_device_tokens.sql:26`; `0022_updated_at_backfill.sql:9` "The column was worse than absent"). A snapshot is correct without trusting it.

## Notes for the ADRs

- **Corrections to the 25 October page.** It said "Settings shows a QR code". Settings shows neither a QR nor the card: `DevicesCard` is exported but not rendered (`Settings.jsx:3844`; `:194` does not list it). It also called the handshake field `apiRevision`; on the wire it is `api_revision`. The brief's "FSRS" is a half-life ladder.
- **What exists and holds** (verified): pairing codes last five minutes (`pairing_handlers.go:31` `pairingTTL = 5 * time.Minute`); claims are rate limited and answer with a token (`:179`, `:222`); bearer requests skip CSRF (`server.go:794` `func exceptBearer`); list paging (`paging.go:27`); `noted_at` and `source` on create (`capture_fields.go:8`); and a `409` carrying the existing row (`server.go:1333`).
- **What does not exist** (verified by a search that found nothing): any `since` or delta read on content lists (the only `since` query parameter is the logs' own, `logs_handlers.go:79`); a photo column on quotes; a per-user backup.

See also: [Plans index](Plans-Index.md) · [Roadmap](Roadmap.md) · [Developing](Developing.md) · [Home](Home.md)
