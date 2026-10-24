# ADR-0649: A control that writes nothing is worse than a missing one, and only a test that types into it can tell

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.2

**Decided.** Every per-kind field added in 2.2.1 now has a case that types into the box and asserts what the form SENT: the book highlight's character, the game's act and quest, the chapter suggestions, and the five a standalone quote carries.

**Why, in one sentence.** The character box on the book highlight form shipped inert — the payload carried two `character` keys, the later carry-through won, and Vite's "Duplicate key" warning scrolled past in a run that reported 1866 tests green. Not one of those tests typed into a field and looked at the payload.

**The general shape.** A form test that asserts a box EXISTS proves the least interesting half. This app's forms are full-state: what matters is the object they build, because a field missing from it is a field emptied rather than left alone — a trap `Quotes.jsx` has now fallen into three times, each time with a comment about the previous one. So the assertion is on the payload, and for the standalone fields there is a second case on `utteranceState`, which is what the ♥ and the colour dots save through.

<sub>2.2.2 — `web/frontend/test/dom/per-kind-fields.test.jsx` · `web/frontend/test/dom/utterance-fields.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
