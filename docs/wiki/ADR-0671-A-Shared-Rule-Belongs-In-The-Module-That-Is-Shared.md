# ADR-0671: A shared rule belongs in the module that is shared

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.7

**Decided.** `patchMovesTheRow` lives in `works.jsx` and all three boards call it.

**Why it moved.** It was written in `Library.jsx` because that is where the first board that needed it lived, and the film board — the third — went a release without it, still refetching every line on the screen after every heart. Quotes had a hand-rolled third copy that was correct only by accident of its filters being client-side, with nothing saying so.

**`works.jsx` is by its own header "what books and films share"**, and both screens already import it; putting the rule in one of the two 2,000-line screens and importing it into the other would have been an edge between two screens for one pure function.

**The shape to notice**: when a fix is applied to N of M places, the fix is not finished, and the thing to move is usually the RULE rather than the code. A rule in a shared module is one call site away from being complete; a rule in one screen is a search away from being forgotten.

<sub>2.2.7 — `web/frontend/src/works.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
