# ADR-0681: The scroller's listeners live on the scroller, and nothing listens at rest

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — press-and-drag attaches `pointerdown` to the scroller itself and uses
  `setPointerCapture`, so the later moves and the release retarget to that element. A drag
  past 3px sets `data-dragged`, and a capture-phase click handler swallows the click that
  ends it.
- **Why** — `overflow` alone is a touch-only affordance: a plain mouse has no sideways
  gesture at all, so without this the fade promises content it will not give up. The
  owner had already ruled "CSS-only, no document pointer listeners" for the material
  system, on the `make perf` budget. Pointer capture honours that ruling rather than
  arguing with it — there is no document listener, and nothing is bound while the row
  sits still.
- **Instead of** — the prototype's delegated document listener, which is less code and is
  exactly the thing that ruling was written to prevent.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
