# Plan: the server's web pages rebuilt on Astryx

Source of truth: this wiki page. Designed, not built. Checked at commit `21d27615` (the web strip's branch) and the spike at `5416fb28`.

**The owner, 27 November 2026.** The server release waits for this. It is for the **server's web pages, desktop and PWA**, and **not for the Android app**. The spike's **variant B** is the direction: the app's own material slots, drawn on Astryx components through a token bridge. The spike's known gaps, clipping at large text and no Bengali, are **fixed as part of the redesign**. It covers **every screen the web strip keeps**.

## What Astryx is, as read

| Fact | Evidence |
|---|---|
| `@astryxdesign/core` 0.7.17, MIT, from Meta (`github.com/meta/astryx`), built on StyleX; a neutral theme package beside it | `spike/node_modules/@astryxdesign/core/package.json` |
| Pre-1.0: the README says the API moves, and the spike pins exact versions | `README.md` |
| 31 UI locales ship with it (including Arabic and Hebrew) and **none is Bengali** | `core/locales/` |
| A large package (47 MB installed; the browser build is smaller, **not yet measured** here) | `du` of the install |
| Spike B reached the real prefs API with its material slots (`--surf-*`) on Astryx components in about 50 lines of bridge for one page | the spike commit |
| The ADR for the strip records what the spike found: clipping at large text, no Bengali, a larger bundle | [ADR-0936](ADR-0936-The-Web-App-Is-The-iPhone-Client-And-Is-Stripped-To-Eight-Jobs.md) |

## What there is to rebuild

On the strip's branch the web frontend is **68 component files and about 83,000 lines** (`web/frontend/src`). One file carries the whole shared layer: `ui.jsx`, **11,955 lines**, imported by 59 of the others (hooks for scroll, sheets and the screen bar; `Scroller`, `Card`, `BulkBar`, the button kinds and the rest). That is where the leverage is.

## Design

1. **Rebuild the shared layer, not 68 screens.** Each primitive in `ui.jsx` is reimplemented on the Astryx component that does its job, keeping its name and props. A screen then changes when the primitive underneath it changes, and the screens' own markup is touched only where a primitive has no Astryx equivalent.
2. **The token bridge** maps the material slots to Astryx's theme tokens in one file, so a material set (and the type dials, and light and dark) reach every Astryx component. The bridge is the one place that knows both vocabularies.
3. **Standing UI rules still bind** (`CLAUDE.md`): every dropdown is the app's own `Select`, so Astryx's selector is used only underneath it; glyphs are the app's own, so Astryx components get the app's icons passed in; an edge fade means it scrolls (`Scroller`); spacing is `var(--edge)` and `var(--row)`; every font size answers the type dials; no box that holds text is measured in px. The existing ratchets (`npm run lint:rules`) are the check, and none is loosened.
4. **Bengali.** Astryx's own strings (dialog and control labels it speaks) come from its `en.json`. The bridge supplies a Bengali table for the same keys and the app's locale selects it. A screen is not done until it renders in Bengali with no Astryx string left in English.
5. **Large text.** The spike clipped at large text. The cause is found in T0 (a fixed size inside Astryx or in the bridge), and the fix is part of the bridge, not a per-screen patch. A screen is not done until `make typescale` is clean on it.
6. **The bundle has a budget**, set from T0's measurement of the current build and the spike's, and checked in CI so it cannot grow silently. The 12 MB `web/dist` is the number to beat, and the strip is already cutting it.
7. **Desktop and PWA** share the components; the shell has a sidebar at desktop width and a bottom bar at phone width, as the app's `AppShell`-style layout allows.

## Tasks

Sizes: S under a day, M a few days, L about a week or more. A task is not done until its acceptance passes and a journey that uses it was run with its decisive action removed and failed.

- [ ] **T0 · Re-verify and measure (S).** Re-find every citation above at the build commit. Build the spike and the current frontend and record bundle sizes (gzipped and raw) in this page. Reproduce the large-text clipping and name its cause. List every Astryx string and its key for the Bengali table. Check that StyleX builds inside the repo's Vite and Tailwind setup.
- [ ] **T1 · The bridge and the provider (M).** Install Astryx in `web/frontend` (pinned exactly), one token bridge file, the theme provider at the root, the Bengali string table, and the type dials wired. Acceptance: a test page renders a button, a field, a dialog and a select in light, dark, large text and Bengali with nothing clipped and no English Astryx string.
- [ ] **T2 · The shell (M).** Sidebar at desktop width, bottom bar at phone width, the screen bar and crumb. Acceptance: every route reaches its screen on both layouts; the journeys that press the navigation pass.
- [ ] **T3 · Primitives, group by group (L).** `ui.jsx` rebuilt on Astryx in groups: buttons and chips, cards and lists, fields and selects, dialogs and sheets, menus, tabs, toasts and the rest. After each group the whole suite runs.
- [ ] **T4 · Screens (L).** In use order: Add and Edit, Library, Catalogue and Quotes, work and quote detail, Search, Metadata, Anthologies and Boards, Checks (Marks and Files), Settings (Theme, Language, Server), Logs and Updates, Home. Each is checked against a real backup at 390 and 1280 px, light and dark, in English and Bengali.
- [ ] **T5 · Retire what the old layer left (S).** Dead styles and ratchet counts that fell; the glossary regenerated; Developing's map updated.
- [ ] **T6 · Release.** The server release (see [Releasing](Releasing.md)), as one version.

## Open questions

| # | Question | Recommended | Cost of the other |
|---|---|---|---|
| A-1 | Pin Astryx exactly and upgrade by hand | Yes | A floating version breaks a 0.x API on an install |
| A-2 | If large text or Bengali cannot be fixed in the bridge, patch Astryx locally or choose another component for that primitive | Another component for that one primitive | A patched copy has to be kept in step |
| A-3 | The old layer stays until T3 is done, or each group is swapped as it lands | Swapped as it lands | A long period with two layers in the bundle |

See also: [Plans index](Plans-Index.md) · [Plan: the web app, stripped](Plan-Phone-Web.md) · [Developing](Developing.md) · [Releasing](Releasing.md)
