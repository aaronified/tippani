# ADR-0563: The share image resolves the same faces, because canvas cannot read a custom property

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `quoteImage.js` builds its font shorthands from `fontChoice`, rebuilt inside `ensureFonts()` — the one thing every draw already awaits.

**Why it is worth an entry.** It is the easiest consumer to forget. A type swap that only rewrote the stylesheet would leave every exported card in the old face, which is the same class of bug as a filter that changes one screen: correct everywhere you look and wrong where you do not.

**What follows the preference is the FAMILY, not the weights.** The card is a drawn composition — its quote is italic and its footer is 600 because the card is designed that way, not because the display role is. Applying "all caps" from Settings to a share image would restyle a picture somebody is about to send to somebody else.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/src/quoteImage.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
