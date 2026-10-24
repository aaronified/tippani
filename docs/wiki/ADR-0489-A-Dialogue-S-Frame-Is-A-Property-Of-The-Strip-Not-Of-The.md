# ADR-0489: A dialogue's frame is a property of the strip, not of the dialogue

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx` · `web/frontend/src/Movies.jsx`

**Decided.** `useFrameBase()` picks `11 + floor(random()*28)` once per mount, and each frame renders `${base + i}A` from its position in the strip.

**Why.** The frame code is set dressing on a filmstrip — it says "this is the seventeenth frame of this reel", which is a fact about the strip and the position, not about the line of dialogue. Storing it per dialogue would make it survive re-ordering and filtering, so a filtered strip would show frames 12, 19, 27 and read as damaged film. Regenerating per mount also means it is honest about being decoration. My call, and it is the smallest decision in this section that would have been irreversible if I had put it in the schema.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/Movies.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
