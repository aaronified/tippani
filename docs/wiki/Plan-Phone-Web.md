# Plan: the web app, stripped to what an iPhone needs

Source of truth: this wiki page. Designed, not built. Checked at commit `54e2ac2c` (3.10.1).

**Why.** The Android app is the full client. The web app's remaining job is the iPhone, where it is installed as a PWA. The owner,
23 November 2026: "Pwa should be about basic stuff for iphone users. Android users will have the app. We need to strip it down to
basics." Decisions are in [ADR-0936](ADR-0936-The-Web-App-Is-The-iPhone-Client-And-Is-Stripped-To-Eight-Jobs.md).

## What stays

1. Add a quote or a work, with all its details.
2. Edit them.
3. Check and edit a quote's context.
4. Search metadata and edit it.
5. Share quotes.
6. Check and copy the server logs.
7. Check the version and update the server.
8. The Checks screen, **Marks and Files tabs**.

Also kept, by the owner's ruling on 23 November: the **Library, Catalogue and Quotes lists**, **Anthologies**, **Boards** and their
pickers, the **duplicate-merge panel** under Metadata, **Bengali**, and the **desktop layout**.

## What goes

| Area | Goes | Stays inside it |
|---|---|---|
| Theme | Material set picker, true glass, physics dials, per-slot tiles, saved looks, theme file import and export, button-labels row, cover and poster size sliders | One theme dropdown (like Office's colour theme picker) and light/dark |
| Settings | Font picker and uploads, Review section, Sections show/hide and reorder, language marks and voices, reading fields | Language |
| Server settings | Backup and restore, library folders, paired devices, changelog list, Jobs cards (current, common, past) | Logs, Updates |
| Home | Quiz, practice, favourites, serendipity, memory strip, count tiles, greetings | A start page: Add, Search, recent |
| Lists | Group-by, table and grid variants, filters, multi-select and the bulk bar (the owner: "multi edit can go") | One list view, favourites toggle, basic sort |
| Screens | Stats, Bin, Tags and colour categories, Review and its answer queue, Imports tab, file import | |
| People, characters | Nothing: people and character editing stay (owner, 23 November) | Consoles, identity panels, portraits |
| Work extras | Links panel, read log, progress editor | Cast and character editing, series fields |
| Quote extras | Stickers, frame and crop editor, card-menu extras | Edit, context, share |
| Metadata | Languages, categories, people, characters, source-files sections | Works, duplicate merge, keys |
| Account | Avatar, single sign-on setup, notifications, widget key, user management, database reset | Sign in, sign out, password |
| Help | The tour, help entries, keyboard shortcuts, gesture illustrations, demo mode, print styles | |
| Weight | Textures, fonts beyond the system face and one Bengali face, `iso639` pair data if unused | |

## Added

A service worker (the app has none), `apple-mobile-web-app-capable` and its status-bar meta, and a splash image.

## Status, 23 November

Built on `claude/relaxed-hopper-15k6h7`: Stats, Bin, review and quiz, Home as a start page, Tags, Imports, the Theme page as a
dropdown, Settings reduced to Theme, Language and Server, Server settings (backup, devices, folders, jobs, changelog), account
extras, colour categories, multi-select and the bulk bar, list extras, quote-card menu extras (copy, duplicate, move), read log
and progress editor, the tour, gestures and shortcut legend, bundled typefaces other than Noto Serif Bengali, unused textures,
and a service worker with the iOS meta tags.

**Left, and why:** stickers and the frame/crop editor (the editor also drives the cover picker and character portraits);
the links panel (its form host also holds the external-id editor); demo mode (the public Pages demo builds from it, so
removing it also removes that deploy); print styles (the anthology Print action uses them); OpenDyslexic (removed with the
fonts, and it is an access option you may want back); `@fontsource` packages still listed in `package.json`.

## Tasks, in order

1. **Re-verify this page.** `git diff --stat 54e2ac2c..HEAD -- web/frontend/src docs/wiki`, then search each file named here
   (`Settings.jsx`, `AddSurface.jsx`, `jobsSection.jsx`, `ChecksPage.jsx`) for the anchor it is cited by. Correct the page first.
2. **Measure.** Record dist size and per-chunk gzip before any cut; every later task states what it saved.
3. **Replace the Theme page** with the dropdown. Smallest cut with the clearest effect; settles how a theme is stored.
4. **Cut the whole screens** (Stats, Bin, Tags, Review, Imports, file import), their routes, their help and their i18n strings.
5. **Cut Home down** to the start page.
6. **Trim the lists**: group-by, variants, selection and bulk.
7. **Cut people and characters** consoles, then work and quote extras. `AddSurface.jsx` imports `ManualTab` from `Library.jsx`
   and `ManualMovie` from `Movies.jsx`; check what else those modules pull in before deleting around them.
8. **Cut Settings and Server settings** to the kept sections.
9. **Trim fonts, textures and strings**, then add the service worker and iOS meta.
10. **Retire the scanners** that covered deleted ground; a rule with nothing left to scan is deleted, not left green.

Each task is one commit with its tests, changelog entry and wiki updates. The journeys for the eight jobs are written **before**
the cuts and must stay green through every task; each is mutation-checked as the repo requires.

## Left for the owner

- Where this sits in [the queue](Plans-Index.md). It is listed after the existing three until the owner places it.
- Whether the Android app keeps parity with the web on anything being cut. This plan changes the web only.

See also: [Plans index](Plans-Index.md) · [Roadmap](Roadmap.md) · [Home](Home.md)
