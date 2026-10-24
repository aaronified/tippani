# ADR-0371: The share image's colour tint defaulted on, as information about the quote

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted

**Decided.** When the tint shipped it was one switch for both card kinds — on a plain card the colour is the stripe beside the words, on a backdrop card it is the hue of the portrait — and it defaulted on.

**Why.** The reasoning was that it is one decision, not two, because "do I want this quote's colour in the picture" is the same question either way; and that the colour is information about the quote, so including it is the fuller artefact. It is never both at once — a stripe next to a portrait already wearing the colour is the same thing said twice, the second time louder. The one-switch half was right and survives. I approved the default, and see below.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
