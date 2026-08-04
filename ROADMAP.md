# Roadmap

Where Tippani is headed — rough order, not promises. The ethos holds throughout:
a frugal, self-hosted home for your highlights first; everything ambitious is
**optional and off unless you turn it on**, nothing phones home, and it all runs
from one small binary on your own box.

Have a request or a strong opinion on ordering? Open an issue.

## Recently shipped

### v1.3.0 (August 2026)

- **The shelf — where you stand with a work.** A status per book, film and show:
  *reading* / *watching*, **paused**, **abandoned**, **completed**. It reads as a
  Radarr-style colour bar **under** the artwork (never over it — the poster stays
  whole), the in-progress state pins to the top of the default sort, and only the
  active state wears a mark on the art. From *completed* the one lifecycle move is
  starting again, so a finished work cannot quietly slide back to "reading".
- **Progress in the units the thing is made of.** A percentage, or the numbers you
  actually count in: *page 96 of 214* for a physical book, *season 2 of 3, episode
  6 of 10* for a show, with earlier seasons counting in full so the bar only ever
  moves forward. The percentage is derived from the position server-side, so the
  bar, the export and every client read one number and cannot disagree.
- **A read log, not a counter.** Every read is a row — start and finish, at
  whatever precision you actually know (`2019`, `2021-02`, a full date) — so a
  reread is history rather than an overwrite. `×3` opens the dates. An abandoned
  attempt keeps its stop date without counting as a read. The same partial-date
  picker now serves the Born / Died fields it was built for.
- **Wishlist, derived from nothing you have to maintain.** A work with no quotes
  *is* the wishlist, so it has no column to drift: the filter is a three-way chip
  (all · wishlist · annotated) on desktop and its own section in the phone's
  filter sheet, and it clears itself the moment you add the first quote. A
  multi-select filters by shelf state alongside it.
- **Season + episode on a show's dialogues.** A film is one runtime, so a
  timestamp locates a line completely; a series with sixty episodes is not, and
  "01:12:40" says nothing without which episode it belongs to. A show's lines now
  carry both, ordered through the run rather than by the clock alone, shown as
  *S2E6* wherever the credit line, table, search hit, quiz card or share card
  shows a timestamp. Season 0 is a real season — it is where a series keeps its
  specials — so the columns are nullable and *unset* is null, never 0.
- **Under it.** Migrations `0024` (status, progress, position, `work_reads`, and
  the staging columns that carry an imported shelf across the approval queue) and
  `0025` (`dialogues.season` / `.episode`, plus their staged counterparts). Status
  gets its own endpoint — `PUT /books/{id}/status`, `PUT /movies/{id}/status` —
  rather than riding the full-state `PUT`, so an ordinary Edit-form save can never
  rewrite your reading history. The whole shelf and the episode locator round-trip
  through Markdown export and re-import. The soft cap on works in progress (5
  books, 5 shows, 2 films) is a client-side nudge only: the server never refuses
  it, because a second device must not be told "no" for a rule you can wave
  through.

### v1.2.0 (August 2026)

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

### v1.1.0 (August 2026)

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

### v0.6.8 (July 2026)

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

### v0.6.7 (July 2026)

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

### v0.6.3 (July 2026)

- **Version → changelog + update badge** — the running version links to the GitHub
  changelog in Settings and the mobile drawer (everyone), and once an admin has run
  *Check for updates* a "↑ update to vX" link to the release notes shows in both.
  Still on-demand — Tippani never contacts GitHub on its own.

### v0.6.2 (July 2026)

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

### v0.6.1 (July 2026)

- **Multiple-choice Daily Quiz & Practice** — replaced 0.5.0's self-graded "show
  answer" reveal with real MCQs in both directions (*which work is this quote from?*
  / *which quote is from this work?*); a correct pick is Got it, a wrong one Forgot,
  Practice still skippable. Distractors are **plausible, not random** — books by
  same author then shared genre, films/shows by shared genre then shared actor.
- **Fixes** — the "not yet reviewed" status dot was invisible (wrong border colour)
  and now shows on every quote; a wall-clock-flaky timezone test is deterministic;
  the *Daily quiz & practice* settings descriptors collapse into info-dots.

### v0.6.0 (July 2026)

- **In-app updates** — the build version is stamped into the binary and shown in
  Settings; **Check for updates** compares it against the latest GitHub release **on
  demand** (never automatic). With the Docker socket mounted (opt-in, documented
  security trade-off), **Update & restart now** pulls the new image and recreates the
  container via a one-shot Watchtower (config/volume preserved), then the page reloads
  onto the new version; without the socket it hands over the manual `docker compose
  pull && up -d`. New `GET /admin/update/check`, `POST /admin/update/apply`.

### v0.5.0 (July 2026)

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

### v0.4.7 (July 2026)

- **Search recovery that survives un-droppable corruption** — when an FTS index is so
  corrupt that even `DROP TABLE` fails, the repair escalates to a data-preserving
  whole-database rebuild (copy the intact base tables into a fresh file, triggers
  repopulate the indexes; the corrupt pages are never read). Automatic at startup and
  via Profile → *Rebuild search index*. No data lost. Reproduced + tested end to end.

