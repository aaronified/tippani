# ADR-0602: Frontend tests assert paint calls and canvas output, not configuration or markup

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** Share-image rendering is tested through a recording context, with one recorder per canvas sharing one ordered log, and assertions phrased as "the halo was in force at the moment each word was painted".

**Why.** `ctx` state is a single mutable register, so a shadow set before the portrait and cleared before the text is indistinguishable from one never set at all unless you look at the paint calls themselves. Each offscreen buffer is traced back to the photo that went into it, because the card builds each portrait in its own buffer and a single recorder cannot tell "the photo went into its buffer" from "the photo was stamped on the card" — which is the entire distinction — and two portraits of the same face land in exactly the same two places, so geometry alone would pass. Similarly, the colour-default test asserts against the canvas rather than the toggle's markup, because a control reading Off while the drawing code carries on tinting is a state desync, not a labelling slip. Nothing here throws: "a backdrop drawn for the wrong person, on the wrong side, at the wrong depth, or when nobody asked for one is a stranger's face across somebody's words in a picture they are about to post."

**Instead of.** Asserting configuration or DOM state — passes for the failures that matter.

**Approved.** Mine, and I approved the recorder as the house pattern for anything drawn rather than rendered.

<sub>1.6.0</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
