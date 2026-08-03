# Roadmap

Where Tippani is headed — rough order, not promises. The ethos holds throughout:
a frugal, self-hosted home for your highlights first; everything ambitious is
**optional and off unless you turn it on**, nothing phones home, and it all runs
from one small binary on your own box.

Have a request or a strong opinion on ordering? Open an issue.

## Recently shipped

**v1.2.0 (August 2026)**

- **Import staging — nothing lands until you okay it.** Every import endpoint used
  to parse and write in one shot: by the time the results screen said what had
  happened, the quotes were already in `annotations` / `dialogues`, already
  indexed for search, already in the review deck, and the only undo was
  hand-deleting them. Now a file parses into a holding area and stays there —
  indefinitely, across sessions, books and films mixed together — until it is
  explicitly approved. The 1.1.1 bug where a film's own export re-imported as a
  *book* is exactly the class of mistake this catches before the write.
- **One pending queue, worked in bulk.** Everything staged from every file, in one
  list grouped by the work each quote will join, with the batch (source +
  filename) as a filter and the same `BulkBar` strip Search and Metadata share.
  Each group heading says where its quotes are going — an existing title or a new
  one — so a wrong guess is visible before it is written. A count on the ＋ Add
  pill and a card on Home mean a half-finished import isn't forgotten.
- **Bulk edits that go beyond the live endpoint.** Tags come *off* as well as on
  (`POST /annotations/bulk` can only union). Colour, favourite, chapter, character,
  actor, timestamp. **Retarget the work, book and film interchangeable** — onto
  another group in the queue or onto a work already in the library, across kinds,
  because that is the repair for a misdetected file; a staged row carries both
  locator sets, so the move never destroys the ones the destination won't use.
  And **location formulae**: add, subtract, multiply, divide, set or reset, which
  is what a Kindle location-to-page division or a PDF page offset actually needs.
  `p.142` minus 5 is `p.137`, a range moves at both ends, timestamps go through
  seconds and come back as `HH:MM:SS`, and `reset` restores every row's
  as-imported value, so a formula applied by mistake is undone rather than lived
  with.
- **Under it.** Migration `0023` adds `import_batches`, `staged_works` and
  `staged_quotes` outside the live tables rather than threading a `pending` flag
  through every existing read. Staged text carries no FTS triggers, so it never
  turns up in search and can't be pulled into a quiz; staged tags are
  denormalized text, so a tag that exists only in an unapproved import never
  joins your vocabulary. Approval converts staged rows back into the importer's
  own intermediate shape and runs the existing persist path, so dedupe, duplicate
  enrichment and the ISBN → ASIN → title/author resolution stay one
  implementation. The seven import endpoints now answer a batch id and a staged
  count; `added` / `skipped` / `enriched` moved to the approve response. New:
  `GET /import/staged`, `POST /import/staged/bulk`, `POST /import/staged/approve`,
  `DELETE /import/staged`. The one-at-a-time post-import review panel is retired —
  the queue supersedes it.

**v1.1.0 (August 2026)**

- **Colour for film and show dialogue** — the last asymmetry between the two
  quote kinds. Dialogues could already be favourited, tagged, stickered and
  reviewed like book highlights; now they carry the same four colours too, with
  the same dots, filter, share tint and Markdown round-trip. Under it, both
  kinds embed one shared shape and differ only in how they point at their
  source (chapter/location for a book, character/actor/timestamp for a film), so
  the next field added to one cannot silently miss the other.
- **Device tokens + pairing (part of §3 below)** — Settings → Devices mints a
  one-shot, rate-limited pairing code that a native client exchanges for a
  long-lived bearer token. Unlike a browser session it never expires and is not
  revoked by a password change; unpairing is its own explicit act. This is the
  API-token groundwork §3 always wanted, arriving first for the mobile app.
- **API groundwork for clients we don't serve ourselves** —
  `GET /api/capabilities` (version handshake), `limit`/`offset` on the four list
  endpoints, stdlib gzip on responses, `noted_at`/`source` accepted on quote
  create so an offline capture keeps its real date, and duplicate-create `409`s
  that carry the existing row so a retried write is idempotent.

