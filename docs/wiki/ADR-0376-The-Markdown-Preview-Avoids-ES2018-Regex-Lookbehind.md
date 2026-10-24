# ADR-0376: The Markdown preview avoids ES2018 regex lookbehind

Source of truth: this wiki page.

- **Area:** [§10 What Leaves the App: Exports, Round-Trips and the Shared Image](ADR-Index.md#area-10)
- **Status:** Accepted
- **Version:** `web/frontend/src/share.jsx`

**Decided.** The italic-but-not-inside-snake_case rule consumes the boundary character as group 1 and re-emits it as text, rather than using a leading lookbehind.

**Why.** Older Android WebViews and Safari lack ES2018 lookbehind, and Vite lowers the literal to a runtime `new RegExp(...)` that then *throws* there — blanking the whole app, not degrading the preview. This is the failure that motivated the ErrorBoundary as well, and it is worth recording as a rule rather than a fix: the share dialog is reached from a phone more than from anything else, so it is the worst place in the app to use a recent language feature. My call.

<sub>`web/frontend/src/share.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
