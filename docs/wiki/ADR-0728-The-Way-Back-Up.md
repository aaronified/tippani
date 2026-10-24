# ADR-0728: The way back up

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The app had no back-to-top control on any screen**, and the only `scrollTo` in the
  tree is the shell's own scroll-restore. On a phone that makes a long board a minute of
  flicking: there is no scrollbar to drag and no Home key to press.
- **Measured against the scrollable DISTANCE, not a pixel count**, which is the pack's
  rule and the part worth keeping: "what makes a page long is how far there is to come
  back, so a short book never grows the key and a long one gets it a quarter down." A
  fixed 600px trigger would arm it on a three-quote book that has 600px of hero.
- **The 200px floor is the other half.** A page you can barely scroll would otherwise arm
  the key inside its first thumb-length, which is where it is least use and most in the
  way. Both numbers have a test, and both tests assert the negatives as TRANSITIONS —
  armed first and then watched to go away — because a `waitFor` on a negative is
  satisfied by the frame before the measurement lands and would pass against any rule.
- **It sits above the dock and drops when the dock leaves**, on the pack's reason: "so
  the corner never holds two things and never sits empty." Both offsets are measured from
  the gesture inset, so the key clears a home bar on the hardware that has one.
- **Drawn at every width and hidden by CSS**, exactly as the dock is and for the dock's
  own stated reason — "the bar's visibility is CSS, so rotating a tablet never remounts
  it". Only the scroll listener is gated on the viewport; there is no point measuring a
  page for a key that cannot be drawn.
- **Opacity and pointer-events, never `display: none`.** The key keeps its place, and
  nothing can tab into a key that is not on screen (`tabIndex` says the same from the
  other side). Its visibility is a boolean rather than a cue, so with every animation
  disabled it is exactly where it is — the rest-state rule holds without needing an
  exemption.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `App.jsx` · `index.css` ·
`internal/i18n/{en,bn}.txt` · `test/dom/shell-mount.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
