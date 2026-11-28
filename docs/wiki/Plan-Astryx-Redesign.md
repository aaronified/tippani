# Plan: standard elements on Astryx for the server's web pages

Source of truth: this wiki page. Designed, not built. Checked at commit `d792e061` (the web strip's branch) and the spike at `5416fb28`. The file keeps its old name, `Plan-Astryx-Redesign`, so links do not break; it is a standardisation, not a redesign.

**The owner, 27 and 28 November 2026.** The server release waits for this. It is for the **server's web pages, desktop and PWA**, and **not for the Android app**. Direction: the spike's **variant B** (the app's own material slots on Astryx components). Large-text clipping and Bengali are **fixed as part of it**. It covers **every screen the web strip keeps**. And, on 28 November: *"The redesign is to be for standardisation. Not for complete overhaul. Everything remains the same. Just with standardized elements."*

## What "everything remains the same" means here

This is the test every task is held to.

| Stays exactly | How it is checked |
|---|---|
| How every screen looks: layout, spacing, materials, type, wording | Screenshots at 390 and 1280 px, light and dark, English and Bengali, taken before and after each group of elements, against a real backup; a difference above a tolerance fixed in T0 fails the group |
| What every control does | The journeys (`npm run journeys`) run **unedited**; a journey changed to pass is a failure of the task, not a repair |
| The design rules | `npm run lint:rules` and `make typescale` with no ratchet loosened |
| What a screen offers | No feature added or removed; no string reworded; no route changed |

What changes is underneath: a hand-written button, field, dialog or menu becomes the one standard component that does the same job, so behaviour and accessibility are written once. The **bridge's job is to make Astryx look like the app, not the app look like Astryx.** The component supplies behaviour and accessibility; the app's materials supply appearance.

## What was measured

| Fact | Value | How |
|---|---|---|
| Today's web build, gzipped JS and CSS together | **about 600 KB** (JS 1.88 MB raw, CSS 262 KB raw) | `vite build` of `web/frontend` on the strip's branch, output outside the repo |
| The spike's two Theme pages, gzipped | **about 825 KB**: a 465 KB shared chunk and a 165 KB chunk named `bn` whose contents are not yet identified | `vite build` of the spike |
| Hand-written elements in the 68 components | 228 `<button`, 77 `<input`, 12 `<textarea`, 1 `<select`, 18 `role="dialog"`, 16 `aria-modal`, 2 menus, 3 tabs, 12 checkboxes, 2 radios, 2,060 `className` uses | `grep` over `web/frontend/src` |
| The shared layer | `ui.jsx`, 11,955 lines, 220 functions, imported by 59 of the 68 components | `wc`, `grep` |
| Astryx | `@astryxdesign/core` 0.7.17, MIT, from Meta (`github.com/meta/astryx`), built on StyleX; pre-1.0; 31 UI locales shipped and none is Bengali | `core/package.json`, `core/locales/` |
| The strip's ADR on the spike | clipping at large text, no Bengali, a larger bundle | [ADR-0936](ADR-0936-The-Web-App-Is-The-iPhone-Client-And-Is-Stripped-To-Eight-Jobs.md) |

**The size is the finding that needs a decision.** Astryx for two pages costs more than today's whole application. Importing only the components used (Astryx has a subpath per component) will cut that, and T0 measures by how much, but the floor is the runtime, StyleX and the theme, which the spike's 465 KB chunk shows is large. See open question A-4.

## Design

1. **Standardise the shared layer, not 68 screens.** The elements in `ui.jsx` are reimplemented on the Astryx component that does the same job, keeping their names and props. A screen changes only where it hand-writes an element the layer already has a name for. The 228 hand-written buttons are the largest group; most already pass through `StickerButton`, `FilmButton` and `GhostButton`.
2. **The token bridge** maps the material slots, the type dials and light and dark onto Astryx's tokens in one file, so a component takes the app's look and Astryx's own look never shows.
3. **Specificity.** Astryx writes atomic StyleX classes and the app writes Tailwind classes. T0 proves the two coexist in one build and which one wins, because "everything looks the same" depends on it.
4. **Standing UI rules still bind** (`CLAUDE.md`): every dropdown is the app's own `Select` (Astryx's selector sits underneath it at most); glyphs are the app's own (icons are passed into Astryx components); an edge fade means it scrolls (`Scroller`); spacing is `var(--edge)` and `var(--row)`; every font size answers the type dials; no box that holds text is measured in px.
5. **Bengali.** Astryx's own strings (control and dialog labels) come from its `en.json` keys. The bridge supplies a Bengali table for the same keys, chosen by the app's locale. A screen is not done until nothing Astryx says is in English when the app is in Bengali.
6. **Large text.** The spike clipped at large text. T0 finds the cause; the fix lives in the bridge once, not in screens.
7. **Desktop and PWA** use the same components. No layout change is made for either.

## Tasks

Sizes: S under a day, M a few days, L about a week or more. **A task is not done until its screenshots match, its journeys pass unedited, and a journey that uses it was run with its decisive action removed and failed.**

- [ ] **T0 · Re-verify, measure and decide the gate (S).**
  - Re-find every citation above at the build commit.
  - Build the current frontend and the spike per component: for each Astryx component the standard layer would use (`Button`, `TextField`, `Dialog`, `Menu`, `Tabs`, `Checkbox` and so on), record the gzipped cost of importing it alone, and identify the 165 KB chunk named `bn`.
  - Prove StyleX and Tailwind build and cascade together, and which wins.
  - Reproduce the large-text clipping and name its cause.
  - List every Astryx string and its key for the Bengali table.
  - Fix the screenshot tolerance and take the **before** screenshots of every screen (390 and 1280 px, light and dark, English and Bengali) against a real backup, so every later group has something to match.
  - **Gate:** the plan goes no further until the owner has seen the per-component sizes and set the bundle ceiling (open question A-4).
- [ ] **T1 · The bridge and the provider (M).** Astryx pinned exactly in `web/frontend`, one token bridge, the provider at the root, the Bengali table, the type dials wired. Acceptance: a test page renders a button, a field, a dialog and a menu looking the same as the app's own, in light, dark, large text and Bengali, nothing clipped and no English Astryx string.
- [ ] **T2 · Standard elements, one group at a time (L).** Order by how many hand-written copies there are: buttons (228), fields (77 inputs, 12 textareas), dialogs and sheets (18), checkboxes and radios, menus and tabs, then the rest. Each group is a change to `ui.jsx` and only to the screens that hand-write the element, and each ends with the whole suite and the screenshots.
- [ ] **T3 · Verify every screen (M).** The screens the strip keeps are compared with the T0 screenshots one by one: Add and Edit, Library, Catalogue and Quotes, work and quote detail, Search, Metadata, Anthologies and Boards, Checks (Marks and Files), Settings (Theme, Language, Server), Logs and Updates, Home. Anything that differs is fixed in the bridge or the element, not accepted.
- [ ] **T4 · Retire what the old elements left (S).** Dead code and ratchet counts that fell; the glossary regenerated; Developing's map updated.
- [ ] **T5 · Release.** The server release (see [Releasing](Releasing.md)), as one version.

## Open questions

| # | Question | Recommended | Cost of the other |
|---|---|---|---|
| A-1 | Pin Astryx exactly and upgrade by hand | Yes | A floating version breaks a 0.x API on an install |
| A-2 | If large text or Bengali cannot be fixed in the bridge for one element, patch Astryx locally or keep the app's own element for it | Keep the app's own element for that one | A patched copy has to be kept in step |
| A-3 | Each group is swapped as it lands, or the old layer stays until all are ready | Swapped as it lands | A long period with two layers in the bundle |
| **A-4** | **A bundle ceiling.** Astryx for two pages measured about 825 KB gzipped against today's whole build at about 600 KB. T0 gives per-component sizes. What may the build grow by? | Decided on T0's numbers; a first guess is no more than +200 KB gzipped, checked in CI | Without a ceiling the PWA's first load on an iPhone grows unchecked. With a hard one, an element that does not fit stays the app's own |

See also: [Plans index](Plans-Index.md) · [Plan: the web app, stripped](Plan-Phone-Web.md) · [Developing](Developing.md) · [Releasing](Releasing.md)
