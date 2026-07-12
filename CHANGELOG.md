# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
