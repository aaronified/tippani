# ADR-0302: The client keys a flip card on the ABSENCE of options, not on the direction string

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `isFlipCard(card)` is true when the card has no options and no cloze blank — never `card.direction === 'flip'`.

**Why.** It makes an unknown direction from a newer server degrade to the one card type that always works, instead of rendering as a multiple choice with nothing to choose. A card with options is a question this client knows how to grade; a card without them is not, whatever it calls itself.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
