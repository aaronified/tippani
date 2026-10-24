# ADR-0884: The capture probe found four things the pictures could not

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The sweep of `scripts/screenshots/surfaces.mjs`'s output was supposed to be a reading of
forty-six screenshots. Half of what it produced came from the run itself rather than from
the images, and that split is the interesting part.

**A PAGE THREE TIMES TOO WIDE LOOKS LIKE A PAGE.** Works, People and Characters each laid
themselves out at the width of their longest title inside a 390px viewport — 1235, 1215 and
499 against 390 — so the whole document slid sideways: top bar, dock, cards, rows, all
together. Every one of those screenshots was taken and looked fine, because a shot is taken
at the viewport and everything inside it is merely positioned wrong. Only `scrollWidth`,
recorded beside each file, said so.

The cause was one line. `.meta-body` is a grid and carried `min-width: 0` — which says
nothing about its ITEMS: a grid item's own `min-width` defaults to `auto`, its min-content
size, so nothing under it could narrow and the app's own answer to a too-wide row (a measured
fade with a scroller inside it) never fired. `.meta-body > * { min-width: 0 }` is the fix, and
`a-console-that-fits-the-phone.journey.mjs` measures it in a real browser at a real phone
width. The verb it uses — `sideways` — is the harness's only number rather than a word,
because there is no word on the screen to read.

**A TOOLTIP IS NOT A NAME.** The works console drew forty-four tick boxes with no accessible
name at all and a hundred and thirty-two buttons reading "Edit", "Look up" and "Open" — one
row's worth of words, repeated, with nothing tying any of them to the title beside them. The
people console's rows said "fetch" the same way. Each had a tooltip that said more, and a
tooltip needs a pointer and a hover: it does not exist for a keyboard, a screen reader, or a
probe. What found it was the probe REFUSING to press — `"Look up" is ambiguous: 44 controls
match` — which is a defect report from something trying to use the screen, not to photograph
it.

**THE NOUN GOES IN THE NAME, NOT INTO THE TEXT.** The rail tabs and the phone's top-bar crumb
carried a bare figure: "Works 44", a number with nothing saying what it counts, under a
comment in `sectionRail.jsx` claiming a screen reader heard the whole sentence. It did not —
in either place. The first fix appended an `sr-only` noun, which is the usual move and was
wrong here: off-screen text is still `textContent`, which is how this repo's tests and the
journey tier's own view of a screen read a tab, and `settings-changed.test.jsx` went red on
`"Review1 changed"` within the hour. `aria-label` on the control says the thing once, to the
one audience that needs it. The section's own word comes first so the name still CONTAINS
the visible label, which is what keeps "press Works" meaning that tab.

**AND THREE OF THE PROBE'S DOORS WERE STALE — its report, not the app's.** It pressed
"In-depth controls" and "Type", two doors this pass deliberately unfolded, and "Changelog",
which is a card now. A probe that reports MISS on a door that was opened for good is a probe
claiming the app is broken, so the entries are gone and the changelog one presses the button
that is actually there. Its `press` gained the journey harness's third tier
(exact → starts-with → contains) and its press list gained `input[type=checkbox]` — without
which "select all shown" was reported missing from a screen it is plainly on, because the box
is a bare checkbox inside its label, which is the right markup and matched nothing.

**AND THREE OF THE FIVE THINGS THE SWEEP LOOKED FOR WERE NOT THERE, which is a result
rather than a silence.** The item named five: double headers, duplicated info dots,
consolidation opportunities, over-long text, design-rule breaches. The last two produced
the findings above. The first three did not, and each was checked rather than skipped —

- **Double headers: none, on any of the forty-six.** Both sweeps of the images agreed, and
  this is what #34, #35 and #38 were for: the drill head is gone and the section's name
  lives in the breadcrumb, so there is nowhere left for a second one to be drawn.
- **Duplicated info dots: none, and the sweep's own expectation was the wrong rule.** It
  was told "at most one per screen" and duly reported Theme with four and Review with
  eight. The repo's rule is not that — it is `prefRow.jsx`'s "a dot only where there is
  something to say", and #40 already measured the alternative: the highest overlap between
  any dot's body and the words on its own row was 14%, so not one of them was a
  restatement. Counted at the source, twenty rows in Settings carry `info=`, on a screen
  of five sections. That is the design, not a defect, and the finding is recorded here as
  a wrong expectation rather than dropped.
- **Consolidation: nothing left to fold.** The two "narrow column with empty space beside
  it" reports on the desktop captures are Colours and Characters, which are single lists —
  a list does not become two columns by being short — and the empty space under them is
  the 2400px capture viewport rather than a screen.

TWO MORE OF THE SWEEP'S FINDINGS WERE CHECKED AND REFUTED at their own sites, which is the
repo's rule about a subagent's finding doing what it exists to do. The stickers reported as
emoji are USER CONTENT — `tags.help.stickers.what`: "A heart, a star and three faces to
start with, plus any transparent PNG or SVG you upload" — and the no-emoji rule is about
the app's own glyphs. The ellipses reported across five works captures are `.name-scroll`'s
measured fade, not a truncation; `no-truncated-names.test.js` holds that class and is
green. What survived from that pair was the ONE real clip underneath them, on the cover
specimen's credit line, which no scanner could see because it was written in a style
attribute.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
