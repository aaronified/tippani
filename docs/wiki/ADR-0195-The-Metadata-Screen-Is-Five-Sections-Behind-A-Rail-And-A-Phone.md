# ADR-0195: The Metadata screen is five sections behind a rail, and a phone gets the same five

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `MetadataPage` renders a `SectionRail` — Overview, Works, People, Characters, Sources — as a `role="tablist"` inside a `Scroller`, beside the body above 900px and stacked under it. Each door carries a count; Overview's is a sum of gaps and is the only one inked as a warning; Sources has none. The section is remembered per user, and a persisted value that no longer names a section falls back to Overview rather than rendering nothing.

**Why.** The screen had grown into one scroll holding a summary, a work table, a people table, a character list and four maintenance sweeps, and the question a reader actually arrives with — *is it worth opening the character list* — could only be answered by scrolling to it. A count on the door answers it before the door opens. The rail is also what made the phone case tractable: the phone used to get a **different screen** — three maintenance buttons and two summary lines, with no browsable record at all — so "can I fix this from my phone" answered "some of it, and you cannot see which". One rail that stacks is one screen with two arrangements, which is a layout decision; two screens is two products.

**A count of gaps goes red; a count of things does not.** 900 books is not a warning and inking it as one teaches a reader to ignore the colour. Only Overview's number is a gap count, so only Overview's number can be red.

**Instead of.** Routed sub-pages, one URL each — the sections share a fetch, a bulk bar and a panel stack, and four routes would either refetch on every switch or hoist that state above the router for no gain the reader can see. A `<select>` on the phone — it hides the counts, which are the reason the rail exists. Leaving Sources on Settings: see the entry below.

**Approved.** The owner's brief, which asked for each kind of metadata to have its own in-depth section rather than a shared scroll.

<sub>3.1.0 — `web/frontend/src/MetadataPage.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/metadata-sections.test.jsx` · `scripts/screenshots/frame-scroll.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