### v0.4.6 (July 2026)

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

### v0.4.5 (July 2026)

- **CSP font fix** — allow `font-src 'self' data:` so the small `@fontsource` subset
  files Vite inlines as `data:` URIs aren't blocked (they were falling back to a
  system face); also unblocks the quote-card image renderer's fonts.

### v0.4.4 (July 2026)

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

### v0.4.3 (July 2026)

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

### v0.4 line (July 2026)

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

### v0.3.1 and after (July 2026)

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

### v0.3.0

- **Quote sharing** to Rich Markdown · WhatsApp · plain text (Twitter/X) · Reddit, with a live per-format preview.
- **Author & actor metadata** — bio · photo · links, viewed/edited by clicking a name, with portraits in group-by headings.
- **Search overhaul** — open a quote in place (share/edit/delete), remembered last search, group-by, and bulk tag/edit on selected results.
- **Library group-by** — series · author · decade · genre.
- Uploaded **stickers**, a read-only **demo**, real per-view **URLs**, and the tactile **paper/film redesign**.

## Planned

### Next up

The staging work that was queued here shipped in **1.2.0**, and the shelf — a
status per work, progress in the units the thing is actually made of, a derived
wishlist and a log of every read — shipped in **1.3.0** (see *Recently shipped*
for both). Nothing is claimed for the next release yet.

Of the numbered backlog below, the concurrent-write 500 recorded under *Known
bugs* is still the strongest candidate, and it now blocks in two places rather
than one: §24's offline client flushes a queue, and §9's service worker queues
writes while offline. Both *are* concurrent writes, and the retry path they
depend on is the one that fails.

For a cheap start, §1 collects the items that are an afternoon each.

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
  It matters for **§24 and §9**: an offline client flushing a queue — the Android
  app's, or the service worker's — *is* concurrent writes, and the retry path both
  depend on is the one that fails.

  The fix is to serialise write transactions behind a mutex, as PLAN §8 always
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

### 1 · Quick wins

Things that are an afternoon each and pay for themselves immediately. Grouped
here rather than buried inside the larger themes they nominally belong to,
because a cheap item filed under an expensive heading never gets picked up.

- **Name the four highlight colours.** Four strings in `users.preferences` —
  yellow = "beautiful", blue = "argument", pink = "disagree", orange = "look up",
  or whatever you actually mean by them — shown in the filter chips, the swatch
  group and the stats breakdown. Zero schema. People already do this on paper;
  the colours exist, and this is what makes filtering by one of them mean
  something instead of being a guess about your own past intent.
- **Shuffle** — one random quote, full width, nothing else on screen. The library
  has no random surface at all today; every other quote app has one, and there is
  a reason.
- **On this day** — what you saved on this date in earlier years, off `created_at`
  and `noted_at`. Both are already indexed, and the date facet already exists to
  link into, so this is a query and a card.
- **Manifest surfaces**, none of which touch the server:
  - **`shortcuts`** — long-press the installed icon for *Capture quote* · *Daily
    quiz* · *Pending imports*. The native long-press affordance, for free.
  - **`file_handlers`** + **`launch_handler`** — tap a `.md`, a `My Clippings.txt`
    or a Bookcision `.json` in the file manager and it lands in import staging.
- **App-icon badge** — `navigator.setAppBadge()` with due cards plus pending
  imports, set by the client on load. Notifications proper need something that
  wakes up on its own, which is why they sit under *Later*; this gets most of the
  same value with **no server work and nothing scheduled**.
- **Saved views** — the filter state is already serialised into the URL in full,
  so a saved view is a `(name, url)` row and a list in the drawer. Cheapest
  possible answer to "let me keep that combination of filters".
- **Keep the form filled after saving a quote** — work, colour and tags persist
  for the next one. Today a sitting of six quotes is six full re-entries.
- **Rotate the quote on the login screen.**

### 2 · The review loop, deepened

The review loop is the part of Tippani that has no real equivalent elsewhere —
the highlight managers resurface, they don't ask. Almost everything below is
query-time work against columns that already exist: no new tables, nothing
ticking, no background jobs. That is what makes this the cheapest place to get
distinctly better rather than merely broader.

- **Cloze review — blank out a phrase and recall it.** The most natural way to
  test a *quote*, as opposed to a fact, and nobody in this space does it. The
  masked span is chosen at request time from the quote text (longest run of
  non-stopwords, seeded by the quote id so it is stable per card), which means
  **no schema and no storage** — the same "compute it in the query" discipline the
  forgetting curve already follows. Grading is a fuzzy match, and the edit
  distance for it is already in `internal/search/levenshtein.go` for the
  typo-tolerant search pass.
- **Adaptive intervals, opt-in beside the fixed ladder.** `item_reviews.stability`
  is already a half-life in days, so scaling it multiplicatively on a result is a
  handful of lines. The fixed 7 → 30 → 100 ladder stays the default and stays
  honest about what it is, but a lapse currently drops you to 7 from any rung,
  and that is the one place the loop is harsher than the science asks — Anki's
  move to FSRS made the argument mainstream. Off unless you turn it on.
