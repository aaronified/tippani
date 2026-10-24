# ADR-0363: The credit is one baseline and one optical centre, with no per-run nudges

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** 1.7.10

**Decided.** All three words of the footer credit — "made with", the wordmark, the Bengali wordmark — are drawn on ONE baseline, at their three different sizes. The mark, which has no baseline, is centred on the **cap-height band** of those words: `base - FOOT_CAP` to `base`, where `FOOT_CAP` is 0.7em of the 14px face.

**Why.** 1.7.9 shipped the line with three slightly different alignments — the mark hung off the baseline (so it floated, because the caps it sits beside only reach 0.7em) and the Bengali was lifted a pixel for no stated reason. A shared baseline is how mixed sizes are set on a line; the pixel of lift is what made it stop looking like a line.

Centring the mark on the em box would have been the other plausible reading and is wrong here: an em box includes descender space this line never uses, so it pushes anything beside the words visibly high — which is the bug, arrived at from the other direction.

**Instead of** eyeballing each element until the rendering looked right. That is how the first version was built, and it is why the test now asserts the three baselines are **equal** rather than "within a pixel or two": an approximate assertion is an invitation to re-add the fudge.

**Approved.** Mine — I reported the misalignment.

<sub>1.7.10 — `web/frontend/src/quoteImage.js` · `web/frontend/test/dom/quote-image-brand.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
