# ADR-0225: Four things the facet plan had wrong, found by building it

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0 · recorded 1.14.2

**Decided.** Recorded as one entry rather than folded silently into the six above, because a plan corrected without trace reads as a plan that was right.

**`wishlist` has no column and cannot have one.** The plan listed it beside `favourite` and `note` as a "boolean predicate", which reads as an equality on a column. 0024 gave it none on purpose — a work with no quotes in it *is* the wishlist, so it needs no storage and can never drift out of step with the count it is derived from. The facet is a count-zero predicate.

**The filter sheets were not where the plan said, and there were not nine `useState`s each.** Both boards render `WorkListScaffold`, which owns the sheet, the desktop row and the sheet's own open/close state; the boards pass value/setter pairs down. The counts are nine and **ten** — the Catalogue has `mediaType` too — and each board has a second filter surface on its detail page that the plan never mentions.

**Part 4's `scope:` chip was not built, and the reason it was proposed is not true.** The plan said `searchScope` "just had nowhere to show itself". It has somewhere: the scope row above the results has shown the active scope as a highlighted chip since the screen was built, and *All* is one click away. A second control saying the same thing in the same row of the same screen is not more legible, it is two things to keep in step. The *seeding* Part 4 describes — arriving already narrowed to where you came from — is built and is the half that was worth having.

**The grammar needed a way out of itself, which the plan does not mention at all.** Thirteen ordinary English words become operators the moment `field:` is a syntax: `note:`, `series:` and `year:` are things a reader writes in a note. Without an escape those phrases are unsearchable, and unsearchable *silently* — the box opens a dropdown and the words never reach the query. A backslash before the colon is the way out.

**Three smaller ones.** A board's `tagged` and `noted` cannot seed `tag:` and `note:` — the board's are properties of the **work**, derived from its children, and the facets are properties of the **quote**, so sending one as the other empties the section and a search from a filtered board comes back with nothing. `q` had to stop being required, which the plan does not mention and which its own Part 1 makes unavoidable: lifting the token out of the box is what leaves the box empty. And `Tooltip`'s right-click line turned out to be load-bearing once rather than twice — it stops the platform menu, and `useCardMenu`'s own guard is what stops the card menu.

**Approved.** Mine, all four, written after building rather than while planning — which is the only moment any of them could have been known.

<sub>1.10.0 · recorded 1.14.2 — `web/frontend/src/facets.js` · `web/frontend/src/works.jsx` · `internal/httpapi/search_facets.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
