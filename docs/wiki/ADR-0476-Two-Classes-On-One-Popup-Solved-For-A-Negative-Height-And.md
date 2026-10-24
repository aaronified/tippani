# ADR-0476: Two classes on one popup solved for a negative height and shipped a 3px sliver

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/test/rules/popup-offsets.test.js`

**Decided.** Reversed. The collapsed colour list rendered as `className="cs-menu token-menu"` — `.token-menu` for the popover look, `.cs-menu` for placement. **Why I was wrong.** Reusing `.token-menu` for the border, shadow and entrance animation was the right instinct. What I missed is that `.token-menu` also *places* itself, because it was written for a dropdown hanging under a text input: `top: calc(100% + 4px)`. `.cs-menu` set `bottom` to open upwards and never cleared the `top`. Nothing conflicts in the way CSS usually conflicts, which is why it survived review — neither declaration loses. For a box with `height: auto`, `top` and `bottom` both set is not a tie to be broken: CSS solves for the *height*, and against a 44px anchor that came out near −60px. What reached the screen was the border, twice, with nothing between. It was unusable for a whole release, and all six existing tests over that picker passed the entire time, because they test behaviour and this was layout. Both offsets have to be cleared, which is now enforced as "no popup sets an offset at all".

<sub>`web/frontend/test/rules/popup-offsets.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
