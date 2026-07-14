# Roadmap

Where Tippani is headed — rough order, not promises. The ethos holds throughout:
a frugal, self-hosted home for your highlights first; everything ambitious is
**optional and off unless you turn it on**, nothing phones home, and it all runs
from one small binary on your own box.

Have a request or a strong opinion on ordering? Open an issue.

## Recently shipped

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
  single ⋯ overflow (mobile), so a masonry sheds its standing button rows.
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
- **Favourite-only** — the 1–5 star rating is retired from the UI (the favourite
  ♥ is the single quick signal); stored ratings are kept but hidden.
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

### 1 · Kindle `My Clippings.txt` import
The one importer still stubbed (its endpoint deliberately answers `501`). Parse
the raw `My Clippings.txt` straight off a Kindle — the locale header line, the
`==========` separators, the BOM, the clipping-limit sentinel — and fold it into
the same idempotent, cross-source dedupe as the Markdown / Bookcision /
Hardcover / Goodreads paths, so the same passage never doubles up.

### 2 · Force-fetch & re-verify metadata (review before apply)
A deliberate "re-check everything" pass over a **selection** of books, movies,
shows, authors and actors: re-run each item's lookup against the live sources,
diff the fresh values (covers/posters, descriptions, cast, portraits, links,
identity ids) against what's stored, and present the differences for the user to
**approve field-by-field** — nothing is written until they confirm. Builds on the
now-pinned identity ids (`movies.tmdb_id`, `people.source_id`, book ids) so a
re-verify targets the same entity rather than re-guessing by name, and reuses the
chunked-refetch plumbing. The companion to the on-demand automatic portraits
already shipped — same resolution, but user-gated and bulk.

### 3 · AI summaries + notifications (opt-in)
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

### 4 · Homepage dashboard widget
A widget for **[Homepage](https://gethomepage.dev)** (and similar self-hosted
dashboards): a small, read-only, token-scoped stats endpoint surfacing today's
**pending spaced-repetition** count, your latest **quiz score**, and
**book / annotation / movie** totals — so Tippani shows up as a live tile on your
NAS dashboard. Opt-in; nothing exposed without a token.

### 5 · Account, continued — sign-in, trash, tokens
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
- **Per-user API tokens + webhooks** — scoped tokens so a script, the Homepage
  widget, or an Obsidian sync can reach *your* library over the API, plus outbound
  webhooks on events (new highlight, review done). Absorbs the old "API-token auth"
  line that used to sit under Later.

### 6 · Achievements — quiet milestones, and one gentle streak
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

### 7 · Capture from anywhere (share-target + bookmarklet)
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

### 8 · More import sources
Kobo (`KoboReader.sqlite`), Apple Books, a **Readwise** export, and read-later apps
(Instapaper · Pocket · Matter), all folded into the same idempotent, cross-source
dedupe. They surface in the Import menu **beside the still-stubbed Kindle
`My Clippings.txt`** as clearly-marked "planned" cards, so the menu shows the whole
intended set at a glance. Kobo is unverified for now — no device here to test a real
`KoboReader.sqlite` against, so it ships only once someone can confirm it parses
cleanly.

### 9 · Backup & restore
A one-click **tar of the whole data directory** (SQLite DB + downloaded covers and
posters) from inside the app, and a restore that reads it back — portability and
disaster-recovery without shelling into the box or wiring up the `VACUUM INTO` cron.

### 10 · Collections & shelves
Extend tagging **to books** (tags live only on annotations today), then a **shelf**
view that groups either books or annotations by tag — curated, named groupings
("Best of 2026", "to reread") that are really just tags surfaced as first-class
shelves, so there's no new taxonomy to learn.

### 11 · Multi-author separation (for metadata & people)
A credit is a single string today, so "Gaiman & Pratchett" or "Smith, Jones and
Lee" becomes **one** non-resolving pseudo-person — no portrait, no links, and a
junk group-by heading. Split multi-author credits into distinct people **when data
is fetched**: parse the separators the sources actually use (`,` · ` & ` · ` and ` ·
`;`) into individual names, then resolve and pin **each** one independently
(portrait + IMDb / TMDB / TheTVDB / Wikipedia / Open Library links) exactly the way
a single author already resolves, and surface them as separate names in the
group-by headings and the People console. Two guards: don't shatter a genuine single
name that merely contains "and", and keep the 0.4.2 dedupe/merge tools able to
recombine a split that shouldn't have happened.

### 12 · Verbose, structured logs
A failed request should tell you *why* from the Docker logs, not just that it
failed. Plan: consistent structured logging across handlers (method · path ·
user · outcome · **cause**), a `TIPPANI_LOG_LEVEL` knob (quiet by default,
`debug` opt-in), and request ids to correlate a client error with its server
line — without ever leaking internals into the HTTP response. (A first step is
already in: the book-save 500s now log their real cause instead of swallowing
it.)

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

- **OCR of a photographed page** — building OCR into Tippani (even by spending AI
  tokens) isn't worth the weight. Every modern phone already OCRs text natively in
  its camera/photos app, and the planned **share-target (§8)** lets you send that
  recognised text straight in — so the use case is covered without a new dependency
  or a departure from the frugal, offline-first build.
