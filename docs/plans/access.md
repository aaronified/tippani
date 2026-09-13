# Access and reading comfort — roadmap §6

**Status:** four of the six rows below are BUILT. Two remain, and both turned out
smaller than this file assumed.

Re-verified against `1db9672d` plus the working tree that adds the reading dials.
Two rows were already wrong when this plan was written and are corrected below —
i18n and the gesture equivalents — so read the table rather than the prose under
it where the two disagree.

Roadmap section [`#access`](../roadmap.html#access), issue #32.

---

## What already exists

Verified against `fb0271f`.

| §6 item | State |
| :-- | :-- |
| Textures drop under `prefers-contrast: more` / `prefers-reduced-transparency: reduce` | **Built** — `index.css`, one media query covering both. |
| Ink and rule contrast to WCAG AA, and an in-app switch | **Built.** Five text colours were measured below 4.5:1 and raised (`ae2d1d84`); the switch is Settings → Appearance and resolves to one state with the media query (`04c13c62`). `contrast.test.js` computes every pair. |
| Reading-comfort controls for the quote text | **Built.** Size already shipped (four per-role dials, `type.js`); leading and measure are `--quote-leading` / `--quote-measure`, written by `applyTypeScale` and read by every quote slot. |
| A dyslexia-friendly font option | **Reachable today, not offered** — unchanged, and the only row this plan got exactly right. A reader can upload one; nothing bundles or names it. THE LICENCE IS NOW SETTLED: `@fontsource/opendyslexic@5.3.0` ships an OFL-1.1 LICENSE naming Abbie Gonzalez with Reserved Font Name, which is the licence all eighteen bundled faces already carry. |
| A named, focusable equivalent for every gesture | **Almost entirely built, and this row was wrong.** Of the eight gestures the app ships, SEVEN already have an equivalent: the drawer's swipe-close has a real `<button>` scrim (`App.jsx:1160`), the Toggle's thumb drag has `<button role="tab">` options (`ui.jsx:4533`), the Select's drag-to-pick has Arrow/Enter navigation, the touch tooltip has `onFocus` (`ui.jsx:6421`), and the card menu and the sheet step answer keys (`ui.jsx:10644`, `5831`, `11031`). ONE has nothing: dragging the seal (`flow.jsx:256`) is a bare `<span>` with no `tabIndex`, `role` or `onKeyDown`, and it persists `sticker_x`/`sticker_y` with no other door. |
| Internationalisation scaffolding | **Built, and this row was wrong when it was written.** `internal/i18n/en.txt` and `bn.txt`, `t()` throughout, and `data/Locales` lets a reader add a language as a file. |

### What the verification pass changed

**"the only typographic control today is how big the covers are" is badly out of
date**, and it is the claim that most changes what this section is.

Settings → Type ships **six font roles** — display, UI, mono, hand, Bengali,
Devanagari — each with bundled faces and a per-role style, and 0039 added **user
font uploads**, so a reader can already bring a face the app has never heard of.
`theme.js` writes all of it to CSS custom properties that every surface reads.

Two consequences:

1. **The dyslexia-friendly font is nearly free**, and more nearly free than the
   roadmap's own reasoning ("cheap given the existing self-hosted @fontsource
   setup") assumed. A reader can already upload one. What is missing is that it is
   *offered* — one bundled face and a name in the Type panel, so somebody who
   needs it does not have to know to go and find it.

2. **What is genuinely missing is not "typographic control" but control of the
   READING MEASURE**: size, line height and line length of the quote text itself.
   Every existing control chooses a *face*; none of them chooses how the passage
   is set. Reading passages is the entire purpose of the app, and that is the axis
   with nothing on it.

So this section is smaller than it reads, and its remaining weight is in the
contrast work and in i18n.

---

## The shape

### Contrast, and a switch

Two halves, and only the second is new work in kind.

The **media query** already handles a reader whose OS says so. What is missing is
the palette itself: raising ink-on-paper and hairline (`--line`, `--ink-border`)
to **4.5:1 for text and 3:1 for non-text**, in all four aesthetics, and a Settings
switch for a reader who cannot or will not set it at the OS level.

**The switch and the media query must resolve to one state**, not two competing
ones — `theme.js` already resolves theme this way (`getResolvedTheme`), and this
follows it: `contrast: auto | more`, where `auto` defers to the query. Two
independent sources for one visual property is the drift this repo keeps writing
about.

**Measure the four aesthetics rather than eyeballing them.** Paper-light and
film-dark are the two the owner uses; paper-dark and film-light are the two most
likely to be quietly failing.

### Reading comfort — BUILT; what follows is what it actually became

Three controls on the quote text — **size, line height, measure** — plus the
serif/sans choice the Type panel can already express.

They ride the existing mechanism exactly: `theme.js` writes
`--quote-size` / `--quote-leading` / `--quote-measure`, the quote surfaces read
them, and the preference is three more scalars in the flat prefs struct. No new
plumbing, which is why this is the cheap half of the section.

**FOUR CORRECTIONS, kept here because this paragraph is what the next reader will
find first.** (1) It was TWO controls, not three: size already shipped. (2) There
is no `--quote-size` and none is needed — size travels as `--type-display-*`
through the four per-role dials. (3) They ride `type.js`, not `theme.js`, and
deliberately NOT `typeTokens`, which is asserted to hold one token per step per
role and nothing else. (4) The measure had to be in `ch` and had to land on a
block: `max-width` does nothing on a non-replaced inline element, which is how it
reached every quote surface except the five search slots for one commit. The full
record is in `docs/PLAN.md`, "The quote's two reading dials".

**Measure is the one worth defending**: line length is the single largest
readability lever in a body of prose and the one no app offers, and the paper and
film aesthetics are deliberately generous — which is right for reading and is
exactly what somebody with low vision needs to be able to narrow.

### A named equivalent for every gesture

This is a **rule** rather than a feature, and it belongs beside the gestures §2
adds rather than after them: any gesture shipped without a focusable, named
control is an interaction some readers cannot reach at all.

The keyboard registry (`keys.js`) is now the natural home for the named half —
every binding already carries a label and prints itself on the control that shares
its job, which is the same discipline one step further on.

### Internationalisation scaffolding

The argument is the roadmap's and it is correct: **the cost only goes up.** The
app is named in Bengali, ships a Bengali wordmark and a Noto Serif Bengali subset,
and is English-only.

**English plus one real translation, to prove the seams.** A catalogue with one
language in it proves nothing — the seams that matter are plurals, dates,
interpolation and text that grows 40% in translation, and only a second language
finds them.

Two constraints specific to this app:

- **Five words or fewer** is a rule for labels, and it is a rule about ENGLISH.
  German will not honour it. Anything that assumes a label fits — the collapsing
  button labels, the nav strip, the scope chips — has to be re-checked with a long
  language in it, and that check is most of the real work.
- **Nothing user-authored is translated.** A quote, a note, a tag and a board name
  are the reader's own words in whatever language they wrote them, and the
  interface must never fold them into its own locale.

---

## Deliberately not built

**A full theme editor.** Contrast is an accessibility floor, not a palette
feature, and the two would fight: a reader who has set "more contrast" must not
have it silently undone by a colour they picked.

**Machine translation of the catalogue.** A wrong label in a language nobody on
the project reads is worse than an English one, because nothing on screen says it
is wrong.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| contrast | Every ink/background and hairline pair in all four aesthetics meets 4.5:1 and 3:1, computed rather than eyeballed. This is the test the feature is *for*. |
| same | The switch and the media query resolve to ONE state: `auto` + OS-more equals explicit `more`, and explicit `more` survives an OS that says nothing. |
| reading comfort | Size, leading and measure reach the quote surfaces and survive a reload; the defaults are unchanged for a reader who sets nothing. |
| fonts | The dyslexia face is offered by name in the Type panel and applies to the quote text, not only to the UI. |
| i18n | Every user-visible string resolves through the catalogue; a missing key fails loudly in tests rather than rendering its own key to a reader. |
| same | A pseudo-locale that lengthens every string by 40% does not overflow the nav strip, the scope chips or the collapsing button labels. |
