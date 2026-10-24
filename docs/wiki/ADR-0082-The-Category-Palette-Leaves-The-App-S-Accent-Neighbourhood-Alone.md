# ADR-0082: The category palette leaves the app's accent neighbourhood alone

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** `CATEGORY_PALETTE` is sixteen curated swatches, disjoint from the theme accents by construction, held there by `palette.test.jsx`.

**Why.** A free hex field produces libraries nobody can read at a glance — the point of a category colour is that six of them are instantly distinguishable, and that survives about as long as the first two near-identical blues. Disjointness is not merely avoiding the four exact accent values: the whole ochre / terracotta / olive / slate neighbourhood is left alone, so a category can never be mistaken for an accent. It is pinned by a test because "these look different enough" is exactly the kind of judgement that quietly stops being true when somebody adds a seventeenth swatch.

**Instead of.** A free hex input — rejected.

**Approved.** I approved the curated list and the test together; the list on its own would have decayed.

<sub>1.7.0 — `web/frontend/src/theme.js` · `web/frontend/test/dom/palette.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
