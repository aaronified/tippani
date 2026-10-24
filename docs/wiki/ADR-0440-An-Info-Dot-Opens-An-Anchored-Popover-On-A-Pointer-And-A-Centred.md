# ADR-0440: An info dot opens an anchored popover on a pointer and a centred card on a phone, and carries no hover label of its own

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.2

**Decided.** On a pointer, hover opens it and moving away closes it; a *click* pins it until clicked again, Escape, or a click outside. On touch, tap toggles and every touch-opened popover behaves as pinned. On a pointer it is anchored to the dot with a caret; on a phone it is a compact centred card. The dot carries no tooltip.

**Why.** An explanation should cost a glance, not a click and a dismissal — but text you want to re-read or copy must not evaporate when the mouse drifts, hence the pin. Anchoring matters on a pointer because several dots often sit within a few pixels of each other, so "which one was that" is a real question; on a phone a 40px anchor on a 360px screen gives no useful direction and the finger is already covering it. The dot had a tooltip — "About ISBN" — and on a phone that was two mechanisms answering the same question: hold the dot to be told it explains the ISBN, tap it to be told what an ISBN is. The first is a label for a control whose entire content is a label.

**Instead of.** A full-screen sheet for one sentence — rejected; that shape is right for a screen's whole glossary and absurd for a sentence.

**Reversal.** The tooltip on the dot was mine, and removing it was mine. What I got wrong was applying the "every glyph-only control needs a label" sweep to the one control that is nothing but a label.

**Approved.** I approved the removal after watching it confuse people, which is the only reason I noticed the category error.

<sub>1.4.2 — `web/frontend/src/ui.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
