# ADR-0370: The portrait tint is a duotone applied before the fade mask, with the blend mode read back

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/test/dom/quote-image-portrait.test.jsx`

**Decided.** The quote's colour is applied to the portrait as a duotone — the blend keeps the photograph's luma and takes the highlight colour's hue — while the buffer is still opaque, and the fade mask is applied after. The canvas's `globalCompositeOperation` is read back after assignment, with a `source-atop` wash standing in when `color` did not take.

**Why.** Order first: tinting after the mask leaves the colour surviving as a coloured rectangle where the face used to be, so the fade has to come second for the colour to fade out *with* the face. Read-back second: `color` is a CSS blend mode, not a Porter-Duff operator, and a canvas that does not implement it ignores the assignment **in silence**, leaving whatever was set before — which is `source-over`, and painting a quote colour source-over is a flat slab across somebody's face. The property is therefore read rather than trusted. The test drops `color` from what its canvas accepts and asserts the fallback happens, because "it works in my browser" is the exact shape of claim that guard exists to stop anyone making. Both facts are asserted rather than assumed, and a mutation that swaps the order fails the suite. I signed this off after the mutation run, not before.

<sub>`web/frontend/test/dom/quote-image-portrait.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
