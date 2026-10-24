# ADR-0080: Colour slots are append-only and their order is frozen

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.1

**Decided.** `CATEGORY_SLOTS` is `['yellow','blue','pink','orange','green', 'purple']` and never reorders; `green` and `purple` were appended by 0029.

**Why.** Slot N is `--hl-N` in the stylesheet and always has been, and the token in slot N is the token stored on every row that wears it. Reordering would silently recolour every quote in the library. The migration states the same rule from its own side: "The new tokens are appended, never reordered: 'yellow' stays the column default."

**Approved.** Mine; I approved append-only as a standing rule rather than a one-off, so the next widening has nothing to decide.

<sub>1.7.1 — `web/frontend/src/theme.js` · `web/frontend/src/index.css` · `internal/store/migrations/0029_six_colours.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
