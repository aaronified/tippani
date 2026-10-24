# ADR-0421: A preference written from outside the preferences handler has to be a field in its struct

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.x

**Decided.** `defaultBoardId` is a field on the Go `prefs` struct — carried out by `loadPrefs` and written back by the marshal — even though nothing may set it over the wire and no client is offered a way to. Anything else that lands in that blob from outside `handleUpdatePreferences` follows the same rule.

**Why.** The handler ends in `json.Marshal(cur)` over the struct and one full-row `UPDATE`, so a key that is not a field there is a key the read drops and the write never restores. `defaultBoardId` is written by 0036's backfill and by `setDefaultBoard`, both with SQL `json_set`, and it was not a field — so every unrelated preferences save deleted it. Clicking an accent swatch unset the reader's default board; `defaultBoardID` then fell back to `ORDER BY pos, id LIMIT 1` and repointed, so the shelf they had chosen became their *first* shelf and the next quote captured outside a board was filed on the wrong one. The tolerance is what hid it: a dangling pointer would have shown up as an error, and a silently corrected one shows up as somebody else's filing mistake. 0036's own backfill produces the shape that reveals it, seeding Others at `pos` 2 with Proverbs at 0.

**Instead of.** Preserving unknown keys by merging the new set into the stored blob rather than marshalling the struct over it. That would have covered this key and every future one — but the struct's stated contract is that retired keys are *dropped* on read and on the next PUT (the pre-0.4 `home`, the pre-0.7 `navUtilities`, the pre-ladder `srGrow`/`srShrink`), and a merge keeps every retired key alive in storage forever. One field is the narrower fix and it leaves that contract intact.

**Approved.** Mine.

<sub>1.16.x — `internal/httpapi/auth_handlers.go` · `internal/httpapi/board_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
