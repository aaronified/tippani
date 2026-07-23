# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.4] - 2026-07-23

### Added
- **Native HTTPS (opt-in).** Point `TIPPANI_TLS_CERT` / `TIPPANI_TLS_KEY` at a
  PEM pair and Tippani serves TLS itself — no reverse-proxy container needed.
  The pair **hot-reloads** when the files change (renewals need no restart; a
  botched write keeps serving the previous pair and logs `TIP-HTTP-001`),
  session cookies turn `Secure` automatically, and the container healthcheck
  probes https. Certificates come from wherever you already get them (home CA,
  `tailscale cert`, external ACME tooling) — Tippani still doesn't speak ACME,
  phone home, or run renewal jobs.
- **One-click updates through a docker-socket-proxy.** Set
  `TIPPANI_DOCKER_HOST=tcp://dockerproxy:2375` and the in-app update talks to a
  [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)
  (`CONTAINERS=1 IMAGES=1 POST=1`) instead of a mounted socket — the one-shot
  Watchtower helper gets `DOCKER_HOST` and joins all of the container's networks
  (so whichever one carries the proxy is covered) rather than a socket bind. The
  raw-socket path is unchanged; the README documents
  both, including what the proxy genuinely does and doesn't harden. Engine
  failures during an update now log as `TIP-UPDATE-001`.

