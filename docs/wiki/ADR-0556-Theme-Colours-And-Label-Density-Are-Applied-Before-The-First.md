# ADR-0556: Theme, colours and label density are applied before the first paint

Source of truth: this wiki page.

- **Area:** [§15 Appearance as Material: Skins, Texture, Type and Colour](ADR-Index.md#area-15)
- **Status:** Accepted
- **Version:** `web/frontend/src/main.jsx`

**Decided.** `main.jsx` runs `applyTheme`, `applyColors` and `applyLabels` before
`render`, not inside a `useEffect`.

**Why.** Anything applied after mount is a frame of the wrong thing. On a phone that
frame is fully labelled buttons snapping to glyphs, and on a dark-theme device it is a
flash of paper-light — both of which read as a bug rather than as a load.

**Approved.** Mine, and the ordering in that file is load-bearing enough to be commented
as such.

<sub>`web/frontend/src/main.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