**v0.6.8 (July 2026)**

- **Backup & restore (was roadmap §8)** — a dated tar.gz of the whole data
  directory (consistent `VACUUM INTO` snapshot + covers/posters) built and
  kept server-side (newest only), served for download from Settings; restore
  shows that backup's date and swaps the data directory back **in-process**,
  with staged validation, an atomic swap, and one `.pre-restore-<ts>` safety
  generation — no Docker socket, no shelling into the box.
- **People console work counts** — every author/actor row counts its books or
  titles (split credits tallied per person); the count clicks through to
  Search seeded with that name.
- **Phone import picker** — the import wall becomes a searchable format
  dropdown + one detail card with the how-to steps inline, and the top-bar ＋
  opens the same Add surface (book · film · import) as desktop.
- **WebView share fix** — quote-image saving inside PWA wrappers (no Web Share
  API) now round-trips through a one-shot server URL, so the file arrives with
  a real name and intact bytes.
- **Polish** — import cards and tooltips render pixel-sharp (text left rotated
  layers), the user chip sits level with the Add pill, the last two list pages
  remember scroll position, and credit-separator chips show bare symbols.

**v0.6.7 (July 2026)**

- **Force-fetch & re-verify metadata (review before apply)** — re-check a
  selection of books, films/shows and saved people against the live sources,
  targeted by their **pinned identity ids** (never re-guessed by name), with
  every changed field presented stored-vs-fresh for field-by-field approval.
  Nothing is written until confirmed. On desktop it rides the Metadata console
  selections; on phones it's a one-tap pass over every pinned item.
- **Multi-author separation** — "Gaiman & Pratchett" now surfaces as two
  people (group-by headings, People console, clickable author links), each
  resolving their own portrait and links; the stored credit string stays
  verbatim, guards keep "Daniels and Sons" whole, and a Settings card picks
  the separators (turn comma off for "Last, First" libraries). Renames are
  component-aware and never touch co-authors.
- **Quick capture, films included** — the ＋ sheet's book dropdown became a
  search picker across books, films and shows (with inline "add as a new
  book"), so a dialogue captures as fast as a book quote.
- **Polish & fixes** — Home favourites get the full ♥ · share · edit · delete
  toolkit; "where you stand" ticks live with every quiz/practice answer;
  session tallies actually count; the phone PNG share saves a real, named
  image; the drawer locks background scroll and closes on swipe; the top nav
  collapses to icons when a smaller window would clip it; Tags/Metadata sit
  permanently in the navbar (the Interface toggle is retired).

**v0.6.3 (July 2026)**

- **Version → changelog + update badge** — the running version links to the GitHub
  changelog in Settings and the mobile drawer (everyone), and once an admin has run
  *Check for updates* a "↑ update to vX" link to the release notes shows in both.
  Still on-demand — Tippani never contacts GitHub on its own.

**v0.6.2 (July 2026)**

- **Favourites span both media** — the Home Favourites section now mixes favourited
  book quotes and film/show dialogues in one newest-first **tile grid** (about four,
  the rest behind *View more*), each tile tagged and opening its source. Also fixes
  favourites reading as empty when you'd only favourited dialogues.
- **"Seeing" reinforcement (opt-in)** — a new **srSeen** knob lets practising (not
  skipping), sharing, or favouriting a quote nudge its half-life up a little, apart
  from Daily Quiz recall; off by default, and appearing in the quiz is not "seeing".
- **Share-image theme picker** — the Image share format restyles the exported card
  across the four skins (Paper/Film × Light/Dark) without touching the app theme.
- **Fixes** — a wrong quiz answer no longer counts as *remembered* (a lapse reads as
  *probably forgotten* until the next correct recall); **Copy** works on plain-HTTP
  self-hosted instances; the manual-update command is now a single
  `docker compose up -d --pull always --force-recreate`.

**v0.6.1 (July 2026)**

- **Multiple-choice Daily Quiz & Practice** — replaced 0.5.0's self-graded "show
  answer" reveal with real MCQs in both directions (*which work is this quote from?*
  / *which quote is from this work?*); a correct pick is Got it, a wrong one Forgot,
  Practice still skippable. Distractors are **plausible, not random** — books by
  same author then shared genre, films/shows by shared genre then shared actor.
