# ADR-0490: One grain scale per material role, not per call site

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/index.css`

**Decided.** Five named custom properties — `--grain-accent: 130px`, `--grain-shell: 320px`, `--grain-shell-sm: 185px`, `--grain-scene: 420px`, `--grain-card: 300px` — and every texture tile names the role it fills.

**Why.** That is how the numbers drifted: an accent-filled control was 150px as a primary button, 130px as a toggle thumb and 120px as an active filter chip — three sizes of the same fabric on three controls that sit in the same row and are meant to read as one family. At those sizes the grain is coarser on the button than on the chip beside it, which is exactly the kind of difference nobody can name and everybody can see. The three shell values are deliberately *not* one number: the tile is a picture of a real surface, so a full-viewport backdrop and a 999px pill want genuinely different scales or the pill shows one blurry plank. What they get instead is a name each, so the next surface picks a role rather than a number. Approved by me; the point is not the values, it is that a call site can no longer invent one.

<sub>`web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
