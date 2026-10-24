# ADR-0836: One row for every list, and the line it moved off the name

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The v3 pack remakes Settings and Metadata first and then the rest of the app, and
almost all of that rest is lists. So the row those lists are drawn with is the first
thing the port builds, and it is built here rather than inside the console that
happened to need it first.

**Decided.** `recordRow.jsx` draws a record as one function: a mark, a name, at most
one sub-line, chips, the verbs, and the row's own expansion. `BookRow` and
`MovieRow` on the metadata works console are its first two callers; the shape it
exposes is deliberately not the shape those two alone need.

**Why.** The repo had already written that row four times — `BookRow`, `MovieRow`,
the person row and the character row — each with its own copy of the cover slot,
the gap chips and the action cluster. Four copies is how the person console ended up
with a portrait that opens an editor while the character console's portrait opens
nothing: the same picture in the same position doing two different things, which is
the directive this answers from the other side. The pack draws six consoles that are
visibly one row, and six copies would be worse than four.

**TWO OF THE FOUR, NOT FOUR, AND THAT IS WORTH STATING PRECISELY** because the first
draft of this entry implied otherwise. `BookRow` and `MovieRow` are flex rows and
they have moved. The person and character consoles are `<table class="ann-table">` —
their columns align across rows, which is what a table is for — so moving them is
converting two tables into row lists, not swapping a component. The pack does draw
them as rows and they will move when the Metadata screen is rebuilt to it. Until then
the portrait defect above is described, not repaired.

**Instead of** a `MetadataRow` extracted from `BookRow` and generalised later, which
is what the smallest diff would have been. It was turned down on the sequencing: the
next screens to be remade are Library and Catalogue, and a row shaped around a
metadata table — gap chips, a fetch verb — would have had to be pulled apart on the
third caller. The cost of designing it against a screen that did not need it yet is
one afternoon; the cost of not doing so is paid on every screen after the second.

**IT RESOLVES NO LOCALE KEY OF ITS OWN**, which is `characterRows.jsx`'s rule and
holds here for a sharper reason. The first draft defaulted the cover's alt text and
the checkbox's tooltip to `metadata.row.*`: a module every screen draws from cannot
carry one screen's words, and Library could not have used it without inheriting them.
Every string arrives from the caller, and `alt` has no default at all.

**AND NOTHING IS DEFINED IN IT THAT NOTHING CALLS.** The first draft also shipped a
swatch mark, a per-row font override and a count-that-is-a-door — three unreachable
exports, two with CSS, and this entry asserted the third as decided policy while no
call site could reach it. They belong to the colour-categories and tags consoles and
they arrive with those callers. A rater found it; the surface and its CSS are gone.

**And the author left the name line.** `BookRow` led with `Title · Author · 12
quotes` inside one `NameScroll`. The standing rule is that a name never truncates —
it scrolls under a measured edge fade — and that rule was being satisfied on a line
whose overflow was mostly not the name: on a long title the fade landed inside the
punctuation, so reading the end of a title meant dragging past the author and the
count. The pack puts the shelf, the year and the credit on the sub-line, and that is
why.

**AND THE SUB-LINE WEARS `.cs-row-sub`, WHICH THE FIRST DRAFT GOT WRONG IN A WAY THIS
ENTRY THEN BLESSED.** It was `.microcopy` — the mono label face, tracked, in
`var(--faint)` — so moving the author off the name line also turned it into a label and
dimmed it, when the single line it replaced had rendered the author in body type at
`var(--soft)`. The row got worse in exactly the respect the change was made to improve,
this entry called it "the pack's arrangement", and the class the repo already had for a
sub-line was sitting in `characterRows.jsx` — the very module this one names as its
model. A rater found it. The lesson is narrower than "check the CSS": moving a thing
between lines is also moving it between type roles, and the second move has to be chosen
rather than inherited from whatever class was nearest.

**A LATCHED GLYPH ANNOUNCES ITSELF, AND THAT LINE IS A REPAIR.** The hand-rolled
cluster this replaced passed `aria-pressed` through `FieldIconButton`'s `...rest`.
The first draft of the shared row enumerated the props it forwarded and dropped it,
so the edit and look-up toggles on every book and film row went on DRAWING their
latched state and stopped SAYING it — a regression visible to nobody using a screen
and to everybody using a reader. An action declares `pressed` to be a toggle; one
that omits it gets no attribute, because `aria-pressed="false"` on a one-shot verb is
its own defect.

**Approved** on the plan, with the row's arrangement called out in it.

*Unreleased — `web/frontend/src/recordRow.jsx`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/test/dom/record-row.test.jsx`,
`web/frontend/test/journeys/reading-the-metadata-console.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
