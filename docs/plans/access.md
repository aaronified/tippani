# Access and reading comfort — roadmap §6

**Status:** designed, not built.

Roadmap section [`#access`](../roadmap.html#access), issue #32.

---

## What already exists

Verified against `fb0271f`.

| §6 item | State |
| :-- | :-- |
| Textures drop under `prefers-contrast: more` / `prefers-reduced-transparency: reduce` | **Built** — `index.css`, one media query covering both. |
| Ink and rule contrast to WCAG AA, and an in-app switch | **Not built.** The media query changes textures, not text or hairline contrast, and there is no switch. |
| Reading-comfort controls for the quote text | **Partly built, and much further along than the section says.** See below. |
| A dyslexia-friendly font option | **Reachable today, not offered.** A reader can upload OpenDyslexic; nothing bundles or names it. |
| A named, focusable equivalent for every gesture | Not built. |
| Internationalisation scaffolding | **Not built.** No `i18n`, no extraction, no catalogue — the interface is English string literals throughout. |

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

### Reading comfort

Three controls on the quote text — **size, line height, measure** — plus the
serif/sans choice the Type panel can already express.

They ride the existing mechanism exactly: `theme.js` writes
`--quote-size` / `--quote-leading` / `--quote-measure`, the quote surfaces read
them, and the preference is three more scalars in the flat prefs struct. No new
plumbing, which is why this is the cheap half of the section.

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