- **Fixes** — the "not yet reviewed" status dot was invisible (wrong border colour)
  and now shows on every quote; a wall-clock-flaky timezone test is deterministic;
  the *Daily quiz & practice* settings descriptors collapse into info-dots.

**v0.6.0 (July 2026)**

- **In-app updates** — the build version is stamped into the binary and shown in
  Settings; **Check for updates** compares it against the latest GitHub release **on
  demand** (never automatic). With the Docker socket mounted (opt-in, documented
  security trade-off), **Update & restart now** pulls the new image and recreates the
  container via a one-shot Watchtower (config/volume preserved), then the page reloads
  onto the new version; without the socket it hands over the manual `docker compose
  pull && up -d`. New `GET /admin/update/check`, `POST /admin/update/apply`.

**v0.5.0 (July 2026)**

- **Daily Quiz & Practice** — the spaced-repetition surface is reworked into two
  modes that share one *present → recall → reveal → grade* flow, over **books and
  films/shows** alike. The **Daily Quiz** is the scheduled session (all cards due
  that day, no skipping, every grade folded into the schedule, permanent score +
  streak); **Practice** is unlimited, skippable, on-demand study that by default
  **doesn't move the schedule** (a Settings toggle opts in) and keeps a separate,
  resettable score. Each card is a retrieval prompt in one of two directions —
  *which work is this quote from?* or *recall a quote from this work*.
- **Status dot on every quote** — Library and Catalogue cards now carry a repetition
  dot, 🟢 **remembered** · 🟡 **forgetting** · 🔴 **probably forgotten** (renamed
  from soon/later/someday), derived live from recall probability with the half-life
  on hover.
- **Films & shows join the deck** — the `srReviewScope` preference now governs both
  modes; dialogue lines grade and carry status exactly like book quotes.
- **Under the hood** — polymorphic `item_reviews` (migration `0015_review_rework`)
  replaces `annotation_reviews`, carrying every existing book half-life forward; the
  multiple-choice quiz and its `srQuizLen`/`srQuizScope` prefs are retired in favour
  of honest self-graded recall. New review API: `GET /review/daily` · `/review/practice`
  · `/review/scores`, `POST /review/answer`, `DELETE /review/practice`.

**v0.4.7 (July 2026)**

- **Search recovery that survives un-droppable corruption** — when an FTS index is so
  corrupt that even `DROP TABLE` fails, the repair escalates to a data-preserving
  whole-database rebuild (copy the intact base tables into a fresh file, triggers
  repopulate the indexes; the corrupt pages are never read). Automatic at startup and
  via Profile → *Rebuild search index*. No data lost. Reproduced + tested end to end.

**v0.4.6 (July 2026)**

- **Database health + self-healing search** — startup runs `PRAGMA quick_check` and
  an FTS integrity-check (alerted on stdout+stderr), and any corrupt full-text index
  is rebuilt automatically from the intact base tables (search data is derived, so no
  loss). An in-place rebuild can't fix page corruption, so the repair drops + recreates
  the index.
- **Profile → Maintenance (admin)** — *Rebuild search index* (non-destructive, fixes
  "search failed / internal error" with no restart or data loss) and *Reset all data*
  (guarded factory reset: deletes the DB file — row deletes are blocked by a corrupt
  index — and restarts at first-run onboarding). New `POST /admin/search/reindex`,
  `POST /admin/reset`.

**v0.4.5 (July 2026)**

- **CSP font fix** — allow `font-src 'self' data:` so the small `@fontsource` subset
  files Vite inlines as `data:` URIs aren't blocked (they were falling back to a
  system face); also unblocks the quote-card image renderer's fonts.

**v0.4.4 (July 2026)**

- **One look-up card** — the Add surface is now *Look up / add* + *Import files*;
  the first is a single card with a **Book · Film · Show** toggle, one search box and
  an optional year, with manual entry moved into a **"Add manually"** popup per kind.
