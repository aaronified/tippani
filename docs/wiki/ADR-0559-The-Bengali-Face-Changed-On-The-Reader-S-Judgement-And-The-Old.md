# ADR-0559: The Bengali face changed on the reader's judgement, and the old one stayed on the list

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Bengali is Noto Serif Bengali and Devanagari is Noto Serif Devanagari. Tiro Bangla and Tiro Devanagari Hindi are both still offered.

**Reversal.** An earlier release had replaced Noto Serif Bengali *with* Tiro Bangla, for a stated reason I still think is a reasonable one — "a text face with real Bengali letterforms rather than a pan-script fallback". The person who reads Bengali in this app called it horrible, which is the only evidence that counts about type somebody has to read every day. Devanagari moved the same way on the same reader's milder version of the same note.

**Reversing a choice is not deleting it.** Both previous faces are on the list they were removed from being the default of, which is what a picker is for.

**Approved.** The reader's, in the form "change the bengali font. it is horrible. Hindi font can be improved as well, but it is not as bad."

<sub>1.15.0 — `web/frontend/src/index.css` · `web/frontend/src/fonts.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
