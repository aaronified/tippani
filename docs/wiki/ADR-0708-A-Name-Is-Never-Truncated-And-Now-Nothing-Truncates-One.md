# ADR-0708: A name is never truncated, and now nothing truncates one

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Closes the second open question. The owner: "Fix them all."*

- **`NameScroll` in `ui.jsx`** is the one mechanism: it renders the element, wears
  `.name-scroll`, and attaches `useEdgeScroll` so the fade is MEASURED — it appears only
  when something is behind the edge. A bare class could not measure, and a fade with
  nothing behind it makes every other fade in the app a maybe.
- **Thirty-six sites across ten files**, classified first (is this a name, or a count, a
  date, a path, a sentence?) and converted second. Four were left alone: a release year,
  a dialogue count, and the wishlist tile's two fixed locale strings.
- **A fade inside a button is safe here** only because of the earlier pointer-capture fix:
  capture is taken after 3px of movement, so a press-and-release still reaches the button.
  That is what makes this legal on the twelve sites that are also doors.
- **`.tp-panel-title` was caught by the guard, not by the eye.** The new
  `no-truncated-names.test.js` reads the stylesheet and fails on `text-overflow: ellipsis`
  in a class that holds a name; it found the panel's own title while it was being written
  for the back button beside it.
- **The guard accepts scrolling OR wrapping**, because `.cast-opt-name` wraps — a fade
  inside `role="option"` would promise a drag that must not fire. Demanding a scroller
  would have called that correct decision a defect, and did, on its first run.
- **`make typescale` is green and its baseline is zero.** 47 → 98 (the rail's cost) → 0.
  The file is a floor now rather than a debt: a screen above zero has introduced a new
  one, and the answer is to fix it rather than to write the number down.

<sub>Unreleased — `web/frontend/src/ui.jsx` (NameScroll) · ten screens ·
`test/rules/no-truncated-names.test.js` · `scripts/screenshots/typescale-baseline.json`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