- **Import instructions as tooltips** — each source card's step-by-step "save the
  page" notes fold into the standard info-dot tooltip, so the cards read at a glance
  (and no longer overflow inside the narrow Add modal).
- **Leaner mobile Metadata** — on phones it's a maintenance screen (fetch covers &
  metadata with no replacement · scan duplicates · speaker remap · people
  fetch-missing) with the coverage tiles as plain text lines; the at-scale console
  stays desktop-only. New `missing_only` on `POST /covers/refetch`.
- **Fixes** — search self-heals a drifted FTS5 index (and logs the real cause)
  instead of a bare "search failed" 500; the desktop **⋯ More** menu portals out of
  the clipping top-bar nav so it's no longer hidden behind the page.

**v0.4.3 (July 2026)**

- **One "＋ Add"** — Import is no longer a permanent tab: one Add surface carries
  **book · film · import**, opened by the top-bar **＋ Add**, the drawer's lead
  row, and the Library/Catalogue Add buttons — one obvious way to add anything.
- **Progressive disclosure on cards** — a quote card shows only its favourite ♥
  at rest; **share · edit · delete** reveal on hover (desktop) or fold behind a
  single ⋯ overflow (mobile), so a masonry sheds its standing button rows. The
  **colour quick-pick** rides the same hover gate on desktop; on a phone, where
  there is no hover, its four blobs stand between the ♥ and the ⋯ so recolouring
  a highlight is one tap rather than a trip through the edit form.
- **Compact edit forms** — the book/film cover controls collapse to icon buttons
  with tooltips (upload · fetch metadata · paste URL · search covers · remove),
  and **"Fetch metadata" opens the edition/version picker** to pick the right
  match instead of silently applying a guess.
- **Quote-card images** — render a highlight as a shareable **image** in the
  current paper/film skin, straight from the share sheet, generated locally with
  the same field-picking as the text formats.
- **Profile & account management** — the avatar chip is now Profile · User
  management · Log out (a pop-up on desktop, a full page on phones): edit
  **photo · display name · password**, and (admin) add/remove users +
  **grant / revoke / transfer admin** with the last admin protected.
  New `PUT /auth/me`, `PATCH /admin/users/{id}`.
- **Favourite-only** — the 1–5 star rating is fully retired: removed from the UI,
  the API, and the database (the column is dropped from annotations and dialogues),
  leaving the favourite ♥ as the single keep/love signal.
- **Configurable spaced repetition** — Settings › *Daily review & quiz*: cards/day
  (2–10), quiz length (2–10) + scope (books/films/both), and the half-life
  growth/lapse factors, all per-user (narrow ranges).
- **Configurable nav + quiz colour** — a Settings toggle folds Tags + Metadata into
  a ⋯ More menu; the quiz's correct answer now reads a distinct green, not the
  accent (which clashed with the wrong-answer red).
- **Ops** — GitHub Releases auto-cut from the CHANGELOG on `v*` tags; hi-res cover
  uploads (cap 5→10 MB); book-save failures logged instead of swallowed; both
  metadata progress bars fixed.

**v0.4 line (July 2026)**

- **Automatic portraits, right-person-first** — author and actor photos are
  fetched on demand from your own catalogue: an actor from the film's stored
  cast (identity + headshot captured when the movie was added, so no extra API
  call), an author via Open Library **disambiguated by the books they wrote** so
  a same-name namesake is no longer picked, with a Wikidata photo fallback. The
  resolved identity is pinned so it never re-drifts; the manual photo field still
  overrides.
