# ADR-0087: Uploaded stickers replaced the tag-derived wax seal

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 0.x

**Decided.** Migration 0011 adds a per-user `stickers` table of transparent PNG/SVG images managed on the Tags page, one attachable per quote, referenced `ON DELETE SET NULL`. Migration 0009 had already added `sticker_x` / `sticker_y`, storing the seal's centre as a fraction of the quote block's **width**.

**Why.** The tag-derived seal was only ever a CSS stand-in for a real sticker. `ON DELETE SET NULL` means deleting a sticker clears the seal from the quotes that used it and the quotes themselves survive. The position is width-normalised so the coordinate is stable however the text reflows around it; `NULL` means unplaced and the UI falls back to the top-right corner, which is exactly the pre-drag behaviour.

**Approved.** I approved both migrations, and specifically the width normalisation over storing pixels, which would have been wrong on the second device.

<sub>0.x — `internal/store/migrations/0009_sticker_pos.sql` · `internal/store/migrations/0011_stickers.sql`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
