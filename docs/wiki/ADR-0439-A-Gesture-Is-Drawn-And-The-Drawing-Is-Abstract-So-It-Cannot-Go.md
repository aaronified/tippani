# ADR-0439: A gesture is drawn, and the drawing is abstract so it cannot go stale

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 2.0.1

**Decided.** `gestures.jsx` holds eleven clips as inline animated SVG. `IMPLEMENTED` is the two the app binds — the 500ms long press and the drawer's leftward swipe — and a test fails if the interface references any other.

**Why not a GIF**, which is what was asked for and what this is visually indistinguishable from: 1–2 KB instead of 10–30 and it lives in a diff; one file rather than one per theme, because every stroke is `currentColor`; and **it can stop.** A playing GIF ignores `prefers-reduced-motion` entirely. Go's `image/gif` would have produced real GIFs with no new dependency and was declined on those three grounds.

**The still frame is set explicitly, not left to `animation: none`.** The travel keyframe starts *and* ends at `opacity: 0`, so simply stopping it would have rendered every swipe invisible. With motion off each clip holds the pose that states the gesture: the ring at full size, the tip at the END of its trail beside the dashed line it travelled.

**Why the art is abstract** — a disc for the fingertip, a trail for the travel, a ring for the wait — rather than a screenshot with a hand over it: an abstract clip is not tied to the interface, so a restyle cannot make it wrong and one clip serves every context that gesture ever appears in. That is what lets this be a fixed library rather than a maintenance surface.

**Nine clips are unreachable on purpose.** There is no pinch handler anywhere and swipe-to-open is deliberately absent, because the left screen edge belongs to the OS back gesture. The nine exist so a newly bound gesture is a one-line reference rather than a new asset pipeline — and a test reads the tree, not this paragraph, so the day a pinch lands it fails and asks for the clip to be promoted.

**Approved.** The owner's, including the argument for it: an abstract gesture clip "never gets stale, and can be reused in different contexts". The eleven-not-two call is theirs too.

<sub>2.0.1 — `web/frontend/src/gestures.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