- **Spaced repetition — a daily review** — a Daily Review card on the Home
  screen resurfaces your own highlights on the **Ebbinghaus forgetting curve**:
  each annotation carries a memory half-life $h$ and its recall probability
  $p = 2^{-t/h}$ ($t$ = days since the last review) decays in SQL at query time,
  so a card comes due right as you'd forget it — no jobs, no cron, nothing
  ticking. Answers move the half-life the **SM-2 / expanding-retrieval** way —
  *Got it* stretches the interval, *Forgot* is a lapse (shortened, not reset),
  *Skip* benches the card for the local day — the active-recall loop the memory
  research keeps confirming. ~2–3 minutes a day, capped at 8 cards, timezone-aware,
  zero configuration; a dot on the logo (and the drawer's Home row) marks a
  pending deck. Paired with a **recall quiz** that builds multiple-choice rounds
  from your own library, where **each correct answer counts as a revision** too.
- **Home screen + drawer shell** — the logo now taps to a Home screen (daily
  review, quick capture, stat tiles, recent favourites) on desktop and mobile;
  on phones a hamburger **drawer** owns primary nav (the bottom tab bar is
  retired) with a slim top bar: ☰ · logo → Home · ＋ quick capture · search ·
  avatar. The old start-page setting is gone — Home is the start page.
- **PWA install** — web app manifest + icons, `viewport-fit=cover` with
  safe-area insets on every bar and sheet, theme-colour meta; add-to-home-screen
  installs a standalone app.

**v0.3.1 and after (July 2026)**

- **Mobile overhaul** — bottom navigation bar, sticky page bars, full-screen
  filter sheets with a Reset · count · Done footer, detail overflow menus,
  44px touch targets, and no horizontal scroll; five tabs fit a 320px phone.
- **People link out** — clicking any author/actor name opens a redirect menu of
  their IMDb · TMDB · TheTVDB · Wikipedia · Open Library pages, auto-resolved
  on first open; a People console under Metadata manages the links for the
  whole library, with bulk fetch.
- **Hi-res covers** — TMDB originals, full-size Amazon scans, hi-res Google
  Books renders; OpenLibrary and TheTVDB art (previously failing silently)
  now fetches correctly.
- **Chunked metadata refetch** — "fetch missing covers & metadata" runs in
  cursor chunks with a real progress bar and survives proxy timeouts.
- **Import in the primary nav**, on desktop and in the mobile bottom bar.

**v0.3.0**

- **Quote sharing** to Rich Markdown · WhatsApp · plain text (Twitter/X) · Reddit, with a live per-format preview.
- **Author & actor metadata** — bio · photo · links, viewed/edited by clicking a name, with portraits in group-by headings.
- **Search overhaul** — open a quote in place (share/edit/delete), remembered last search, group-by, and bulk tag/edit on selected results.
- **Library group-by** — series · author · decade · genre.
- Uploaded **stickers**, a read-only **demo**, real per-view **URLs**, and the tactile **paper/film redesign**.

## Planned

### Next up

The staging work that was queued here shipped in **1.2.0** (see *Recently
shipped*). Nothing is claimed for the next release yet — the numbered backlog
below is in rough order, and the concurrent-write 500 recorded under *Known bugs*
is the strongest candidate: §11's offline client flushes a queue, which *is*
concurrent writes, and the retry path it depends on is the one that fails.

### Known bugs, not yet fixed

Recorded here rather than left in a commit message. Each is reproducible; none
is fixed as of 1.2.0.

- **Concurrent writes can fail with a 500.** Two writes arriving at once race for
  SQLite's WAL write lock, and the loser gets `SQLITE_BUSY` back **immediately**
  rather than waiting — even though `busy_timeout` is 5000 on every connection.
  Eight concurrent `POST /annotations` reliably produces one or two 500s, and it
  reproduces just as readily on `POST /books`, so it is not specific to any one
  handler. Found while stress-testing the duplicate-create path in 1.1.1.

  The cause looks like a design intent that was never implemented: PLAN §8
  specifies a **"single writer connection"**, but `store.Open` sets
  `SetMaxOpenConns(4)` with no serialisation around writes, so four connections
  contend freely. Today a single person clicking in a browser rarely trips it.
  It matters for §11: an offline client flushing a queue *is* concurrent writes,
  and the retry path it depends on is the one that fails.

  The fix is to serialise write transactions behind a mutex, as §8 always
  intended — deliberately not rushed into a patch release, because it has to be
  done without holding the lock across the cover-fetch network calls some write
  handlers make, and every write path needs auditing for it. Until then
  `TestConcurrentDuplicatePostsAllConflict` tolerates the 500 explicitly and
  logs a count, rather than passing quietly.

- **Legacy catalogue exports can still re-import as books.** 1.1.1 made the
  catalogue export always write `type: movie` / `type: show`, which is what routes
  a file back to the right importer. Files exported by **1.1.0 or earlier** were
  not rewritten, so a bare film export from then — no director, no collection, no
  character/actor/timestamp on any line — still carries nothing identifying it.
  Re-export it, or add a `type:` line by hand. Not fixable retroactively; a
  detector cannot infer what the file never recorded.

The numbered items below are the longer backlog, in rough order.

### 1 · AI summaries + notifications (opt-in)
A passive digest: batch your recent highlights, summarise them with an
**OpenAI-compatible** model (local or remote — your endpoint, your key), and
optionally push the result. Grouped by book, tag, or whole library; weekly or
on-demand. Off unless configured, generated async (fire-and-forget, no realtime
calls), and — true to the frugality goal — **no cron dependency** (an in-app
scheduler or an optional systemd timer).

Notifications start with **NTFY**, but we're likely to route through a
multi-service notifier — **[Shoutrrr](https://containrrr.dev/shoutrrr/)** or
similar — so one config reaches any backend (ntfy · Gotify · Telegram · Discord ·
email · …). Non-negotiable, whatever we pick: **high / urgent priority must carry
through** — a resurfaced highlight is a gentle nudge, but "lookup is failing"
should be able to shout. Exact backend still to be decided.

- Config: OpenAI endpoint / key / model, the notifier URL(s), cadence + grouping.
- A "Summaries" page listing recent digests, each linking back to its source.

### 2 · Homepage dashboard widget
A widget for **[Homepage](https://gethomepage.dev)** (and similar self-hosted
dashboards): a small, read-only, token-scoped stats endpoint surfacing today's
**pending spaced-repetition** count, your latest **quiz score**, and
**book / annotation / movie** totals — so Tippani shows up as a live tile on your
NAS dashboard. Opt-in; nothing exposed without a token.

Shipped in three tiers, cheapest first:

1. **Document what already works** — Tippani's unauthenticated `/healthz` means
   any dashboard can ping it today (`siteMonitor` / `ping`), so a "Dashboards"
   docs page with a ready-to-paste `services.yaml` snippet and the optional
   `homepage.*` docker-compose labels costs nothing and lands first.
2. **Custom-API widget** — Homepage's `customapi` widget can render live counts
   with **zero upstream code**, but its requests come from the Homepage *server*
   (no session cookie), so this tier rides on the **per-user API tokens** of §4:
   a slim read-only stats surface accepting `Authorization: Bearer`, plus a
   documented field mapping. This is the real deliverable.
3. **Native first-party widget (later)** — a PR into gethomepage/homepage
   (`src/widgets/tippani/` + tests + translations + docs, one row of ≤4 blocks).
   Gated upstream: the widget must target a feature-request discussion with
   **≥20 up-votes**, and widgets for projects under ~a year old get declined —
   so the discussion gets opened early to accumulate votes, and the PR waits
   for 2027. It consumes the exact endpoint tier 2 already built.

### 3 · Account, continued — sign-in, trash, tokens
The consolidated **Profile** (photo · display name · password) and admin **role
management** (grant / revoke / transfer, last admin protected) shipped — see
Recently shipped. Three strands remain, all local (no email round-trips, no
external identity provider):

- **Stronger sign-in (opt-in)** — **passkeys (WebAuthn)** and **TOTP 2FA** layered
  over today's password + hashed-token sessions, for boxes reachable past the LAN.
  Off unless you turn it on; password stays the fallback.
- **Trash & undo** — soft-delete with a restorable **trash** for books, films,
  quotes and users, so a mis-click (or a cascading user delete) isn't final;
  emptied on demand or after a grace period.
- **Per-user API tokens + webhooks** — *partly shipped in 1.1.0.* Device tokens
  exist now (bearer auth on every `/api` route, minted by QR-less pairing from
  Settings → Devices), which is the hard half. What remains is **scoping** — a
  token that may read stats but not write quotes, for the Homepage widget or an
  Obsidian sync — and outbound **webhooks** on events (new highlight, review
  done). Absorbs the old "API-token auth" line that used to sit under Later.

### 4 · Achievements — quiet milestones, and one gentle streak
A deliberately restrained take. Achievements mostly mark *distance travelled* —
reading and collection milestones drawn from data **already in the library** and
computed at query time, no counters table, no background jobs, no cron, nothing
ticking. **Off by default**, private, nothing social and nothing that phones home;
shown as a modest, dismissible shelf on Home or Profile. Candidate milestones (all
derivable from what's already stored): your first hundred highlights; a whole book
carried through the forgetting curve; ten authors on the shelf; a passage recalled
correctly five times; a series completed; a film quoted from every act.

The **one** place a streak earns its keep is the **spaced-repetition review**, and
even there it's built the forgiving way the review loop already works — mirroring
the SM-2 rule that a lapse is *shortened, never hard-reset*. A review streak counts
days you clear the due deck, but a missed day spends a built-in grace/freeze rather
than zeroing the count, and it is **never** dressed up as a loss ("you broke your
streak!" banners are exactly what we won't do). It's a quiet tally that rewards
turning up, not a chain you're afraid to drop. Streaks stop at the review; nothing
else in the app grows one.

### 5 · Capture from anywhere (share-target + bookmarklet)
Two low-cost ways to get text in without a file:

- **PWA share-target** — Tippani already installs as a PWA, so register it as a
  share target: "Share → Tippani" from any app (a reading app, a browser, your
  phone's own text selection **or its built-in OCR**) drops straight into quick
  capture. This is also how a photographed page gets in — the phone recognises the
  text, you share it (see *Considered and set aside*).
- **Bookmarklet** — one click that POSTs the current page's **raw HTML** to Tippani,
  parsed server-side by reusing the existing Hardcover / Goodreads / IMDb HTML
  importers. Deliberately minimal: just the page, no Bookcision-style JSON layer to
  install or keep working.

### 6 · More import sources
Kobo (`KoboReader.sqlite`), Apple Books, a **Readwise** export, and read-later apps
(Instapaper · Pocket · Matter), all folded into the same idempotent, cross-source
dedupe. Kobo is unverified for now — no device here to test a real
`KoboReader.sqlite` against, so it ships only once someone can confirm it parses
cleanly. The Kindle `My Clippings.txt` importer has shipped; broadening its locale
coverage needs real files from Kindles set to other UI languages.

### 7 · Collections & shelves
Extend tagging **to books** (tags live only on annotations today), then a **shelf**
view that groups either books or annotations by tag — curated, named groupings
("Best of 2026", "to reread") that are really just tags surfaced as first-class
shelves, so there's no new taxonomy to learn.

### 8 · Verbose, structured logs
A failed request should tell you *why* from the Docker logs, not just that it
failed. Plan: consistent structured logging across handlers (method · path ·
user · outcome · **cause**), a `TIPPANI_LOG_LEVEL` knob (quiet by default,
`debug` opt-in), and request ids to correlate a client error with its server
line — without ever leaking internals into the HTTP response. (A first step is
already in: the book-save 500s now log their real cause instead of swallowing
it.)

### 9 · Grimmory sync (self-hosted, direct MariaDB)
A pull source for anyone already running **Grimmory** self-hosted: point Tippani
at that instance's hosted **MariaDB** database and sync straight from its tables
— no export file in the loop. It reads book covers, edition metadata, and
annotations directly from Grimmory's schema and folds them into the same
idempotent, cross-source dedupe as the file importers, so a re-sync never doubles
a passage. Covers come across too, which needs read access to Grimmory's cover
store — so the plan assumes both services sit in the **same `docker-compose`**:
Tippani is handed the Grimmory DB DSN plus the relevant Grimmory config (the media
path / cover location), wired through the environment. Read-only and opt-in
(nothing runs without a configured DSN); a first pass is a one-shot pull, with a
scheduled re-sync as the follow-up. Unverified until tested against a real
Grimmory box.

### 10 · Out in the world — directories & icon CDNs
Getting Tippani discoverable where self-hosters actually browse. No code here —
outreach and asset prep, in dependency order:

- **Icon CDNs first** (dashboards and directories pull art from these):
  - **[dashboardicons.com](https://dashboardicons.com)** (homarr-labs) — open
    submissions via the site's form (instant publish) or a GitHub issue. Needs a
    clean `tippani.svg` in kebab-case; they generate the 512px PNG/WEBP. Our mark
    uses an `feTurbulence` paper-grain filter that some raster pipelines drop, so
    a **flattened submission variant** gets prepared first. The mark is
    full-colour, so light/dark variants are optional (we have both anyway).
  - **[selfh.st/icons](https://selfh.st/icons)** — no external PRs accepted;
    icons are *requested* via the selfhst/icons GitHub **Discussions** and added
    by the maintainers. This is also where the selfh.st/apps directory sources
    its art, so it goes in before / alongside the listing request.
- **[selfh.st/apps](https://selfh.st/apps)** — a one-person curated directory
  (no submission repo): reach out to hello@selfh.st with the repo, one-liner,
  demo link and icon. Being picked up by the *This Week in Self-Hosted*
  newsletter's "New Software" section is the usual front door.
- **[awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)**
  — the biggest list, syndicated by many others, but it **rejects projects
  younger than 4 months**; the repo went public 2026-07-05, so this submission
  waits until ~November 2026.
- **Prerequisite for all of the above**: confirm the GHCR package is publicly
  pullable — a directory listing pointing at a pull-gated image is a bad first
  impression.

### 11 · Android app — capture by camera, with on-device OCR
A native Android client, Flutter so the source stays portable, in `mobile/`.
Not a wrapper around the PWA: the point is the one thing a web page on a phone
cannot do well, which is **photograph a page of a physical book and turn it into
a highlight**. Recognition runs **on the device** (ML Kit), so the server gains
no dependency, no CPU cost and no upload path — the reason server-side OCR was
set aside doesn't apply to it (see *Considered and set aside*).

The work that isn't the OCR call itself — which is thirty lines — is what makes
it worth having: reflowing recognised lines into paragraphs from their bounding
boxes, **de-hyphenating across line breaks**, dropping running heads and page
numbers, normalising the quote marks and ligatures OCR mangles, and then a
correction screen with the photo beside the text. A local mirror keeps browsing
and the Daily Quiz working with no server, and captures queue offline and flush
when the box is reachable.

The server side of this **shipped in 1.1.0** — device tokens and pairing, list
paging, gzip, the capabilities handshake, `noted_at` on create so a queued
capture keeps its real date, and duplicate `409`s that make a retried flush
idempotent. What remains is the app.

**Android only.** Flutter compiles for iOS and the Dart here stays
platform-agnostic, but building and signing for iOS needs a Mac, and there
isn't one — so no `ios/` directory ships rather than an unbuildable one rotting
in the tree. A fork with a Mac adds it with `flutter create --platforms=ios .`
and a signing config; the README will say Android and not imply otherwise.

## Later / maybe (being considered)

- **Anki export/import** — bridge the daily review to and from Anki decks (`.apkg`),
  a natural pairing for the spaced-repetition audience. Still being scoped — need to
  learn the format first.
- **Backlinks & freeform notes** — manually-maintained links between related
  highlights (Zettelkasten-style) and standalone notes not tied to any book. Kept
  deliberately manual; no auto-suggested "related" magic.
- **Shared / household libraries** — collaborative or shared-view libraries across
  the users on one box.
- Richer author portraits — resolve the author's Wikidata entry via the *book* (work → author) so a
  photo appears even when the Open Library record is sparse (no photo, no wikidata link). The
  disambiguation already picks the right person; this widens photo coverage.
- Email digest fallback (SMTP)
- Semantic search (`sqlite-vec`)
- Summary export to Markdown / Obsidian

## Considered and set aside

- **OCR *on the server*** — building OCR into the Go binary (even by spending AI
  tokens) isn't worth the weight, and that hasn't changed: it would be a
  dependency, a CPU cost, and an upload path, all on a box chosen for being
  small. What *has* changed is that this was written as though the server were
  the only place it could live. On-device OCR in a native app costs the server
  nothing at all, so the feature moved to §11 rather than staying refused. The
  **share-target** route (§5) is still the no-app answer and still planned.
