# ADR-0524: Gesture ground rules come before any gesture, and swipe-between-tabs is rejected permanently

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `docs/roadmap.html`

**Decided.** Seven constraints written down before the first new gesture: nothing starts within ~32px of a screen edge or in the home-indicator strip; prove direction before capturing (10px on the dominant axis, dominant by ~1.5×); `touch-action: none` only on the element that owns a gesture and never on a scrolling ancestor; `user-select: none` on card chrome but never on quote text; every gesture additive; one Settings toggle turns them all off; `navigator.vibrate(10)` on commit. Swiping between the four bottom-nav tabs is rejected outright and recorded so I do not revisit it.

**Why.** A web app that fights the operating system for a swipe loses, so the constraints have to exist before the list of gestures rather than as corrections to it. Every gesture being additive is simultaneously the accessibility requirement and the answer to how anyone discovers a gesture at all — the ⋯ overflow, the ♥ and the filter sheet all stay exactly as they are. The permanent rejection is the entry that earns its place: a screen-width horizontal gesture fights the back gesture at both edges and any horizontally scrollable content in between, and the bottom bar is already one tap away. Recording a *no* is worth as much as recording a yes, because without it I will have the same good-sounding idea again next year. Two more are held back until the bin lands, because a mis-swipe must be recoverable. Mine.

<sub>`docs/roadmap.html`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
