# ADR-0555: A category name is capped at fifteen runes, counted in runes, and lowering it is not retroactive

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.7.7

**Decided.** Fifteen. The cap lives in `theme.js` as `CAT_NAME_MAX` and is enforced again
server-side, and it is counted in runes rather than UTF-16 units.

**Why.** Fifteen is not a round number — it is what fits the Stats page's colour label
column without wrapping, which is the narrowest place a category name is drawn. Deriving
the cap from the narrowest consumer means the two cannot drift. Runes because a
UTF-16 count truncates a Bengali or emoji name mid-character.

**Reversal.** It was twenty-four first, and the reduction came from looking at the Stats
column rather than from a principle. **Lowering a cap is not retroactive**: names already
stored at more than fifteen keep their length, because silently truncating data a user
typed is worse than an inconsistent column. New and edited names take the new cap.

**Approved.** Mine, on being shown the wrapped labels.

<sub>1.7.7 — `web/frontend/src/theme.js` · `internal/httpapi/auth_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
