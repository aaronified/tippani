# ADR-0888: A slider is the one control whose precision is its width

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`.pref-row-control` shrink-wraps, which is right for a toggle and a picker and wrong for a
range: on a phone the row wraps, the track dropped to its own line, and it stopped at
about a third of it — 39% measured — so a twenty-stop range had two stops under a thumb.
The row asks what it is holding (`:has(.tp-slider)`) rather than every caller remembering
to say, and only under the phone breakpoint: in a desk column the pack draws these as
rows with the track beside the label, where it already has room.

**IT IS A MEASUREMENT BECAUSE THERE IS NOTHING TO READ.** The screen says the same words
at either width, and a screenshot of a short track looks like a screenshot of a slider —
which is how it shipped.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
