# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Not yet (handoff)
- **Dialogues in the daily-review *deck*.** The quiz already covers dialogues; the
  daily review is still annotations-only. The `srReviewScope` pref is stored and
  forward-compatible — see ROADMAP "Dialogues in the daily-review deck" for the plan
  (migration `0015_dialogue_reviews`, a scope-gated UNION deck, `POST
  /dialogues/{id}/review`, and surfacing review scope in Settings).

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
