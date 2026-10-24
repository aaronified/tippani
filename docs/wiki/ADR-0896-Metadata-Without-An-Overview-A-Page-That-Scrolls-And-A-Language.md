# ADR-0896: Metadata without an Overview, a page that scrolls, and a language table keyed to ISO 639-3

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Overview went because nothing on it was only on it.** The owner: *"remove the overview
screen completely. We are not going to miss it. All options are available on other
screens."* Checked before deleting: Fetch keeps the header button, the ⋯ entry and the
phone dock key; library-wide Re-verify is Works → select all shown → Re-verify; the
coverage numbers are the Works issue pills and the phone's issues sheet, which already
counted more (people with no portrait or link) than the Overview tiles did. The phone's
complaint — "doesn't show the gated buttons that are there in the desktop overview" — was
therefore answered by removing the desktop half, not by copying it. A bare `/metadata`
opens the index on a phone (the index IS the navigation there) and the last-used section
on desktop, else Works; an old `/metadata/overview` resolves to Works and replaces the
address, so Back does not bounce through a screen that no longer exists.

**The page scrolls; the list does not.** The three consoles capped their list at
`min(28em, 60vh)` with its own scroll bar, a shape left over from when all of Metadata was
one long page and a 400-row list had to be kept from pushing everything else off it. As
its own section that cap only leaves the bottom third of a desktop window empty. The
rejected alternative was to keep the inner box and make it fill the remaining height:
two scroll contexts on one screen, one of which a wheel over the gutter does not reach.
Instead the toolbar (filters, pills, select-all, bulk bar) is `position: sticky` under
the top bar, so the controls stay in reach 400 rows down. It paints its background only
once an IntersectionObserver says it is stuck — a band behind a toolbar at rest is a
second card nobody asked for. The character remap card is above the toolbar and scrolls
away, per the owner: not "at the end of a 400 line scroll".

**Air is restated per screen, and `--row` was the wrong token to restate.** The owner:
"only the spaces need to be modified". The gaps come from `--meta-gap`, `--card-pad` and
`--section-top` on the `data-screen-label` wrapper — Metadata 24, Settings 22 (a notch
lighter, as asked), phones 18 with a 16px screen edge. Restating `--row` itself was tried
first and inflated every panel opened from a console, because those panels read `--row`
too. The one structural fix hiding under "spacing" was that the section content sat in a
bare `<div>`, so `.meta-body`'s grid gap never reached between the duplicates card and the
filter row; it is `.meta-stack` now.

**The language table: icons per row, words once.** The first plan was a radio table with
the four orders as column headers; the owner's mockup review replaced it — *"The 4
repeated text buttons can be replaced with icons. The top general one can have both icon
and legend, all others icon only. So that each language can fit in one row."* The icons
(`IconTextOrder`) are two bars, solid for the quotation and hollow for the translation, in
the order and presence each option shows; the All languages row above is where a reader
learns the drawing, which is the same roomy-teaches-tight split `Tally` makes. Each icon's
accessible name is the language and the word ("Bengali: translation first"), so nothing
is only a picture.

**One editor, one shape.** The old inline tray opened differently for every language: a
script-letter strip for one, a custom-mark field for another, nothing for a script the
app did not know. Now every row opens the same `FormModal` — name, ISO code, one grid of
same-size mark cells (script letters, then the reader's own, then ＋), and Reset/Remove at
the foot. Remove confirms, and is disabled for a language the library still holds,
because the quotes would bring it straight back.

**ISO 639-3, because the owner asked where the association was — and it was nowhere.**
*"these languages are supposed to be from the ISO languages list (the larger 3 digit
list). I do not see that association anywhere (it was also missing in the app)."* The
app's `iso639.js` is ninety-odd languages it knows well enough to offer an autonym and a
script for; it cannot name Ancient Greek (`grc`, not `el`) or Sylheti (`syl`, no
two-letter code at all). So each stored entry gains `i`, a registry code, and adding a
language searches all 7,863 codes (special codes `mis/mul/und/zxx` excluded — they are
not languages a reader's quotes are in). The table is generated from the pinned
`iso-639-3` package by `scripts/iso6393-data.mjs` rather than imported, because the
package's object graph carries every alias and 639-2 code the screen never reads; its
150KB loads only when somebody opens the search, while the 184 639-1 → 639-3 pairs ship
synchronously so a known language shows its code on first paint. The server checks the
code's SHAPE only (three lower-case letters): validating existence would put a second
copy of the registry in the binary for a field that only ever arrives from a picker built
on the first. A name typed with no code is still allowed — a dialect or a period spelling
is still a language — and the row says "no ISO code" rather than inventing one.

**Found on the way: a language name was checked against the mark's limit.** `okMark`
(eight runes) guarded both fields, so "Ancient Greek" could never be stored as a rename.
Names have their own `okName` now — 40 runes, no control characters.

**And the harness learned to scroll a control out from under the dock.** The added air
moved Settings' Review door on a phone to y=744 of 844, under the dock, and `press` —
which only asked Puppeteer whether the box was inside the viewport — clicked the dock's
accent key instead. The journey went red on the wrong screen; one with a weaker assertion
after the press would have gone green on it. `press` and `pressAll` now centre their
target first, as a thumb does, and if something is still drawn over its middle they
refuse and name the cover instead of pressing it. `harness-vocabulary.journey.mjs` checks
the refusal with a cover laid over the page from setup, and goes red when the refusal is
removed.

**And the sticky toolbar's first observer was wrong in one direction.** "Stuck" was an
intersection ratio under 1, which is also what a toolbar clipped by the window's BOTTOM
reports; measured at 1440×420 it painted its band at rest. It is "clipped at the top" now.

**What checks the height and the air.** The first pass at this had no journey for the
sticky toolbar or the uncapped list, and said so: `press` centres its target first
(above), so "scroll far down and press a pill" passes with or without `position:
sticky`. The harness gained `inReach` — can a thumb press this without scrolling — and
`a-long-list-keeps-its-filters` uses it: the first work in reach at rest, then End, then
the first work OUT of reach (the page scrolled the list, so it is not back in a box) and
the `flagged` pill still IN reach (the toolbar followed). Both mutations were run and each
fails on its own assertion. The spacing itself is still measured rather than journeyed,
by a probe against the SEEDED fixture — this machine has no `backup.env`, so not the
archive CLAUDE.md prefers — at 1440×900 and 390×844: the first card 24px under the tab
rail on a desk and 20px under the bar on a phone; 24 / 18px between blocks; 16px phone
gutters; Languages at 390 with `scrollWidth == clientWidth` and nothing clipped. The same
probe found the toolbar painting its band at rest in a 420px-tall window, before the
observer fix.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
