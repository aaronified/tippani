# ADR-0666: A callback named for the record cannot be called by something that means "the list"

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.6

**Decided.** `CastSection` takes `onCastChanged`, which takes nothing; the panel that renders it passes `() => onChanged?.(item)`.

**The bug.** The People panel called `onChanged?.()` after every save, add and remove. That prop is the host's record SETTER — `onChanged={setMovie}` in Movies.jsx, `setBook` in Library.jsx — and both pages render behind `{movie && …}`. So correcting a character's name ran `setMovie(undefined)` and unmounted the film page and the dialog standing on it.

**IT SURVIVED THREE REVIEWS, and the reason is the interesting part.** Every test in `cast-panel.test.jsx` passed `onChanged={() => {}}`. A stub cannot notice what it was given, so a suite of twenty cases that assert requests, payloads and absences was blind to the ARGUMENT. The test that catches it is four lines and asserts `args` — and the general form of it is: when a component calls a callback it did not define, the test has to look at what it passes, not only that it passed.

**The name did the damage.** `onChanged` reads as "tell the parent something changed" from inside the child and as "here is the new record" from outside it. Renaming is most of the fix; passing the record the panel already has is the rest, so the signal survives without the child ever holding the setter's contract.

<sub>2.2.6 — `web/frontend/src/cast.jsx` · `web/frontend/src/WorkDetails.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
