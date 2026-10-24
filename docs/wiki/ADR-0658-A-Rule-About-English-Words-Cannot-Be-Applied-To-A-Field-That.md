# ADR-0658: A rule about English words cannot be applied to a field that might hold a name

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.4

**Decided.** `capitalizeNames` is promote-only and is what a PERSON gets; `capitalizeTitle` adds the small-word rule and is what a TITLE gets. The field says which.

**What went wrong.** 2.2.3 added the small-word list to the single casing rule so that "The Wheel of Time" could be typed. That rule runs on author, translator, editor, director, actor, character, speaker and recipient as well — and `an`, `in`, `so`, `to`, `by`, `up` are whole names in Vietnamese, Korean and Chinese. "Nguyen Van An" came back "Nguyen Van an".

**It is the same class of mistake the function's own header refuses**, committed by the fix for a different instance of it. The header argues at length about `van`, `de` and `Le` — European particles — and the list was written with those in mind. The failure was one continent over.

**The escape hatch is no defence here.** Re-casing a letter sends the field `free`, which is a real hatch for somebody who knows the rule exists. Nobody typing their own name knows that, and nobody should have to.

**And there is no heuristic that separates them.** "The Wheel of Time" and "Nguyen Van An" are both four words with a small word in the middle. Only the field knows which it is, so only the field can say.

<sub>2.2.4 — `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
