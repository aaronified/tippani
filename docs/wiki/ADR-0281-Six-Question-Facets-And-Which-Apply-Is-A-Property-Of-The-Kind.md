# ADR-0281: Six question facets, and which apply is a property of the kind

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0, four of the six

**Decided.** The deck grows from two facets to six: **source** (which work), **quote** (which line), **cloze** (fill the blank), **speaker** (who said this), **author** (who wrote this), **when** (roughly which decade). Which are available is decided by the kind and by the row, never by the reader.

| facet | book | screen | standalone quote |
|---|:--:|:--:|:--:|
| source · quote · cloze | ✓ | ✓ | ✓ |
| speaker | — | ✓ character | ✓ speaker |
| author | ✓ | — | — |
| when | ✓ published | ✓ release | ✓ occasion date |

**Why.** Today's two facets are the same question in mirror image, which is why the film case has no hard version and the series case has no fair one. **Speaker is the facet the screen deck was missing**: the plausible distractors are the other characters of the same film, so the pool is dense by construction and needs no cross-library similarity search at all.

**Two of the six have difficulty that does not depend on the library's shape** — cloze, whose difficulty comes from the line, and *when*, whose difficulty is how far apart the offered decades are, a number the deck chooses rather than inherits. Those two are what a sparse or lopsided library falls back on, which is the answer to the film case. The decade machinery *when* needs landed in 1.13.2.

**Author is the weakest of the six** and is not defaulted on: a reader usually knows the author from the shelf.

**This is why the character-chip feature and this one are one piece of work.** That feature builds the character → actor mapping per film; this one needs exactly that mapping to ask *who said this*. Planned apart, each would build half of it.

**Approved.** The reader's, in the form "add new facets to the quiz as well."

<sub>1.15.0, four of the six — `internal/httpapi/review_handlers.go` (`directionsFor`)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
