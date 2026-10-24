# ADR-0481: Column ladders are paired with --container-max

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`

**Decided.** `BOARD_COLUMNS = [[1900,5],[1600,4],[1280,3],[640,2]]` and `QUOTE_COLUMNS = [[1900,5],[1600,4],[1280,3],[860,2]]`, with `--container-max` stepping 1180 → 1320 → 1500 → 1760px. The stylesheet comment says the two tables have to be read together.

**Why.** A board of cards wants *more columns* on a wider screen, not wider cards — a quote card at 1600px across is a worse card. So the container cap steps rather than growing continuously, and each step is matched by a rung in the ladder. The two ladders differ in exactly one rung: quotes hold two columns down to 860px rather than 640px, because a quote wrapped to 300px is a column of syllables, whereas a cover at 300px is a cover. Below 1400px nothing changes — 1180px was chosen for a laptop and is still right on one. Mine, and pairing them explicitly is what stops one moving without the other.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
