# ADR-0680: An edge fade is measured, not painted — and it names which end still has content

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — `useEdgeScroll` writes `data-scroll-x` / `data-scroll-v` onto a scroller as
  `start`, `end` or `both`, and removes the attribute when nothing overflows. The CSS mask
  reads that attribute. Sideways the fade is 26px; downward it is `1.6em`.
- **Why** — the fade is the app's ONLY signal that a row scrolls: no arrow, no scrollbar,
  no counter. That makes a fade painted on a row that fits a lie the reader can only
  discover by trying, and once one fade has lied every other fade in the app becomes a
  maybe. So it is measured. The two units are the same rule seen from two sides: a
  sideways fade has to clear a thumb, which does not change size when the type does, while
  a downward one has to land on the last line, which does.
- **Instead of** — a permanent gradient, which needs no measurement and is the version
  most apps ship. Also considered and rejected: `animation-timeline: scroll()`, which is
  genuinely CSS-only but is not in Firefox, and this repo's own harnesses run Firefox.
- **Approved** — mine, on a batched decision list; the owner chose "all five scrollers,
  both axes" over a narrower rollout.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