- **Undo the last answer.** The single most-requested control in every
  spaced-repetition tool ever built, and a misplaced tap currently costs you a
  rung.
- **Suspend a quote from rotation.** Some highlights are references, not things
  to memorise. Today the only way out of the deck is deleting the quote.
- **Themed review** — "quiz me on this book / tag / colour / person", from a
  button on the thing itself. The deck query already filters by scope; this is
  one more clause and a way in.
- **Edit, ♥ or re-tag from inside the card.** Review is exactly when you notice
  the typo, the missing tag, or that you love it — and it is currently the one
  screen from which you can do nothing about any of that.
- **Leech handling** — `lapse_count` is already stored, so at five lapses the
  card can offer to be suspended or shortened rather than grinding on.
- **More card types from data already held** — *who said this line?* (multiple
  choice over the film's own stored `cast_json`, no API call), *which chapter or
  act?*, *who wrote it?*, and *type the next line* where two annotations sit
  adjacent by location in one book.
- **A recall-history sparkline** on the quote's pop-up, drawn from `item_reviews`.

Nothing is promoted out of *Later / maybe* into this section: **Anki `.apkg`
export stays under consideration**, where it already sits.

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
- **Sign in through the reverse proxy you already run** — **OIDC**, and the
  cheaper half first, **forward-auth**: trust a configured identity header when
  `TRUSTED_PROXY` is set, which is the same trust boundary the login rate limiter
  already reasons about for `X-Forwarded-For`. Anyone fronting their box with
  Authelia, Authentik or Tinyauth wants their whole estate behind one sign-in, and
  this is the most-asked thing on this list that wasn't previously on it. Local
  passwords stay, and stay the default.
- **List and revoke browser sessions individually.** Paired devices can each be
  unpaired by name, but browser sessions can only be dropped *all at once* by
  changing your password — so "sign out that other laptop" currently means
  signing out everything. Same panel as Devices, over the `sessions` table.

Ordering note: **trash & undo has to land before the swipe gestures in §9.** A
gesture that deletes and a delete that cannot be undone are fine separately and
bad together.

### 4 · Anthologies — ordered, curated collections of quotes

A named, ordered list of quotes drawn from anywhere in the library, carrying prose
of its own: an introduction, and your commentary between the entries. It is not a
tag with a nicer hat — the two things a tag cannot do are **hold an order** and
**hold your writing**, and those are the whole point.

This is the missing *output* of a commonplace book. Everything in Tippani today
points inward: you file a passage, you find it again, you get asked about it. An
anthology is what you make *from* the collection — a sequence you arranged, on a
theme you chose, with the connective tissue that explains why these twelve
passages belong next to each other. Letterboxd's lists are the closest proven
form; the nearest thing in the annotation world is Zotero's
extract-annotations-into-a-note, which is the most-used feature it has.

- **Compose** — select quotes anywhere a selection already works (search, a work's
  detail, staging), then write between them. The bulk-select bar already exists on
  three screens.
- Exports as one Markdown file, and via §11 as **EPUB** — a small book of your own
  quotes, readable on the same e-reader the highlights came off.
- Reviewable as a themed deck (§2), because an anthology is a better answer to
  "what should I be revisiting" than any automatic grouping would be.

### 5 · Publishing — opt-in, revocable read-only links

A read-only page for one work, one tag, or one anthology, behind a token in the
URL — the same shape as the one-shot share-image link that already exists. Off by
default, one token per link, revocable individually, and never on for anything you
haven't explicitly published.

**This is deliberately not social**, and the distinction is the whole design: no
profiles, no followers, no feed, no discovery, no federation, nothing that makes
one instance aware of another. Per-user isolation is a security property here, not
a layout choice. What this adds is a link you can hand to one person — which the
app already does for a single quote, and which stops at a single quote today for
no reason other than that nobody built the page.

- `og:` / card metadata, so a pasted link looks like something.
- An embeddable single-quote route, for quoting your own library on your own blog.
- **A quote-image template gallery** — `quoteImage.js` renders one layout in four
  skins; add centred-serif, film-still, index-card and minimal, plus story, square
  and wide aspect presets.
- Needs its own security pass before it ships: this would be the **first genuinely
  public surface in the app**, and `CSP default-src 'self'` plus the covers
  allowlist were written on the assumption that there wasn't one.

### 6 · Capture from anywhere (share-target + bookmarklet)

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

### 7 · Search precision

Search is already good at finding things when you half-remember them: prefix
matching on every token, sectioned results, a typo-tolerant second pass. What it
cannot do is answer a *precise* question, and that gap widens with every hundred
quotes you add.

- **Field operators** — `author:austen tag:grief color:blue before:2025`. Every
  token currently becomes a prefix query because the box is a typeahead, which is
  right for browsing and leaves structured intent nowhere to go. The fix is to
  parse a small grammar off the front of the query *before* it reaches
  `search.ColumnPrefixQuery`, leaving bare words behaving exactly as they do
  today.
- **Exact phrases in quotes** fall out of the same work: `"to be or not to be"`
  becomes one FTS5 phrase query instead of six independent prefix terms. There is
  currently no way to ask for a phrase at all, which for a library *made of
  phrases* is the odd gap.
- **Date ranges** — the date facet parses a single day; `2025-01..2025-06` and
  "last 30 days" are the obvious extensions, and the Stats calendar already links
  into that facet.
- **Highlight the matched words** in results. The corrected query is already
  returned to the client for exactly this purpose on the fuzzy path; the
  exact-match path should do it too.
- **"More like this", without an embedding model.** Semantic search via
  `sqlite-vec` sits under *Later* and would cost a dependency and an indexing
  pass. There is an 80% version that costs neither: take the quote's
  highest-value terms from the `*_fts_vocab` views that already exist for typo
  correction, and run them as one `OR` match. Worth shipping first, because it
  may well be enough.
- **Neighbouring highlights** — "what else did I mark near here", from the
  annotations either side of this one by `location` in the same book. `locSortVal`
  already parses those locators for the sortable table. Nothing else in this
  category can do it, because nothing else keeps the locator.
- **Cross-work duplicate quotes** — `dedupe_hash` is unique per
  `(book_id, hash)`, so the same passage saved under two editions of the same book
  is currently invisible. One `GROUP BY dedupe_hash HAVING count(*) > 1` surfaces
  them, and the repair — `POST /books/merge` — already exists.
- Sort results by date or by length, not only by relevance; and a filter box
  inside a single work, which stops being optional somewhere around the
  three-hundredth highlight in one book.

### 8 · More import sources

Kobo (`KoboReader.sqlite`), Apple Books, a **Readwise** export, and read-later apps
(Instapaper · Pocket · Matter), all folded into the same idempotent, cross-source
dedupe. Kobo is unverified for now — no device here to test a real
`KoboReader.sqlite` against, so it ships only once someone can confirm it parses
cleanly. The Kindle `My Clippings.txt` importer has shipped; broadening its locale
coverage needs real files from Kindles set to other UI languages.

Three more, added after a look at what the neighbours read:

- **KOReader annotations** (`.sdr/metadata.*.lua`). To be clear about which half
  of KOReader this is: Tippani reads the **annotations**, not the books. Grimmory,
  Kavita and Calibre-Web all sync KOReader progress, which means the e-ink crowd
  is already the overlapping audience — and they are the people who highlight
  most.
- **A generic CSV / JSON importer with column mapping** — pick the file, map its
  columns onto quote fields, preview, stage. This is the future-proof answer to
  every source there will never be a bespoke parser for, and staging is what makes
  it safe enough to offer.
- **Subtitle files** (`.srt` / `.vtt`) — drop one, pick the lines worth keeping,
  and they stage as dialogues with the timestamps *already correct*. The film-side
  equivalent of a Kindle export, and the one thing the movie-quote sites prove
  people actually want to do.

### 9 · Mobile & PWA — offline first, then gestures

Tippani installs as a PWA and then behaves like a browser tab with a nicer frame,
because there is **no service worker at all**. That is the real reason it doesn't
feel native — more than any missing gesture — and it is the first thing here.

Cache the shell and recently-viewed data, queue writes while offline, flush on
reconnect. Note the dependency: a queue flush *is* concurrent writes, so this is
**blocked on the concurrent-write 500** under *Known bugs*, for exactly the reason
that entry already gives for §24.

#### Gesture ground rules

Today the only gestures are scrolling, the drawer's swipe-to-close, and dragging a
control thumb or a sticker. Adding more is worthwhile, but a web app that fights
the operating system for a swipe loses, so the constraints come first and apply to
every gesture below.

- **Nothing starts at a screen edge.** Ignore any gesture whose first touch lands
  within ~32 px of the left or right edge — that belongs to the iOS back-swipe and
  the Android back-gesture — or in the bottom home-indicator strip. The drawer
  already reasons this way; reuse its heuristic rather than inventing a second.
- **Prove direction before capturing** — 10 px on the dominant axis, dominant by
  about 1.5× — so a gesture can never steal a scroll.
- `touch-action: manipulation` on card chrome to drop the double-tap-zoom delay;
  `touch-action: none` only on the element that owns a gesture, never on a
  scrolling ancestor.
- `-webkit-touch-callout: none` and `user-select: none` on card chrome, but
  **never on the quote text** — long-pressing a passage to select and copy it must
  keep working. That is the whole app.
- **Every gesture is additive.** The ⋯ overflow, the ♥ button and the filter sheet
  all stay exactly as they are. That is both the accessibility requirement and the
  answer to how anyone discovers a gesture in the first place.
- One Settings toggle turns card gestures off wholesale, and
  `prefers-reduced-motion` suppresses the animation that accompanies them.
- `navigator.vibrate(10)` on commit — Android only, iOS Safari has nothing — which
  is most of what makes a gesture feel deliberate rather than accidental.

#### The set, in build order

1. **Double-tap a quote card** to toggle ♥. Understood everywhere, and it gets the
   same heart-bloom the button does.
2. **Pull down at the top of a list** to refresh. Standalone display mode
   suppresses the browser's own pull-to-refresh, so this is ours to implement,
   with progressive feedback and `overscroll-behavior-y: contain`.
3. **Long-press a card away from its text** to open the ⋯ menu as a context
   sheet. Middle of the screen, never an edge.
4. **Swipe up or down on a review card** for *got it* / *forgot*. The best fit in
   the whole list: vertical, so it cannot collide with either platform's back
   gesture — the Anki-mobile pattern rotated onto the safe axis — and a review card
   isn't a scroll container, so there is nothing to conflict with. A tap still
   reveals, and the buttons stay.
5. **Swipe down to dismiss a bottom sheet.** `MobileSheet` already exists, the
   gesture lives entirely inside it, and every native sheet works this way.
6. **Pinch the Library or Catalogue grid** for cover size and density — the
   direct-manipulation form of the Settings sliders that already exist, snapping to
   the same discrete sizes.
7. **Pinch and double-tap inside the cover Lightbox** to zoom and pan. The one
   place native zoom semantics are the right answer, so implement them rather than
   suppressing them.
8. **Double-tap the top bar** to scroll to top, riding the scroll memory that is
   already there.
9. **Long-press ＋ Add** for a quick-action sheet, so the same actions reachable
   from the app icon (§1) are reachable from inside the app.
10. **Two-finger tap to undo** — genuinely unclaimed on both platforms, and it
    pairs with the review undo in §2 and a delete-undo toast.
11. **Long-press a colour swatch** to make it the default for new captures.
12. **Drag to reorder** anthology entries and staged-import groupings; the sticker
    drag already proves the primitive.

Two are deliberately held back until **trash & undo (§3)** lands, because a
gesture that deletes and a delete that cannot be undone are fine apart and bad
together: **horizontal swipe inside a card's own bounds** for share/edit/delete,
Gmail-style, rubber-banding back below threshold and never deleting on the swipe
alone; and **horizontal swipe on a work-detail hero** for previous/next work in
the current filtered order, which is the riskiest of the set for being
screen-width and horizontal, so it stays on the hero and never the whole page.

One is rejected outright, recorded so it isn't revisited: **swiping between the
four bottom-nav tabs**. It is a screen-width horizontal gesture that fights the
back gesture at both edges and any horizontally scrollable content in between, and
the bottom bar is already one tap away.

Discoverability rides the existing spotlight: a short gesture chapter in the tour,
and every gesture listed in the help panel (§10).

### 10 · Help & density — one registry, four consumers

Two problems that are really one. The app explains itself in standing prose —
drawer subtexts, Settings card copy, staging destination lines, microcopy under
controls — which is good writing and a lot of it, and it is why some screens read
dense. Meanwhile there is nowhere to look up what a control does.

The first half is a density pass. Every piece of text on a screen is one of three
things: a **label** (what this control is — stays), **state** (what is true right
now: counts, "→ joins your existing *Dune*" — stays, that's feedback), or an
**explanation** (why it exists, what the trade-off is — moves into an `InfoDot`).
`InfoDot` and `Tooltip` already exist, so this is a content migration rather than
new machinery. Settings, the Metadata console and the staging page carry the most
explanation and go first, and the same rule becomes the convention for new code.

The second half is a **`?` on every screen** — a drawer row on phones — opening a
panel that documents every control on that screen, grouped by the screen's own
sections, searchable, and deep-linkable (`/library?help=filters`, which the URL
routing already supports).

The design decision that makes both affordable is to write each explanation
**once**, in one registry keyed by screen and control, and read it from four
places: the info-dot tooltips, the help panel, `docs/ui-glossary.html` (which is
hand-maintained today and drifts), and the tour's step copy. A control explained
in one place cannot contradict itself in another.

Completeness gets enforced the way this repo already enforces it elsewhere: a
build-time test keeps `docs/troubleshoot.md` in lockstep with
`internal/olog/codes.go`, and the same shape of test can require that every
registered control has help copy and every `InfoDot` resolves to a registry key.
That is the difference between "explains every option" as an intention and as a
guarantee.

Sequencing matters here: build the registry and the panel shell **early**, so
every feature after it adds its own copy as it lands, and do the exhaustive fill
**last**, once the release's surface has stopped moving.

### 11 · Interop — feeds, formats, a CLI

The way a self-hosted app wins "works with everything" is not by writing thirty
integrations; it is by speaking two or three formats other tools already read.

- **A feed of recent highlights** — RSS, Atom or JSON, token-scoped, riding the
  per-user tokens of §3. One endpoint reaches Obsidian, FreshRSS, Home Assistant,
  e-ink dashboards and a terminal widget, which is a better return than any single
  bespoke integration.
- **A random-quote endpoint**, JSON and SVG. SVG rather than PNG on purpose:
  laying text into a raster server-side is real work, whereas SVG text is string
  concatenation, and the dashboards that would display it render SVG natively.
- **CSV and JSON export.** Markdown and the zip serve Obsidian well; CSV is what a
  spreadsheet needs and JSON is what a script needs, and both are small next to
  the export builders already written.
- **EPUB export of your own highlights** — a small readable book of your own
  quotes, to put back on the e-reader they came off. `archive/zip` is already
  imported for the library export, and an EPUB is a zip with three XML files.
  Nothing else in this category does it.
- **A print stylesheet**, for the paper version of the same idea.
- **BibTeX / CSL-JSON** per work — nearly free, since ISBN, author and year are
  already stored, and the one thing an academic user asks for first.
- **`tippani quote` and `tippani export`** as CLI subcommands, alongside the
  existing `serve` / `user` / `healthcheck`. A `fortune` for your own library.
- **Export presets** — a named, saved combination of fields, template and filter,
  so the monthly dump into Obsidian is one command rather than six choices.

### 12 · Homepage dashboard widget

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
   (no session cookie), so this tier rides on the **per-user API tokens** of §3:
   a slim read-only stats surface accepting `Authorization: Bearer`, plus a
   documented field mapping. This is the real deliverable.
3. **Native first-party widget (later)** — a PR into gethomepage/homepage
   (`src/widgets/tippani/` + tests + translations + docs, one row of ≤4 blocks).
   Gated upstream: the widget must target a feature-request discussion with
   **≥20 up-votes**, and widgets for projects under ~a year old get declined —
   so the discussion gets opened early to accumulate votes, and the PR waits
   for 2027. It consumes the exact endpoint tier 2 already built.

### 13 · Collections & tag shelves

Extend tagging **to books** (tags live only on annotations today), then a view
that groups either books or annotations by tag — curated, named groupings
("Best of 2026", "to reread") that are really just tags surfaced as first-class
collections, so there's no new taxonomy to learn.

A note on the word: this section used to be called *Collections & shelves*, but
"shelf" now means where you stand with a work — reading, paused, completed — so
what this section builds is **tag shelves**, and the plain word belongs to the
other feature.

Tag hygiene belongs here too, because a vocabulary this section makes
load-bearing needs it:

- **Merge and alias tags.** The Tags page has full CRUD and usage counts but no
  merge, and every managed vocabulary needs one by its second year.
  `POST /people/rename` already establishes the rename-across-the-library pattern
  to copy.
- **Nested tags** — `theme/grief`, displayed hierarchically. Deliberately a
  display convention over the existing `name` column rather than a parent id, so
  there is no schema change and no migration to regret.
- **An optional mood and pace starter vocabulary.** The thing StoryGraph is loved
  for is, underneath, a well-chosen tag set; offering one as a suggestion on the
  Tags page costs a list of strings and no new field.
- The colour names from §1 show up here as well, since that is where the
  vocabulary is managed.

### 14 · Serendipity & looking back

Two surfaces for the collection as a whole, rather than for one quote at a time.

- **Ambient mode** — full screen, one quote at a time, slowly cycling, in whichever
  skin is current. The paper and film aesthetics are the nicest thing about the app
  and are currently only ever seen at card size. This is also the version that
  earns its keep on a display wired to the NAS.
- **Year in review** — the numbers are already computed for the Stats page; what is
  missing is the sequence that walks you through them and the single image worth
  sharing at the end. Drawn from **quotes, tags, people and the review loop only**
  — deliberately *not* from the read log, even though "books finished this year" is
  now sitting right there. See the note under *Considered and set aside*; this is
  the first place anyone would reach for it.

Shuffle and *on this day* were the cheap half of this section and moved up to §1.

### 15 · Data hygiene & bulk editing

The tools you need after an import rather than during one.

- **Find and replace across a selection**, preview then apply, reusing the
  review-before-apply flow already built for metadata re-verify. This is the single
  most useful post-import tool, and it stops being optional the moment OCR capture
  lands.
- **A shared text-cleanup pass** — de-hyphenate across line breaks, drop page
  numbers and running heads, normalise the quote marks and ligatures that get
  mangled in transit. §24 lists all of this as OCR post-processing, but it belongs
  **server-side and shared**, because every import source produces some of it and
  the typographic-folding normaliser already exists for the dedupe hash.
- **Merge two films or shows.** `POST /books/merge` exists; the catalogue side does
  not, even though duplicate detection already covers both.
- **The bulk bar on Library and Catalogue.** It is on Search, Metadata and staging
  but not on the two main browse screens — which are where you actually notice that
  forty rows need the same correction.
- **Per-batch import rollback.** `import_batches` already records the source and
  filename, so "undo that whole import" is the natural completion of the staging
  story; approval is currently a one-way door.

### 16 · Fields users will name

Unglamorous, low-risk, and the sort of thing that turns up as an issue rather than
a feature request.

- **Book fields** — format (paper · ebook · audio), language, publisher,
  translator, subtitle. Format and language are the two that get filtered on;
  translator matters more than you would expect to anyone reading literature in
  translation. Page count is deliberately **not** on this list: it is already
  stored as the progress bar's denominator, and a second metadata-sourced page
  count would give the app two numbers that can disagree. If it is ever wanted as
  canonical metadata it should *feed* that one, not sit beside it.
- **Film and show fields** — runtime, original title, country, language,
  certification. TMDB already returns every one of these in responses that are
  already being fetched, and they are what the decade / country / language
  breakdowns are made of.
- **A per-season episode map** from TMDB or TheTVDB. The shelf stores a season
  total and the *current* season's episode count, because that is what a viewer
  knows off the top of their head; a real map means progress through a long run
  stops needing you to supply each season's length by hand.
- **"Attributed to" on a quote** — for a book quoting someone else. An epigraph is
  currently credited to the book's author, silently, which quietly corrupts both
  the author breakdown and the author multiple-choice distractors.
- **A locator-kind hint** per book: whether its locators are print pages, Kindle
  locations or percentages. The staging location formulae already show that people
  care about locator arithmetic.
- **A spoiler flag**, blurred until tapped. Standard wherever reviews are public,
  and it matters as soon as anything is shared.

### 17 · Desktop keyboard

There is no global shortcut registry at all today, which for a text app with a
large library is the biggest single desktop gap.

- **A command palette** on `⌘K` / `Ctrl-K` — jump to a work, run a search, capture
  a quote, switch theme, start the quiz. It doubles as the place every shortcut
  below becomes discoverable.
- **Single-key shortcuts** — `/` to search, `n` for a new quote, `g` then
  `l`/`c`/`s` to go to Library, Catalogue or Stats, `j`/`k` through a list, `f` to
  favourite, `e` to edit, `?` for the sheet. Escape-to-close is already implemented
  consistently across a dozen components, so half the conventions are set.
- **Review shortcuts** — `1` and `2` to grade, space to reveal, `u` to undo.
  Anyone arriving from an SRS tool reaches for these on reflex.
- **Shift-click for range selection**, since the bulk bar currently costs one click
  per row.
- **An optional denser layout** — one toggle, not a redesign. The paper and film
  aesthetics are rightly generous for reading and expensive for triage.

### 18 · Achievements — quiet milestones, and one gentle streak

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

This sits below §2 rather than above it because its one streak rides on the review
loop, so it reads better once that work has landed — and because being off by
default makes it easy to wait for.

### 19 · Access & reading comfort

- **Internationalisation scaffolding.** The app is named in Bengali, ships a
  Bengali wordmark and a Noto Serif Bengali subset, and its interface is English
  only. Extracting strings gets more expensive every release, so the argument for
  starting is not that translations are next — it is that the cost only goes up.
  English plus one real translation, to prove the seams are in the right places.
- **Reading-comfort controls for the quote text** — size, line height, measure, and
  a serif or sans choice. Reading passages is the entire purpose of the app, and
  the only typographic control today is how big the covers are.
- **A high-contrast mode** — drop the grain overlay, flatten the textured
  background, and raise ink and rule contrast to WCAG AA. The textures are lovely
  and they are not free.
- **A dyslexia-friendly font option**, cheap given the existing self-hosted
  `@fontsource` setup, and asked for often by people who read a lot.
- **A named, focusable equivalent for every gesture** added in §9.

### 20 · Ops

- **A `/metrics` endpoint** (Prometheus), behind a token and off by default. This
  audience runs Grafana, and the numbers are already computed for Stats.
- **Off-box backup without a scheduler.** Uploading to rclone, WebDAV or S3 means a
  background job and a dependency, both of which are refused elsewhere in this
  document for good reasons. The version that fits is to ship the *primitive* — a
  documented one-line `curl` against the existing backup endpoint, plus a
  `tippani backup --out` subcommand — and let the box's own cron do the scheduling
  it is already running.
- **A read-only mode flag.** The Pages demo already simulates one client-side; a
  server flag would let someone share a live instance without risk.
- **A per-user storage cap**, for anyone hosting for family. Images are the only
  unbounded growth path in the data directory.

### 21 · Verbose, structured logs

A failed request should tell you *why* from the Docker logs, not just that it
failed. Plan: consistent structured logging across handlers (method · path ·
user · outcome · **cause**), a `TIPPANI_LOG_LEVEL` knob (quiet by default,
`debug` opt-in), and request ids to correlate a client error with its server
line — without ever leaking internals into the HTTP response. (A first step is
already in: the book-save 500s now log their real cause instead of swallowing
it.)

### 22 · Grimmory sync (self-hosted, direct MariaDB)

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

### 23 · Out in the world — directories & icon CDNs

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
  (no submission repo): reach out to <hello@selfh.st> with the repo, one-liner,
  demo link and icon. Being picked up by the *This Week in Self-Hosted*
  newsletter's "New Software" section is the usual front door.
- **[awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)**
  — the biggest list, syndicated by many others, but it **rejects projects
  younger than 4 months**; the repo went public 2026-07-05, so this submission
  waits until ~November 2026.
- **Prerequisite for all of the above**: confirm the GHCR package is publicly
  pullable — a directory listing pointing at a pull-gated image is a bad first
  impression.

### 24 · Android app — capture by camera, with on-device OCR

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

Two notes on where the work belongs. The text cleanup listed above — de-hyphenation,
running heads, mangled quote marks — should live **server-side and shared** rather
than in the app, because every import source produces some of it; that is §15. And
the photo the correction screen already holds beside the text is worth **keeping,
attached to the quote**: one nullable path column on an image pipeline that already
stores covers, posters, portraits and stickers, and it keeps the evidence next to
the transcription for the next time you doubt a line.

**Android only.** Flutter compiles for iOS and the Dart here stays
platform-agnostic, but building and signing for iOS needs a Mac, and there
isn't one — so no `ios/` directory ships rather than an unbuildable one rotting
in the tree. A fork with a Mac adds it with `flutter create --platforms=ios .`
and a signing config; the README will say Android and not imply otherwise.

## Later / maybe (being considered)

- **AI summaries + notifications (opt-in).** A passive digest: batch your recent
  highlights, summarise them with an **OpenAI-compatible** model (local or remote —
  your endpoint, your key), and optionally push the result. Grouped by book, tag, or
  whole library; weekly or on-demand. Off unless configured, generated async
  (fire-and-forget, no realtime calls), and — true to the frugality goal — **no cron
  dependency** (an in-app scheduler or an optional systemd timer). Config would be
  the OpenAI endpoint / key / model, the notifier URL(s), cadence and grouping, plus
  a "Summaries" page listing recent digests, each linking back to its source.

  Notifications would start with **NTFY**, likely routed through a multi-service
  notifier — **[Shoutrrr](https://containrrr.dev/shoutrrr/)** or similar — so one
  config reaches any backend (ntfy · Gotify · Telegram · Discord · email · …).
  Non-negotiable, whatever gets picked: **high / urgent priority must carry
  through** — a resurfaced highlight is a gentle nudge, but "lookup is failing"
  should be able to shout.

  This sat in the numbered backlog until it was moved here deliberately. Nothing
  about it has been ruled out; it is simply not something to build next. Worth
  noting that the cheap end of the notification ask needs none of it: the app-icon
  badge in §1 shows a due-card count with no server work and nothing scheduled.
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
- Semantic search (`sqlite-vec`) — note that §7's "more like this", built from the
  term dictionaries already in the database, ships first and costs no dependency at
  all. It may remove the need for this entirely.
- Summary export to Markdown / Obsidian
- **Reviving a rating.** The 1–5 stars were retired **on purpose** in 0.4.3 and ♥ is
  the cleaner signal, so this is recorded as a reversal to weigh rather than as
  planned work — but half-stars are the single most-cited feature of the trackers
  people arrive from, and the columns are still there, inert, from before the drop.
  If it ever comes back it should be per-user and opt-in, so the default library
  looks exactly as it does now.
- **Audio review, in the browser only.** Reading a due card aloud is well liked
  elsewhere. Server-side speech is out for the same reasons as server-side OCR, but
  the browser's own `SpeechSynthesis` costs the server nothing, needs no key, and
  works offline once §9's service worker exists. Parked here rather than in the
  backlog because it sits next to a line that was drawn deliberately.
- **A voice note on a quote** — record, store, play back, with no transcription,
  which would be a dependency. For the reaction you can't type while reading.

## Considered and set aside

- **OCR — and speech — *on the server*** — building OCR into the Go binary (even by
  spending AI tokens) isn't worth the weight, and that hasn't changed: it would be a
  dependency, a CPU cost, and an upload path, all on a box chosen for being
  small. What *has* changed is that this was written as though the server were
  the only place it could live. On-device OCR in a native app costs the server
  nothing at all, so the feature moved to §24 rather than staying refused. The
  **share-target** route (§6) is still the no-app answer and still planned.

  **Server-side text-to-speech** is refused on identical grounds and belongs in the
  same entry: a model or a paid API, CPU we don't have, and audio to store or
  stream. The same escape applies — the browser already has a speech engine, so
  reading a card aloud is a client feature or it is nothing. See *Later*.
- **A built-in reader, OPDS, and file sync to a Kobo or Kindle.** Tippani holds no
  book files, and that is a design decision rather than a gap: it is a home for what
  you *marked*, not for what you own. Grimmory, Kavita, Calibre-Web and
  Audiobookshelf all do the shelf properly, one of them is already a planned sync
  source (§22), and competing with them would mean carrying a format zoo, a
  streaming path and a storage story for no gain.

  The distinction worth stating, since the two look similar from outside: reading
  **annotations** out of KOReader or Kobo is very much wanted and is in §8. Serving
  **files** is not.
- **Social features** — following, feeds, public profiles, discovery, and
  ActivityPub-style federation of the Bookwyrm kind. Per-user isolation here is a
  security property, not a layout choice: a foreign row answers 404 precisely so
  that nothing leaks between accounts on one box, and a social graph works against
  the reason for self-hosting in the first place. Letterboxd and Bookwyrm own that
  layer and are welcome to it.

  §5 is deliberately the other thing: a revocable link to something you chose to
  publish, with no profile, no follower, no feed and no awareness of any other
  instance.
- **The shelf and the read log as a data source for anything else.** The shelf gives
  the app a status per work, a progress figure, a position in pages or seasons, and
  a row per read carrying start and finish dates. All of it is **your input, shown
  back to you for your own convenience, and nothing else consumes it.**

  Named concretely, because these are the exact temptations and they are all
  plausible: no read-log series in the Stats activity calendar; no "books finished
  this year" in the year in review (§14); no reading-pace or completion charts; no
  progress- or completion-based achievements in §18; and no shelf status feeding the
  review deck's scheduling. Recorded here so the boundary stays a decision instead
  of being rediscovered later as an opportunity.
