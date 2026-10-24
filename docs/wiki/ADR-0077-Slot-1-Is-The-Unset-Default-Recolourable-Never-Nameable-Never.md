# ADR-0077: Slot 1 is the unset default: recolourable, never nameable, never hideable

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.7.0

**Decided.** The server refuses both a name and a hidden flag on the first slot. Its hex is the reader's to change. `CATEGORY_DEFAULT_NAME` starts with an empty string, and its label is `UNSET_LABEL` — "Uncategorised".

**Why.** It is the column default *and* what an import writes when the source gave no colour, so a yellow quote may be yellow because you chose it or because nobody chose anything. Nothing can tell those apart, and naming it would silently label every unmarked quote ever imported. Colour is presentation, so recolouring it costs nothing.

**Reversal.** The original roadmap note did not see this. I had filed naming the colours as an afternoon's work with no edge cases in it. That note left the roadmap when the feature shipped, which is why the correction is recorded here instead of beside the prediction.

**Approved.** My call, made once the first import was staged against it, and I approved the correction to the roadmap rather than editing the prediction out.

<sub>1.7.0 — `web/frontend/src/theme.js` · `docs/roadmap.html` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
