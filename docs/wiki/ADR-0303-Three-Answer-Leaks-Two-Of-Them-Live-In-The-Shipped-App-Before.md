# ADR-0303: Three answer leaks, two of them live in the shipped app before this release

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Fixed, each with a test that fails when the guard is removed:

1. **`Home.jsx` rendered the attribution side for every direction that was not `source`.** The line was `isSource ? <QuoteBlock/> : <SourceLines/>`, and `SourceLines` prints the actor as a face chip and the character in its meta line. With two directions that was the same thing; the moment a *speaker* card existed it would have shown the right actor directly above the four options.
2. **`attachMCQ` fell through to the quote branch for any unrecognised direction.** It tested `if direction == source` and everything else took the other branch, so a card labelled `cloze` or `speaker` would have come back carrying quote options with the correct quote among them. It is an explicit switch now, whose default refuses.
3. **Selecting a wrong option painted it red before Submit.** `chosen && !isAnswer` was safe only while a chosen option was necessarily a graded one; the confirm step put a real interval between the two, and without `answered &&` the styling told you the answer while you could still change it.

**Why they are logged together.** None was visible from inside the feature that would have exposed it. The first two were found by a specification pass reconciling seven independent specs, not by any test, and both had been in the tree for releases behind a two-direction vocabulary that happened not to reach them.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/review.jsx` · `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
