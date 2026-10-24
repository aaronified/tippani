# ADR-0362: The image's credit is the mark plus "made with", and the mark is drawn rather than loaded

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** 1.7.9

**Decided.** The footer of a shared card carries, bottom-left, in `--faint`: the Tippani mark, the words "made with", the wordmark and the Bengali wordmark. The mark is **canvas geometry** — the bubble, its tail, the two ৭ glyphs and the punch-card column, in `mark.svg`'s own 256 coordinates — not an `<img src="/mark.svg">`.

**Why.** A picture of a quote is the one artefact this app makes that leaves it, and by the third re-post nothing travels with it except what was painted in. "tippani" alone named the app to somebody who already knew it, and to everybody else it read as a signature under words that belong to whoever said them; "made with" is what makes it a credit rather than a claim.

Drawn rather than loaded because `mark.svg` is a *fetch*, and it would make the one part of the card that says where the picture came from the one part that needs a network round-trip to be correct. The portraits can afford that — they arrive and the card redraws — and a wordmark cannot: the PNG exported in the first half-second is the copy that goes out. Same-origin and untainted was never the problem; being late was. The gradients, ink hairline and displacement filter in the real file are left out, because none of them is legible at 20px and each would be a second definition of the logo to keep in step.

The mark keeps the brand's red — lifted to `#D8613D` on a dark card — rather than taking `theme.accent` like every other coloured thing on the canvas. A blue tippani logo is not the tippani logo, and since the accent is the natural thing to reach for here, that is what the test asserts.

**Instead of** louder branding: a corner badge, a bottom bar, the mark at 40px. Rejected on the same reasoning that put it bottom-left in `--faint` to begin with — branding somebody is about to post is branding they will crop.

**Approved.** Mine. I asked for the logo and for it to stay unobtrusive, and picked the corner.

<sub>1.7.9 — `web/frontend/src/quoteImage.js` · `web/frontend/src/help.jsx` · `web/frontend/test/dom/quote-image-brand.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
