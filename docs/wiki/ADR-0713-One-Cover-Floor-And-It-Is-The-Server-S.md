# ADR-0713: One cover floor, and it is the server's

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*A departure from the handoff, taken deliberately. The pack asked for 400×600.*

- **The floor is 500px and it is a WIDTH**, because that is the only test that exists.
  `lowResCoverWidth` decides whether a refetch replaces stored art and it decides on width
  alone; Metadata's *low-res* gap counts the same test. The red ink on a cover's stated
  size is therefore that test too — **red is a promise that Fetch can do something about
  it**, not a second opinion about what a good cover looks like.
- **Both halves of the pack's number were wrong for this app, in opposite directions.** A
  height half would ink a 600×500 cover red with nothing on the server willing to change
  it; 400 would leave a 450-wide cover un-inked here while Metadata already lists it as a
  gap. `cover-floor.test.js` parses the Go constant and asserts the JS export equals it,
  so this cannot drift back into two numbers — and asserts the client keeps no second copy,
  because the copy is the drift surface, not the disagreement.
- **A portrait's floor is a different question and keeps the pack's 400**, read as a
  minimum SIDE rather than a width because a round crop takes the shorter one. Nothing on
  the server acts on it, and the comment says so.
- **The stated size is measured, not fetched**, and the invariant it rests on is written at
  the measurement site: `/covers/{name}` is a plain `http.ServeFile`, so the bytes the
  browser measured are the stored file's. The day that route learns a `?w=` variant, the
  number becomes a confident lie about the exact figure a reader uses to decide whether to
  replace their cover — so that change has to bring a real size with it.
- **Remove is not one of the four verbs.** Fetch · Search · Upload · Paste URL are ways of
  *acquiring* a picture; a destructive verb inside a 2×2 of constructive ones is where a
  mis-click costs a cover. It sits below them and only when there is something to remove,
  so the common case is the 2×2 the pack drew.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