### Fixed
- **Phones no longer pan sideways on Settings, Metadata and User management.**
  A closed tooltip (the ⓘ info-dots') kept its invisible bubble in layout, and
  one sitting near the right screen edge widened the page's scrollable area —
  the page dragged sideways into blank space, and iOS pulled the fixed
  User-management overlay along with the pan. Closed bubbles now leave layout
  entirely (the fade-in/out survives on modern engines via `@starting-style` +
  `allow-discrete`), and the page root upgrades its horizontal-overflow
  backstop to `overflow-x: clip`.

## [0.9.3] - 2026-07-23

### Changed
- **Dialogue quotes drop the wrapping quote marks** on cards (favourite tiles,
  the Catalogue dialogue cards, the tour sample) — a multi-speaker line reads
  badly inside one pair of quotes. Book quotes keep theirs.
- **TMDB / TheTVDB ids are links** on the film/show detail header (open the
  source record), and that credit line is vertically centred so the portrait
  chips and the mono text (year · ids) line up instead of sitting on the
  baseline — the book detail credit line too.
- **Mobile drawer rework.** Search moves up directly below ＋ Add; every nav row
  carries a contextual subtext (tag count, metadata issue count, daily-quiz
  streak, version — alongside the library/catalogue counts); and **Profile** +
  **User management** get their own section at the bottom. Quote capture is no
  longer a drawer row (it's the ＋ Add surface's Capture tab), and the Add
  subtext ("Work · Quote · Import") can't wrap onto a second line.

### Fixed
- **Multi-speaker dialogue credits split on cards.** A dialogue crediting
  several actors ("Sinéad Cusack, Hugo Weaving") now shows each as an
  individual person with their portrait on the Home favourite tiles and the
  search dialogue hits, matching the rest of the app (previously one joined,
  portrait-less chip).
- **Quotes keep their line breaks.** Multi-line / multi-paragraph quotes (e.g.
  multi-speaker dialogue) no longer flatten to one run on the favourite tiles,
  the Daily-Quiz / Practice prompt, the search quote hits, or the shareable
  image — matching the book/film detail cards.

## [0.9.2] - 2026-07-23

### Added
- **Activity is Saves · Quiz · Practice.** The Stats activity calendar gained a
  switch: the same GitHub-style heatmap now also shows Daily-Quiz and Practice
  answers per day (new `daily_quiz` / `daily_practice` on `GET /stats`), and the
  Practice view carries a **reset practice** link. The calendar fills the card
  width on desktop (well over a year of history) and holds a year with
  horizontal scroll on a phone.
- **Practice resumes across a reload,** and a round can be ended early. The
  active deck, position and tally persist (per-user, so a shared browser never
  shows one account's deck to the next), so a refresh drops you back onto the
  same card instead of the start; an **End practice** link stops the round and
  shows the summary.

### Changed
- **Films and shows are tagged apart in search.** Movie search hits carry
  `media_type`, so a result card shows a **FILM** / **SHOW** tag by its title.
- **Multi-author credits split everywhere they show.** Search result cards, the
  search quote pop-up and the Home favourite tiles now render a joined credit
  ("Gaiman & Pratchett") as individual, clickable people with portraits — the
  same splitting the detail pages and group-by headings already used. The search
  pop-up previously showed no author/actor chips at all.
- **Quote capture is only in ＋ Add now.** The separate top-bar ❝ pill is gone
  from both bars (it duplicated the Add surface's Capture tab); the phone drawer
  keeps its Capture-quote row. The Add slider uses short labels
  (Add · Capture · Import) on a phone.
- **Stats breakdown rows line up.** Cover/portrait kinds reserve a fixed art
  column, so an entity without an image aligns its name and status bar with the
  ones that have art.

### Fixed
- **Activity x-axis shows every month.** The leading partial month now yields so
  the first full month (e.g. August) keeps its label instead of being crowded
  out, and the calendar's data window matches how many weeks it can draw.
- **Search table view no longer blanks on a facet-only query.** A date, author,
  tag, genre or decade query (with no plain title/quote hit) rendered an empty
  screen under the table view; the facet sections now render in every view.
  Annotation/Dialogue section headers count quote hits, matching the table.
- **Demo:** the ribbon notes the self-hosted app is more polished, and demo
  cover art carries an explicit size so the first catalogue tile can't drift out
  of line.

## [0.9.1] - 2026-07-23

### Added
- **Search results are sectioned by what matched.** `GET /search` now facets
  every hit: **Books / Movies** (title · series), **Annotations / Dialogues**
  (quote · character), **Authors / Directors / Actors** (the credit columns,
  each person heading their works or lines), **Notes** (margin-note matches),
  **Tags** (matching tag names with the quotes wearing them) and **Genres**
  (matching genre names with their works) — the Search page renders one
  section per facet, only when it has hits. Two structured facets join them:
  a **decade** query (`1990s`, `40s`) lists the works published/released
  then, and a **date** query (`2026-07-14`, `14 July 2026`) lists everything
  **added that day**. A query whose tokens span columns ("casab mich" —
  title + director) still finds its work via a cross-column fallback pass,
  and the zero-hit typo correction covers the new facets too. Dialogue
  search hits now carry the margin `note`.
- **Stats is clickable — and wears art.** Activity-calendar dots highlight
  on hover and click through to that day's additions on the Search page
  (the new date facet). Breakdown rows carry cover/poster thumbs (books ·
  films · shows) or People-console portraits (authors · directors · actors),
  and every breakdown name, top tag and superlative title clicks through to
  Search. `GET /stats` sends `cover_path` on breakdown rows and on the
  most-annotated / most-quoted superlatives.

### Changed
- **Capture quote is a tab of the ＋ Add surface — and left the Home screen.**
  Picking "Capture quote" now swaps the bottom of the Add pop-up in place,
  exactly like "Import files" — look up / add, capture and import rotate
  freely inside one surface (no more closing into a separate pop-up). The
  Home capture tile is gone; capture lives where adding lives: a **❝ pill
  beside ＋ Add in the top bar (desktop and phone)** opens the surface
  straight on the capture tab, and the phone drawer gained a **Capture
  quote** row.
- **The look-up card's manual path is push-button on failure.** "Add
  manually" has always been one link away (press it to skip the lookup
  entirely); now a failed or empty lookup also surfaces a real **"＋ Add
  manually instead"** button, so the hand-entry escape hatch steps forward
  exactly when the lookup lets you down.

## [0.9.0] - 2026-07-22

### Added
- **Onboarding & guided tour.** Settings grew an **Onboarding** card that
  lists every feature and starts a guided step-by-step tour of them all —
  a spotlight ring over the real control plus a walkthrough card. It runs
  once on each user's **first launch**; every step is skippable (Next), the
  whole tour can be skipped, or parked with **"finish later"** — a Resume
  button in Settings picks up at the saved step (new `tour` / `tourStep`
  preferences, partial-merge like the rest). The tour never asks for your
  files: a public-domain book quote (*Pride and Prejudice*) and film
  dialogue (*Casablanca*) are built in as sample content, and the admin
  steps show and ask for the **TMDB / TheTVDB / Google Books keys and the
  optional Amazon cookie** — with instructions on where each comes from —
  while the highlighted Metadata card stays usable so they can be pasted
  mid-tour.
- **People chips on Home.** Favourite tiles wear author/actor faces on the
  source line and, expanded, full clickable person chips (portrait + name →
  the people panel). The quiz wears them too: a *"which quote is from this
  work?"* prompt chips the book's author or the line's actor, and every
  work-title option carries its person — book → author, film/show → your
  dialogues' actor, falling back to the director (`option_meta` beside
  `options` on source cards; screen cards now also carry `actor`).

### Changed
- **Stats: ranked, scrollable breakdowns; superlatives as tiles.** Breakdown
  rows are ranked (#1 onward) and the list scrolls past ~10 visible rows —
  the server now sends up to 50 per kind (was 8). Top tags gets the same
  rank + scroll treatment past ~5 visible (cap 5 → 50). The Superlatives
  card shrank from half a column into one row of compact tiles, and
  Colours + Top tags stack beside the Breakdown instead.

## [0.8.7] - 2026-07-22

### Fixed
- **Adding annotations & dialogues on desktop.** 0.8.6 made every add a pop-up
  and removed the inline add tile, but the desktop detail toolbars never got
  the promised ＋ — annotations and dialogues could only be added from a
  phone's detail bar. The annotation/dialogue toolbar now carries an explicit
  **＋ Add annotation / ＋ Add dialogue** button, and the shell's ＋ Add surface
  gained a **Capture quote** segment that swaps to the quick-capture sheet
  (target any book, film or show) — so the top ＋ adds quotes too, on every
  device.

## [0.8.6] - 2026-07-22

### Added
- **GitHub-style activity calendar on Stats.** A year of saves as one dot per
  day, one column per week, only the months labelled on the x-axis — sequential
  accent shading by count, horizontal scroll (opened at today) on phones.
  `GET /stats` now returns `daily_activity` (per-day counts, last ~53 weeks)
  and drops `monthly_activity` with the old 12-month bars.
- **Memory card on Stats.** Where the whole library stands on the forgetting
  curve: a tile per recall status, how many quotes are in the review rotation,
  and their average half-life (`recall` in `GET /stats`).
- **Breakdown card on Stats.** The People card grew a full dimension dropdown —
  **Authors / Books / Series / Films / Shows / Directors / Actors**. Each kind
  shows its entity count and per-entity **works · quotes · recall statuses**
  (stacked status bar + spelled-out counts), headlined by the **best
  remembered** and **most forgotten** entity of that kind. Author/director/actor
  tallies run **after multi-author credit splitting** (§11), so "Gaiman &
  Pratchett" counts each author. Replaces the flat `authors`/`actors`/
  `directors` counts and `top_authors`/`top_actors`/`top_directors` in
  `GET /stats` (`breakdown`).

### Changed
- **Longer memory half-life + a grace week for new quotes.** The half-life
  floor (and unseen-card default) rises from 1 day to **7 days**, and due-ness
  applies the floor to stored stabilities. A quote is **"remembered" for its
  first week** after being saved — it doesn't enter the Daily Quiz until the
  week is up (a recorded lapse still wins over the grace week).
- **Adding annotations/dialogues is always a pop-up.** The add form opens in
  the standard form modal on every device — a full-screen sheet on phones —
  and the inline dashed tile is gone; the omnipresent ＋ buttons are the entry.
- **Search moved out of the nav tabs on desktop.** It sits as an icon-only
  button in the ＋ Add pill's accent texture, between ＋ Add and the user chip —
  the way the phone top bar already works.

### Fixed
- **Stats nav icon** reads as outlined rectangular bars so it carries the same
  visual mass as the neighbouring glyphs.
- **Search tiles pack like every other board.** Result cards deal onto the
  shortest column (shared masonry, relevance order kept) instead of CSS
  columns, which could leave the last hit stacked on the longer column.
- **New tags can be created from the add/edit forms reliably.** Tag text typed
  without pressing Enter now commits when focus leaves the field instead of
  silently vanishing on save. (Unknown tag names were already auto-created
  with the default colour and style — editable later on the Tags page — both
  from forms and from imports.)

## [0.8.5] - 2026-07-19

### Added
- **People on the Stats page.** The Stats page gains a **People** card with a
  dropdown that switches between **Authors / Actors / Directors** — each showing
  that kind's count and a top-N leaderboard (authors by book count, actors by
  lines quoted, directors by films). `GET /stats` now returns `actors` /
  `directors` counts and `top_actors` / `top_directors` alongside the existing
  authors data. This is the groundwork for the upcoming achievements feature.

### Removed
- **Ratings are fully retired.** An earlier pass removed the 1–5 star rating from
  the UI but left it in the API and database. It is now gone entirely: dropped
  from every request/response, the list filters (`min_rating`), the importers,
  the Markdown bindings, and the Stats page. Migration 0018 **drops the `rating`
  column** from `annotations` and `dialogues` (a table rebuild that preserves
  tags, the spaced-repetition schedule, and full-text search); the `rating`
  columns on `books`/`movies` are left as inert dead columns (those tables are
  FK parents, so rebuilding them to drop a hidden column would risk the library).
  **Favourites (the ♥ flag) are unchanged** — the one keep/love signal.

### Fixed
- **Stats nav icon is vertically centred.** The bar-chart glyph sat low because
  its baseline was at the bottom of the icon box; its mass is now centred.
- **Restore file-picker is a real button** (also shipped mid-0.8.4): the plain
  browser file input in the restore flow is a proper "Choose backup file…"
  button that shows the chosen filename, in Settings and the onboarding card.

## [0.8.4] - 2026-07-19

### Added
- **A dedicated Stats page.** Library statistics move out of the Settings card
  onto their own screen — a new utility tab (Tags · Metadata · **Stats** ·
  Settings), a `/stats` route, and a drawer entry — with a good deal more to
  see. `GET /stats` now also reports distinct **authors** and **genres in use**,
  a **highlight-colour breakdown**, **top authors** and **top tags**
  leaderboards, a **"collecting since"** date, and a **12-month** activity
  window (was 6). Everything stays in the app's visual system: hero stat tiles,
  single-hue accent bars for the activity and leaderboards, and the four real
  highlight colours for the
  colour breakdown (each labelled + counted, so identity never rides on colour
  alone). This is the groundwork for the upcoming achievements feature.

### Changed
- **Restore file-picker is a real button.** The plain browser file input in the
  restore flow (0.8.3) is replaced with a proper "Choose backup file…" button
  that shows the chosen filename — the same control the avatar upload uses — in
  both the Settings restore block and the first-run onboarding card.

## [0.8.3] - 2026-07-19

### Added
- **Restore from an uploaded backup file — including one from another server.**
  Restore previously only re-applied the single archive this server kept in
  `<data>/backups`, so a backup downloaded from a _different_ Tippani box could
  not be restored — not what "restore" should mean. You can now **upload a backup
  file** and restore it, through the same hardened pipeline the kept-archive
  restore uses (staged extract with path-traversal + decompression-bomb guards,
  SQLite `quick_check`, atomic in-process data-dir swap with one `.pre-restore`
  safety generation, migrate + FTS-heal on reopen). A backup from another server
  is accepted as long as its schema is not newer than this build's; older schemas
  migrate forward automatically. `POST /admin/restore/upload` (admin, Settings →
  Backup & restore; `multipart/form-data`, a `confirm=RESTORE` field plus the
  `file`, capped at 2 GiB with a progress bar) and `POST /auth/restore/upload` (the first-run
  onboarding screen, so moving to a new box needs no SSH — spin up a fresh
  instance and upload your archive). The admin upload takes a `confirm=RESTORE`
  field alongside the file. New error code `TIP-BACKUP-007`.

## [0.8.2] - 2026-07-19

### Fixed
- **Lookup 502s are no longer invisible.** When an on-demand lookup failed at the
  provider — `POST /people/lookup`, `/people/portrait`, `/books/lookup`,
  `/movies/lookup`, and the movie edit "look up" re-sync — the handler returned a
  generic 502 ("lookup failed — try again in a moment") and **logged nothing**, so
  the real cause (a rejected key, a quota, a bad HTTP status) never reached
  `docker logs`. Every such path now logs the underlying provider error with a
  lookup code (`TIP-META-014`, `TIP-PEOPLE-003`) before responding — errors are
  emitted at all log levels, not just debug. A TMDB-rejected-key (401) on a person
  lookup now says so ("re-check it in Settings → Metadata sources") instead of the
  misleading "try again in a moment", matching how the movie lookup already
  behaves — a bad key never fixes itself on retry.

### Changed
- **Extensive outbound tracing at `TIPPANI_LOG_LEVEL=debug`.** Every outbound
  metadata call now emits a `[trace]` line with its URL and result status — Google
  Books, Open Library, Wikidata/Wikipedia, TMDB, TheTVDB (login + search/details),
  the cover/poster/portrait image fetcher, and Amazon (whose errors were otherwise
  swallowed). Provider secrets (`api_key`/`key` query params) are redacted; bearer
  tokens never appear (they travel in the `Authorization` header). This makes
  "which provider, what status" visible while diagnosing a failing lookup. A no-op
  at normal log levels.

## [0.7.0] - 2026-07-18

### Added
- **Directors & creators in People.** The People console (Metadata tab) gains a
  third kind beside Authors and Actors — **Directors** — sourced from each film's
  director (a show's creator). A film's director name is now a link on the detail
  page, and in Search the "by director" group headings are too; both open the
  same metadata panel (bio · photo · reference pages) as authors and actors, with
  rename-across-the-library and duplicate-merge included. Photos and the TMDB
  identity resolve from the crew already cached in the film's stored TMDB payload,
  so films already in the library need no re-sync and cost no extra API call (a
  by-name TMDB search is the fallback); like actors, director photos and links
  need a TMDB key. The `/people` endpoints (`names`, `lookup`, `portrait`,
  `rename`, re-verify) now accept `kind=director`. See `docs/PLAN.md` §7.

## [0.6.9] - 2026-07-18

### Added
- **Typo-tolerant search.** When a search finds nothing, Tippani now retries with
  the query's words corrected to the nearest ones it has actually indexed —
  "shawshenk" finds *The Shawshank Redemption*, "casblanca" finds *Casablanca* —
  and shows an "no exact matches — showing results for …" note above the results.
  Correction is bounded edit-distance in Go over zero-storage `fts5vocab` views
  (migration `0016`); it runs only on a zero-hit query, keeps whole words that
  are already valid prefixes untouched (so typeahead is unchanged), stays scoped
  to your own library, and degrades silently to the plain empty result if the
  vocabulary can't be read (`TIP-SRCH-004`). No new dependencies, no new index
  data. See `docs/PLAN.md` §4.
- **Restore during first-run onboarding.** Moving to a new box no longer needs a
  throwaway admin account: drop the backup archive into `<data>/backups` and the
  onboarding screen shows an "or restore a backup" card (with the backup's date)
  beside "create admin". `GET /auth/status` surfaces the kept archive **only**
  while onboarding is open (never after a user exists), and the new public
  `POST /auth/restore` self-guards on the users table being empty — no session,
  no typed confirmation (nothing to lose yet), rate-limited. The users-empty
  invariant is enforced atomically at the swap: the restore re-checks it under
  `backupMu` just before the point of no return, and signup takes the same lock
  around its insert, so a signup can never land mid-restore and be overwritten.
- **Authors & actors have faces, bios, and birth years.** Clicking any author or
  actor name opens a panel that auto-fetches a portrait (authors via Open
  Library / Wikipedia; actors from the film's stored cast), a short bio, and the
  birth year, with reference links out to IMDb / TMDB / TheTVDB / Wikipedia /
  Open Library. The portrait is a passport-ratio photo the bio wraps around, and
  a click opens it full screen. Small face icons sit beside author names on the
  library grid and book detail, and on dialogue quote blocks.
- **Film-negative views for a film/show's dialogues.** List view is a film strip
  — sprocket rows, a "TIPPANI · SAFETY FILM" edge, and frame-code dividers —
  while tiles view is a book-style collage of film-frame cards.
- **One catalogue console for books, films, and shows.** The Metadata screen
  merges the three media into a single console.

### Changed
- **Settings help moved into info-dots.** The Metadata "Save keys" and the
  Backup & restore cards drop their standing help paragraphs for the same
  hover/focus info-dot used elsewhere, tightening both cards (removes the empty
  gap under "Save keys"). The last-backup line and the restore warning stay.
- **Quotes expand on click — the "show more / show less" buttons are gone.**
  Tiled quote boards (books, Home favourites, sticker quotes) and long
  descriptions/bios clamp to a seeded 3–5 lines with a small chevron; clicking
  the text expands it in place, one at a time. Book tiles lay out in source order
  (newest on top, freshly-added quotes pinned until the next refresh), so the
  clamp sizes vary the board without banding by height; Home favourites reshuffle
  on every page load.
- **Quote & dialogue edits open in a pop-up.** Editing opens a modal form (the
  house `FormModal`) instead of expanding the card in place.

### Fixed
- **Tiled quote boards no longer reshuffle.** The height-packed masonry measures
  real card heights and freezes its column layout the first time a quote is
  expanded, so expanding, collapsing, switching quotes, filtering, or crossing a
  responsive breakpoint never reshuffles the board under the reader.
- **Navbar labels no longer clip when the window narrows.** The desktop tab
  strip held its `.topbar-nav-group` at natural width (`flex: none`) so a tight
  window overflows the nav — which the icon-only collapse actually measures —
  instead of squeezing the toggles and shearing labels mid-glyph without ever
  tripping the collapse.
- **A long restore no longer strands the UI.** `restoreFromNewest` clears the
  60s write deadline (a large-library extract+swap+reopen could outlive it and
  drop the connection), and both restore buttons fall back to a reload if the
  connection drops, rather than freezing on "Restoring…".

## [0.6.8] - 2026-07-17

### Added
- **Backup & restore (Settings, admin).** `POST /admin/backup` builds a dated
  `tippani-backup-<ts>.tar.gz` of the whole data directory — a `VACUUM INTO`
  snapshot of the live database (consistent while people keep writing, no WAL
  sidecars) plus MediaCover and everything else — into `<data>/backups`, keeps
  exactly the newest archive server-side and starts the download. The restore
  block shows that backup's date and, on a typed `RESTORE`, replaces the whole
  data directory from it **in-process** — staged extraction with
  path-traversal/entry-type/decompression-bomb guards, database validation
  (header, `quick_check`, schema not newer than the binary), atomic rename
  swap, then the normal boot sequence (migrate → integrity → FTS self-heal).
  No Docker socket needed; the previous data dir survives as one
  `.pre-restore-<ts>` safety generation, a failed swap rolls back intact, and
  new `TIP-BACKUP-001..006` codes land in `docs/troubleshoot.md`.
- **Per-person work counts in the People console.** `GET /people/names` rows
  now carry `count` — books for authors, distinct titles for actors, tallied
  on the *split* credit components so a co-authored book counts once per
  author. The console shows it as a Books/Titles column; tapping the count
  jumps to Search seeded with that person's name.
- **Searchable import picker on phones.** The Import tab's six-card wall
  becomes a searchable format dropdown (Markdown preselected), the picked
  format's detail card with its how-to steps inline — the hover info-dot never
  worked on touch — and a single Import button into the same per-file batch
  pipeline. The desktop card wall is unchanged.
- **Scroll memory for the last two list pages.** Opening a detail (or hopping
  tabs) and coming back restores the list's scroll position; the memory holds
  the last TWO list pages (LRU) and everything else starts fresh at the top.

### Changed
- **The mobile top-bar ＋ now opens the Add surface** (book · film · import
  toggle) like the desktop pill, instead of quote capture — the Import toggle
  was otherwise unreachable outside the drawer. Quote capture lives on the
  Home capture tile.
- **Credit-separator chips show bare symbols** (`,` `;` `&` “and”) instead of
  spelling each symbol out next to itself.

### Fixed
- **Mobile image share inside WebView wrappers (random names, corrupt bytes).**
  Android WebView (Native Alpha and other PWA wrappers) never implements the
  Web Share API, so the 0.6.7 share-sheet fix silently fell back to the
  `blob:` anchor whose download bridge produces UUID filenames and mangled
  bytes. Phones without a usable share sheet now stage the rendered PNG via
  `POST /share/image` and download the returned **one-shot URL** — a real
  request the wrapper's DownloadManager handles, filename carried by
  `Content-Disposition`, single-use 128-bit token standing in for the cookie
  jar the wrapper doesn't forward.
- **Import-card and tooltip text rendered soft.** Whole import cards were
  tilted (±0.7°), rasterizing every glyph on a rotated layer, and the tooltip
  bubble was centered with `translateX(-50%)` onto half-pixels. The paste-on
  wobble now lives on a chrome-only underlay with the text stack unrotated,
  and tooltips center by flex layout so their glyphs stay pixel-snapped.
- **User chip mis-sized in the top bars.** The inline-flex chip sat on the
  text baseline of its block wrapper, adding ~6px of phantom descender space —
  it rode high next to the Add pill on desktop and spilled out of the 52px
  mobile bar. The wrapper now centers via flex and the desktop chip matches
  the Add pill's 38px exactly.
- **`npm run dev` API proxy.** The Vite dev proxy still listed the pre-`/api`
  route prefixes, so every API call from the dev server fell through to the
  SPA fallback.

## [0.6.7] - 2026-07-17

### Added
- **Force-fetch & re-verify metadata, review before apply (ROADMAP §2).** A
  deliberate "re-check everything" pass over a selection of books, films/shows
  and saved people: each item's lookup re-runs against the live sources —
  targeting its **pinned identity** (ISBN/ASIN/Google id, TMDB/TheTVDB id, the
  stored cast / Open Library key) so it re-checks the same entity instead of
  re-guessing by name — and every changed field (title, author/director,
  description, year, genres, series, cast, cover/poster/portrait, identity ids)
  is presented stored-vs-fresh for **field-by-field approval**. Nothing is
  written until confirmed; pure fills come pre-ticked, overwrites don't.
  Desktop: a *Re-verify…* action on the Books/Films selections and a *Re-verify
  saved* on the People console. Phones: one *Re-verify metadata* action over
  every pinned item, with the same review sheet. New
  `POST /metadata/reverify` (preview, writes nothing) and
  `POST /metadata/reverify/apply` (approved fields only, per-item isolation; a
  failed image download degrades to a note instead of blocking text fields).
- **Multi-author separation (ROADMAP §11).** A joined credit like
  "Gaiman & Pratchett" or "Smith, Jones, and Lee" now lists as **distinct
  people** — in Library/Search author group-bys, the book detail's author line
  (one clickable name each) and the People console — each resolving and
  pinning their own portrait and reference links. The stored credit string on
  the book itself stays verbatim. Guards: a single name containing "and"
  ("Daniels and Sons") never splits, suffixes ("King, Jr.") stay attached, and
  the Oxford comma is understood. **Settings → Multi-author credits** picks
  which separators apply (comma · semicolon · & · "and") — turn comma off if
  your library stores authors as "Last, First" — or turns splitting off
  entirely. *Rename everywhere* is now component-aware: renaming one author
  inside a joined credit splices just that name, byte-for-byte preserving
  co-authors, separators and "et al." markers.
- **Quick capture now captures dialogues too.** The ＋ capture sheet's book
  dropdown is replaced by a **search picker** across every book, film and show
  (type to filter, kind-tagged rows, keyboard navigation), with an inline
  **"add as a new book"** quick-create when the title isn't in the library
  yet. Capturing against a film/show saves a dialogue (character + timestamp
  fields; the actor auto-fills from the cast).
- **Home favourites carry the full quote toolkit.** An expanded favourite tile
  now has the same ♥ · share · edit · delete cluster as the detail-screen
  cards (hover-revealed on desktop, a ⋯ menu on phones), with the share sheet
  and the real inline edit form — plus the existing *Open book/film/show*.
- **"Where you stand" updates live.** Every Daily Quiz *and* Practice answer
  refreshes the remembered/forgetting/probably-forgotten/unseen counts
  immediately (`POST /review/answer` now returns the fresh counts).
- **Icon-only top nav at intermediate widths.** When a smaller desktop window
  would clip the labelled tabs behind the ＋ Add button, the nav collapses to
  icons (and expands back once there's room) — measured off the actual
  overflow, not a fixed breakpoint.

### Changed
- **Navbar simplification.** Tags and Metadata now always sit in the top bar's
  utility group — the Settings "Interface" toggle (and its `navUtilities`
  preference) is retired, and the mobile drawer moves Tags into the bottom
  utility group to match. The Settings "Metadata sources" card also drops its
  redundant single-shot *Re-fetch missing* button (the Metadata tab's chunked,
  progress-bar version is the real tool).
- **Settings layout.** Accent and the two cover-size sliders share one row on
  desktop.
- **Person popup.** The obsolete links-only "back to links" view is gone — the
  details view already carries the clickable reference chips — and *refetch
  links* moved into it. Long bios clamp to three lines with a *show more*.
- **People console names are clickable**, opening the same person popup used
  everywhere else; the mobile Metadata header gains an info-dot noting the
  full console lives in the desktop view.

### Fixed
- **Mobile PNG share produced a corrupt file with a hash filename.** The
  quote-card image now goes through the native share sheet on phones (a named
  `tippani-quote.png`, save to Photos or share onward); the desktop download
  is unchanged. Root causes fixed everywhere blobs are saved: the blob URL was
  revoked before the (asynchronous) mobile save finished — truncating the file
  — and iOS/PWA saves ignore the download filename on blob URLs.
- **Daily Quiz / Practice session tallies never incremented** during a session
  (the "N recalled · M to resurface" line and the practice round score were
  stuck at their opening values).
- **Mobile drawer:** the page behind it no longer scrolls while it's open, and
  a left swipe closes it (no swipe-to-open — the screen edge stays the
  system's back gesture).

### Security
- No new exposure: both re-verify endpoints are session-scoped to the caller's
  own rows with whitelisted, validated fields; provider calls remain on-demand
  only. CSP `img-src` additionally allows Wikimedia hosts so a fresh author
  portrait can be previewed before it's approved.

## [0.6.6] - 2026-07-16

### Fixed
- **Silent cover/poster/image fetch failures on edit.** Updating a book's cover,
  a movie's poster, or a person's image now logs the real cause
  (`TIP-BOOK-003`, `TIP-MOVIE-003`, `TIP-PEOPLE-002`) when the fetch is
  rejected, instead of only returning the generic "couldn't fetch that image"
  502 with nothing in the logs to diagnose it by.

## [0.6.5] - 2026-07-14

### Added
- **Structured, code-tagged error logging (ROADMAP §12).** Every handled failure
  now logs a stable code of the form `TIP-<SUBSYS>-NNN` (for example
  `TIP-SRCH-002`) to both stdout and stderr. Look any code up in the new
  [`docs/troubleshoot.md`](docs/troubleshoot.md) for its cause and fix. Each
  request also carries a short correlation id so all of its log lines line up.
- **`TIPPANI_LOG_LEVEL=debug`** turns on verbose `[trace]` per-operation logging
  for diagnosing an issue; it is off (quiet) by default, so normal deployments are
  unaffected.

### Fixed
- **A whole class of silent failures.** List endpoints that dropped a row on a
  scan error while still returning `200` — the same failure mode behind the
  disappearing homepage favourites — now log it with a code instead of quietly
  shortening the list. Also surfaced: genres that could silently fail to persist
  (a dropped transaction error), orphaned-people cleanup failures, and swallowed
  cover/poster fetch errors.

## [0.6.4] - 2026-07-14

### Fixed
- **Search no longer stays broken after a corrupt index — it self-heals on the
  spot.** When a live search hit a corrupt full-text index (`database disk image
  is malformed`), the old runtime recovery only ran a bare `rebuild`, which has to
  re-read the same damaged pages and so failed again — every search 500'd until the
  server was restarted. The search path now reconstructs the index the same way
  startup does (drop + recreate + rebuild, discarding the corrupt pages) and
  retries, so search recovers within the same request. No library data is affected
  (the search indexes are derived from your books, quotes, films and dialogues).
- **Homepage favourites could silently disappear entirely.** If any of the three
  requests behind the Favourites grid returned an unexpected non-JSON response
  (e.g. an HTML page from a reverse proxy, or an expired session), the whole
  section vanished instead of degrading gracefully. It's now guarded.

### Changed
- **Hardened the database against the corruption recurring.** The server now shuts
  down gracefully on `SIGTERM`/`docker stop` (and during a self-update): it drains
  in-flight requests, then folds the write-ahead log back into the main database
  file before exiting, so an unclean kill can't leave a torn WAL to corrupt the
  search index on the next boot. Writes also now use `synchronous=FULL` in WAL mode
  to close the torn-write window on volumes that don't guarantee fsync ordering.
- **List endpoints no longer silently drop rows.** A row that fails to scan (a sign
  of schema/query drift) is now logged loudly instead of being quietly skipped with
  a `200`, so "mysteriously empty list" bugs surface immediately.

## [0.6.3] - 2026-07-14

### Added
- **Version → changelog link + update badge (AudioBookshelf-style).** The running
  version is now a link to the GitHub releases/changelog — in **Settings → Updates**
  and at the bottom of the **mobile drawer** (shown to every user). When an admin has
  run *Check for updates* and a newer release exists, an **↑ update to vX** link to
  that release's notes appears in both places (cached for the session). The check
  stays strictly **on demand** — Tippani still never contacts GitHub on its own.
  `GET /auth/me` now returns `releases_url` for this link.

## [0.6.2] - 2026-07-14

### Added
- **Home favourites now cover films & shows too, as a tile grid.** The Favourites
  section merged only book highlights before; it now shows favourited **book quotes
  and film/show dialogues together**, newest first, as two-up tiles (about four,
  with the rest behind **View more**). Each tile is tagged BOOK / FILM / SHOW and
  opens its source. *(This also fixes favourites reading as empty when you'd only
  favourited dialogues, never a book quote.)*
- **"Seeing" reinforcement (opt-in).** A new **srSeen** knob (Settings → Daily quiz
  & practice) lets *seeing* a quote — practising it (not skipping), sharing it, or
  favouriting it — lengthen its memory half-life marginally, separate from Daily
  Quiz recall. Off by default (1.0×), and merely appearing in the Daily Quiz is not
  "seeing". New `POST /review/seen`.
- **Share-image theme picker.** The *Image* share format gains a four-way theme
  dropdown (Paper / Film × Light / Dark) that restyles only the exported image, not
  the app; the choice is remembered per device.

### Changed
- **The manual-update command** shown in Settings → Updates is now
  `docker compose up -d --pull always --force-recreate` — one step that always
  re-pulls the tag and recreates the container.

### Fixed
- **A wrong Daily Quiz answer no longer inflates "remembered".** Statuses read the
  recall probability `2^(-elapsed/half-life)`, but a just-answered card has ~0 days
  elapsed, so *any* fresh answer (right or wrong) read as fully remembered. A lapse
  now correctly reads as **probably forgotten** — on the "where you stand" tally and
  on every quote's status dot — until the next successful recall.
- **Copy buttons work on plain-HTTP self-hosted instances.** The share sheet's
  **Copy** and the update-command copy used the async Clipboard API, which is
  undefined outside a secure context (HTTPS/localhost), so on a LAN-IP HTTP instance
  they silently did nothing. They now fall back to a legacy copy that works over HTTP.

## [0.6.1] - 2026-07-14

### Changed
- **Daily Quiz & Practice are now multiple-choice**, replacing the self-graded
  "show answer" reveal from 0.5.0 (which was awkward, especially for the "which
  quote is from this work?" direction). Both directions are now real MCQs: *which
  work is this quote from?* (pick the title) and *which quote is from this work?*
  (pick the quote). A correct pick counts as **Got it**, a wrong one as **Forgot**;
  Practice still allows **Skip**. The schedule, scores and status dots are
  unchanged — only the interaction.
- **Distractors are chosen to be plausible, not random.** For books, wrong options
  are drawn from other works by the **same author** first, then those sharing the
  **most genres**; for films/shows, by **shared genre** first, then a **shared
  actor** (never the director). Same medium is always preferred over cross-medium.

### Fixed
- **Status dots now show on every quote.** The "not yet reviewed" dot used a border
  colour (`--line`) that was invisible against the card; unseen quotes now show a
  visible hollow grey dot, and reviewed ones their remembered/forgetting/probably-
  forgotten colour.
- **Flaky timezone test.** `TestDailyQuizTimezone` asserted a cross-midnight case
  off the wall clock and could fail depending on the hour CI ran (it broke 0.6.0's
  CI at 03:45 UTC though the code was fine); it now asserts the local-day shift
  deterministically.

### Settings
- The two long descriptor paragraphs in *Daily quiz & practice* collapse into the
  standard info-dot tooltips (the panel's controls already govern both modes: daily
  deck size, review scope, "Practice moves the schedule", and the half-life factors).

## [0.6.0] - 2026-07-14

### Added
- **In-app updates (Settings → Updates, admin).** The build version is now stamped
  into the binary (`buildinfo.Version`, via `-ldflags -X`; logged at startup and
  printed by `tippani version`) and surfaced in Settings. **Check for updates**
  queries the latest GitHub release **on demand** — Tippani never contacts GitHub on
  its own — and reports whether you're up to date.
- **One-click update via the Docker socket (opt-in).** When the Docker socket is
  mounted (a documented, deliberate security trade-off in `docker-compose.yml`), the
  card offers **Update & restart now** (admin, typed `UPDATE` confirm): it pulls the
  new image and recreates the container with a one-shot Watchtower — which copies the
  existing config so the data volume, ports and env survive — then the page waits for
  the app to come back and reloads. Works when you track a moving tag (`:latest`).
  Without the socket it shows the exact `docker compose pull && docker compose up -d`
  to run by hand. New `GET /admin/update/check`, `POST /admin/update/apply`.

## [0.5.0] - 2026-07-13

Spaced-repetition rework: two clear modes, films & shows as first-class review
material, and a status dot on every quote.

### Added
- **Daily Quiz & Practice.** The learning surface is now two modes sharing one
  retrieval flow — *present → attempt recall → reveal → grade*:
  - **Daily Quiz** — the scheduled session: every card due that day, **no skipping**,
    each grade folded into the schedule, with a **permanent daily score and streak**.
  - **Practice** — **unlimited, skippable** study across your whole library that by
    default **does not touch the schedule** (a Settings toggle, *Practice moves the
    schedule*, opts in), with a **separate, resettable score**.
- **Two question directions**, in both modes and over books **and** films/shows: *which
  work is this quote from?* and *recall a quote from this work*.
- **Status dots on every quote** in the Library and the Catalogue — 🟢 **remembered**,
  🟡 **forgetting**, 🔴 **probably forgotten** (a hollow dot until first reviewed) —
  derived live from recall probability $p = 2^{-t/h}$. Hovering a dot shows the card's
  memory half-life and when it next comes due, like the Settings info dots.
- **Films & shows are now first-class review items.** Dialogue lines enter the deck,
  grade, and carry a status dot exactly like book quotes; the review **scope**
  (books / films & shows / both) governs both modes.

### Changed
- **Repetition statuses renamed** from soon / later / someday to **remembered /
  forgetting / probably forgotten** — describing whether you can recall a quote *now*
  rather than the raw half-life bucket.
- **Review API** consolidated to `GET /review/daily`, `GET /review/practice`,
  `POST /review/answer` (mode-aware), `GET /review/scores`, and
  `DELETE /review/practice`, replacing the old `/annotations/daily-review`,
  `/annotations/{id}/review` and `/annotations/quiz*` routes.
- **Settings** now reads *Daily quiz cards / day*, *Review covers* (books / films &
  shows / both), *Practice moves the schedule*, and the half-life growth/lapse factors;
  the annotation & dialogue list responses gained `reviewed` / `stability` /
  `last_reviewed_at` for the status dots.

### Removed
- **The multiple-choice recall quiz.** Retrieval is now self-graded in both modes
  (honest recall is the point of spaced repetition), so the MCQ round, its distractor
  machinery and the `srQuizLen` / `srQuizScope` preferences are gone.

### Migration
- `0015_review_rework` replaces `annotation_reviews` with a polymorphic `item_reviews`
  (books + films/shows), **carrying every existing book half-life forward** — no
  schedule is lost. Parent-delete cleanup moves from `ON DELETE CASCADE` to triggers.
  The old `quiz_results` table is replaced by `quiz_sessions` (per-day, per-mode); the
  previous multiple-choice score history does not map onto the new model and is not
  carried over. The schedule itself is fully preserved.

## [0.4.7] - 2026-07-13

### Fixed
- **Search corruption now recovers even when `DROP TABLE` fails — with no data loss.**
  0.4.6's startup repair rebuilt a corrupt index by dropping and recreating it, but a
  badly-corrupt index makes even `DROP TABLE` raise `database disk image is malformed`
  (the repair logged "reconstruction FAILED" and gave up). The repair now escalates to
  a **data-preserving whole-database rebuild**: it copies every intact base table into
  a fresh database file and lets the sync triggers repopulate the search indexes,
  **never reading the corrupt pages**. It runs automatically at startup and on demand
  via Profile → *Rebuild search index* (which now falls back to this recovery too).
  The search indexes are derived data, so every book, quote, film, dialogue, tag,
  person, setting and preference is preserved. Verified against a reproduction of the
  exact failure — structural page corruption of the `annotations_fts` b-tree where both
  MATCH and DROP raise SQLITE_CORRUPT.

## [0.4.6] - 2026-07-13

### Added
- **Startup database health checks.** On boot Tippani now runs `PRAGMA quick_check`
  over the whole database and an FTS `integrity-check` on each search index, logging
  the outcome to **both stdout and stderr**. Real corruption is alerted loudly so it
  can't be missed in the container logs.
- **Self-healing search indexes.** A corrupt full-text index (SQLite
  `database disk image is malformed`) is rebuilt automatically at startup from the
  intact base tables — the search data is *derived*, so nothing is lost. An in-place
  `rebuild` can't fix page-level corruption (it re-reads the same bad pages), so the
  repair drops and recreates the index (schema-driven, DDL read from the live schema).
- **Profile → Maintenance (admin).** *Rebuild search index* runs that same
  non-destructive repair on demand (fixes "search failed / internal error" without a
  restart or any data loss). *Reset all data* is a guarded factory reset — it deletes
  the database **file** (row/table deletes are blocked by a corrupt index) and
  re-initialises an empty schema, returning the app to first-run admin-account
  creation. New endpoints `POST /admin/search/reindex` and `POST /admin/reset`
  (the reset requires `{"confirm":"RESET"}`).

### Fixed
- **Search "internal error" from a corrupt index** now recovers instead of 500ing
  indefinitely: the index self-heals on the next boot, or immediately via Profile →
  *Rebuild search index*. Settings (metadata keys) and preferences live in tables, so
  a full reset clears them too — the Reset warning says so.

## [0.4.5] - 2026-07-13

### Fixed
- **Bundled fonts no longer blocked by the CSP.** Vite inlines small `@fontsource`
  subset files (< 4 KB) as `data:` URIs, which the `default-src 'self'` policy
  rejected — so those glyphs silently fell back to a system face (and the browser
  console filled with CSP errors). The Content-Security-Policy now allows
  `font-src 'self' data:` (data: fonts are inert, same rationale as the existing
  `data:` image allowance). This also unblocks the fonts the quote-card image
  renderer relies on.

## [0.4.4] - 2026-07-13

### Changed
- **One look-up card for books, films and shows.** The Add surface is now two tabs
  — *Look up / add* and *Import files*. *Look up / add* is a single card with a
  **Book · Film · Show** toggle, one search box and an optional year, replacing the
  separate book / film sections that each carried their own look-up ↔ manual switch.
  Manual entry is no longer a sibling mode: a **"Can't find it? Add manually"** link
  opens a hand-entry popup for the chosen kind.
- **Import instructions are now tooltips.** Each import source card's step-by-step
  "how to save the page" instructions moved into the standard info-dot tooltip (the
  same one used across Settings), so the cards read at a glance; the one-line
  description stays visible.
- **Stripped-down mobile Metadata screen.** On phones the Metadata tab is now a
  maintenance screen — *fetch covers & metadata* (fill-empty only, never replacing
  stored art), *scan for duplicates*, *speaker remap*, and *people fetch-missing*
  (no browsable list) — with the coverage tiles collapsed into plain text lines. The
  at-scale filterable console stays desktop-only.

### Added
- **`missing_only` on cover refetch.** `POST /covers/refetch` accepts `missing_only`
  to fill empty covers/posters and details without upgrading stored low-res art — the
  "no replacement" mode the mobile Metadata screen's one-tap fetch uses.

### Fixed
- **Search no longer fails on a drifted FTS index.** A search that hit a runtime
  SQLite error — an external-content FTS5 index out of sync with its content table —
  returned a bare `search failed` 500 with nothing logged. The handler now logs the
  real cause and self-heals: it rebuilds the affected index once and retries, so
  search recovers on the first query after a deploy instead of staying broken.
- **The ⋯ More menu (Tags · Metadata) is no longer hidden.** On desktop the overflow
  menu rendered inside the horizontally-scrolling top-bar nav, whose overflow clipped
  the dropdown so it appeared behind the page. It now portals to `<body>` and
  positions against its button, so it always sits above the content.
- **The Add surface's import cards no longer overflow.** Embedded in the narrow Add
  modal, the four-column import wall crammed the cards and overflowed their buttons;
  the embedded grid is capped at two columns while the standalone page keeps its wide
  four-up layout.

## [0.4.3] - 2026-07-13

### Added
- **One "＋ Add".** A single Add surface — book · film · import in one modal —
  replaces the standalone Import tab. The top-bar **＋ Add** button, the drawer's
  lead row, and the Library/Catalogue "Add" buttons all open the same surface, so
  there's one obvious way to add anything (an old `/import` link opens it on
  the Import section).
- **Quote-card images.** The share sheet gains an **Image** format beside the text
  ones: a highlight rendered to a shareable PNG in your current paper/film skin,
  generated entirely in the browser (no server, no external calls), with the same
  field-picking as the text formats — download it or copy it to the clipboard.
- **Profile & account management behind the avatar chip.** The chip menu is now
  **Profile · User management · Log out** — a centred pop-up on desktop, a full
  page on phones. *Profile* edits your photo, **display name** (`PUT /auth/me`,
  new) and password in one place; *User management* (admin) adds/removes users and
  **grants/revokes admin** (`PATCH /admin/users/{id}`, new) — handing over the
  primary admin is grant-another-then-revoke-your-own, with the last admin
  protected. Avatar upload + password + user management move out of Settings.
- **Configurable spaced repetition** (Settings › *Daily review & quiz*): per-user
  review cards/day (2–10), quiz length (2–10), quiz scope (books/films/both), and
  the half-life growth (1.5–4×) and lapse-keep (0.1–0.6×) factors. `/auth/me/preferences`
  is now a partial merge, so each setting saves without disturbing the others.
- **Configurable desktop nav** (Settings › *Interface*): Tags + Metadata as navbar
  tabs or folded into a ⋯ More menu; the account chip stays separate.
- **Automated GitHub Releases** — `release.yml` cuts a Release from the matching
  CHANGELOG section on every `v*` tag (the docker workflow already publishes the
  image); runnable by hand to backfill.

### Changed
- **Progressive disclosure on quote cards.** A card shows only its favourite ♥ at
  rest; on desktop, hovering reveals *share · edit · delete* inline, and on a phone
  they fold behind a single ⋯ overflow — so a masonry of cards sheds its standing
  button rows (delete keeps its confirm).
- **Compact edit forms (books & films).** Cover controls collapse to icon buttons
  with tooltips (upload · fetch metadata · paste URL · search covers · remove), and
  **"Fetch metadata" now opens the edition/version picker** to choose the right
  match instead of silently applying a guess — folding in the old "Browse other
  matches" button.
- **Favourite-only.** The 1–5 star rating is gone from the UI everywhere — cards,
  detail headers, filters, sort, tables and the share sheet; the favourite ♥ is the
  single quick signal. Stored ratings stay in the DB but hidden (no destructive
  migration).
- Cover/image upload cap raised **5 MB → 10 MB** so hi-res covers upload.

### Fixed
- **Quiz answer colours** — a correct answer shows a distinct green (`--ok`), no
  longer the terracotta accent that read the same as the red for a wrong pick.
- **Metadata progress bars** — the covers/metadata refetch bar now paints even for
  a single-chunk run (an indeterminate mode); the People-console bar reads on the
  film-dark backdrop instead of looking like a floating line.
- **Book-save failures are logged** (method · path · cause) instead of being
  swallowed behind a bare "internal error".

## [0.4.2] - 2026-07-12

### Added
- **Merge duplicate authors / actors.** The Metadata → People console flags near-identical names —
  typos and transliterations like *Fyodor Dostoevsky* vs *Fyodor Dostoyevsky* — as **Possible
  duplicate** cards; choose the spelling to keep and one click rewrites the others across every book /
  film and folds their saved metadata in. The author/actor edit card gains a **"Rename everywhere"**
  action for the same, one person at a time. New `POST /people/rename`.

### Changed
- **Orphaned author/actor metadata is now swept automatically.** Opening the People console clears
  saved rows whose name no longer appears on any book or dialogue (they previously lingered until the
  next book edit triggered the sweep) — still no background job; it runs on load.

## [0.4.1] - 2026-07-12

### Changed
- **Only a correct quiz answer counts as a revision.** A wrong guess is now a no-op — it no longer
  shrinks (or otherwise moves) the spaced-repetition schedule. The daily review's *Got it / Forgot /
  Skip* semantics are unchanged.

### Fixed
- **Portraits resolve the right person everywhere, not only in the modal.** The Metadata → People
  console — both per-row and the "Fetch missing" bulk — now goes through the disambiguating portrait
  path (`/people/portrait`) instead of the old name + work-count lookup, so it no longer grabs the
  wrong same-name person (the more-published "David Reich") and now fetches **photos**, not just links.
  "Fetch missing" also covers people who have links but still no photo.
- **Author photos & links reach Wikidata even when the Open Library record is sparse** (no photo, no
  wikidata link): the author's Wikidata identity is resolved by anchoring on a book they wrote
  (work → author P50), yielding the correct Wikipedia link and a P18 photo where one exists. (Some
  authors — David Reich among them — have no freely-licensed photo anywhere, so the initial is kept;
  the identity and links are now correct regardless.)
- **Higher-resolution book covers.** Cover re-fetch now tries Amazon's keyless full-size cover CDN
  first (via the book's ISBN-10, which is Amazon's image key), upgrading covers that were previously
  only available as Google / Open Library thumbnails.

## [0.4.0] - 2026-07-12

### Added
- **Automatic author & actor portraits, with correct-person disambiguation.** Photos are now fetched
  on demand from the library's own catalogue instead of only pasted by hand: an **actor** from the
  film's stored cast — the supplier's person id + headshot are now captured in the credits call the
  movie fetch already makes, so resolving a portrait costs **no extra API call** — and an **author**
  via Open Library, disambiguated by the books they actually wrote so a same-name namesake is no longer
  fetched (e.g. the wrong "David Reich"), with a Wikidata P18 photo fallback. The resolved identity is
  pinned on the person (`people.source_id`) so it can't re-drift, an author's reference links come from
  that same identity, and the manual Photo URL field still overrides. New `POST /people/portrait`; hosts
  `commons.wikimedia.org` + `upload.wikimedia.org` added to the cover allowlist for P18 images.
- **Book lookup matches on title _and_ author.** `/books/lookup` now takes an optional author and queries
  Google Books (`intitle:… inauthor:…`) and Open Library (`title=&author=`) accordingly, then ranks the
  merged candidates by title+author similarity — so the edition you meant sorts above box-sets, study
  guides and foreign reprints a title-only search surfaced first. Author-scoping falls back to title-only
  if it over-constrains, and cover re-fetch passes the stored author too.
- **Recall quiz** (roadmap №2): a Home quiz card builds mastery-weighted MCQ rounds from your own
  library — match a quote to its book (genre-preferring distractors) or a line to its actor; each
  answer is folded into its review schedule the moment it's given (so an abandoned round still
  credits what you answered), and a running score can be cleared
  (`GET /annotations/quiz`, `POST /annotations/quiz/answer`, `POST /annotations/quiz/submit`,
  `/quiz/stats`, `DELETE /quiz/results`; migration 0014 `quiz_results`)
- **Revision-state readout** on the Daily Review card (unseen / soon / later / someday) with a
  "how these work" explainer linking the forgetting-curve and spaced-repetition research
- **Full-screen cover inspector**: tap a book cover / movie poster on its detail page to view it
  full-screen (× · Escape · backdrop · Android back gesture)
- **Home favourites**: the full favourites list (newest first), 5 shown with "Show more"; a card
  expands in place (note · tags · location) with an "Open book" button
- **Cover search shows resolution**: candidate covers display their pixel size, low-res ones are
  dimmed; Google Books renders larger (`fife=w1280-h1920`) and more options are offered; the
  book/movie look-up matches render as a compact card grid
- Metadata console: a **low-res** cover/poster count + filter; the cover re-fetch now reports
  `skipped` (kept — no higher-res source) so a partial run is explained
- **Home screen** with Daily Review, quick capture, stat tiles and favourites (desktop + mobile),
  now with a Home entry on the desktop navbar; Metadata + Settings moved onto the navbar too
- PWA: web app manifest + icons, `viewport-fit=cover` + safe-area insets, theme-color meta
- Author/actor edit: labelled reference links (Open Library etc.), a "one link per line" tip, a
  photo image-search shortcut, and a details-first view when a name is clicked
- **Spaced repetition — daily review** (roadmap №2): a Daily Review card on the new Home screen
  resurfaces your own highlights on a forgetting-curve schedule — per-annotation memory half-life,
  recall probability decaying in SQL at query time (no jobs, no cron), *Got it / Forgot / skip*
  answers, mastery (soon / later / someday), a timezone-aware daily deck capped at 8 cards, and a
  pending-review dot on the logo and drawer. `GET /annotations/daily-review` +
  `POST /annotations/{id}/review`; review state lives in its own table (migration 0013) so edits
  and heart-toggles never disturb the schedule
- **Home screen** — date + greeting, the Daily Review card, a quick-capture tile, book/film stat
  tiles, and the two most recent favourites; it is the landing view (`/`) on desktop and mobile,
  reached any time by tapping the logo
- **Quick capture** — a ＋ in the mobile top bar (and the Home tile everywhere) opens a
  capture sheet: book, quote, note, chapter/location, comma-separated tags, colour
- **PWA install** — web app manifest + generated icons (incl. maskable), `viewport-fit=cover`,
  safe-area insets on the shell bars and full-screen sheets, theme-colour meta
- Toast feedback primitive (ink-on-cream pill); wired on capture, review, and sign-in
- `GET /annotations` rows now carry `book_title` / `book_author` for cross-book lists
- **People link out** — clicking any author/actor name opens a redirect menu of their
  IMDb · TMDB · TheTVDB · Wikipedia · Open Library pages, auto-resolved on first open
  (`POST /people/lookup`, Wikipedia via Wikidata); a **People console** under Metadata
  lists everyone referenced in the library with link status, per-row and bulk fetch
  (`GET /people/names`)
- **Fetch-metadata progress bar** — `POST /covers/refetch` is chunked (cursor/limit →
  next_cursor/done/total/remaining); the Metadata page loops chunks and shows real progress
- Import promoted into the primary nav
- Mobile filter sheets: labeled full-width controls with a shared Reset · count · Done footer;
  Library gained its missing mobile add-book entry
- Tags page: New-tag and New-sticker add-cards lead the page (2 columns on desktop)

### Changed
- **Mobile shell** — primary navigation moved from the bottom tab bar to a hamburger **drawer**
  (nav + counts + account + log out); a slim sticky top bar carries ☰ · logo → Home · ＋ capture ·
  search · avatar, and detail screens swap it for their own back + title bar
- The **start-page setting is retired** (Home is the start page); stored `home` preference keys
  and older clients still sending one are ignored
- **Hi-res covers** — TMDB stored posters use `original` (thumbnails stay w342), Google Books
  covers upgraded via `fife` renders, Amazon size modifier dropped for full-size scans; cover
  fetch cap raised to 5 MB (upload envelope 6 MB)
- Library page header retitled "Books"; brand mark enlarged to match the nav icons
- Add-annotation/dialogue box moved above the list on detail pages
- The read-only demo now ships realistic fixtures (covers, stickers, people links) and honours
  detail-page filters, search scopes, and search group-by — and its daily-review deck is
  playable (session-only)

### Removed
- Bottom navigation bar and the Settings "Start page" toggle (superseded by the drawer + Home)

### Fixed
- **Blank-screen crashes** — an app-wide ErrorBoundary now shows the actual error instead of a
  white screen; fixed a `share.jsx` ES2018 regex lookbehind (older Android WebView / Safari
  couldn't construct it) and missing `coverImgURL` imports in `ui.jsx` and `SearchPage.jsx` that
  blanked book detail / search whenever a cover rendered
- Editing or removing an author/actor cleans up the old name's orphaned people metadata (was
  lingering in the DB and the Metadata console)
- Manual year fields (books, movies, author "born") accept only a 4-digit year
- OpenLibrary covers never stored (their `archive.org` redirect targets were rejected by the
  SSRF allowlist); TheTVDB posters never stored (`artworks.thetvdb.com` missing from the allowlist)
- Mobile annotation cards overflowing the viewport; sticky page bar floating below the top of
  the screen; five nav tabs now fit a 320 px viewport
- Settings → Users showed every user's initial instead of their uploaded profile photo
  (the admin user list never returned `avatar_path`)

## [0.3.1] - 2026-07-07

### Changed
- **Mobile UI overhaul** — comprehensive responsive redesign for PWA-first experience
  - Bottom navigation bar on small screens; tabs repositioned from top
  - Detail sheets for Library & Movies with improved touch interaction
  - Fixed horizontal scroll and viewport-aware column counts across views
  - Share dialog refinements and responsive cover grid defaults
  - User chip menu restored with Settings access and corrected click targets
  - Unified bottom bar styling and fixed mobile nav crashes
  - Overflow menus for detail panes on constrained viewports

### Fixed
- Navigation stability on mobile devices (eliminated crash scenarios)
- Dead click targets in user menu and detail overlays
- Unintended horizontal scrolling and layout overflow issues

## [0.3.0] - 2026-06-20

### Added
- Author & actor metadata — panel UI, group-by portraits, name-keyed store with CRUD
- Search group-by — filter by series, author, decade, or genre
- Quote sharing across 4 formats (Rich Markdown, WhatsApp, plain text, Reddit)
- Library group-by functionality for better organization
- Dithered hand-card gradients to eliminate 8-bit banding
- Readability improvements — bold people, italic works, clearer dates in share

### Changed
- TMDB API key is now UI-managed instead of env-var configured

### Fixed
- Various styling and rendering issues

## [0.2.1] - 2026-03-15

### Added
- Initial public release features
- Multi-user support with per-user isolated libraries
- Book & movie management with full metadata

## [0.2.0] - 2026-03-10

### Added
- Core functionality — books, movies, quotes, and imports

## [0.1.0] - 2026-01-01

### Added
- Project foundation
