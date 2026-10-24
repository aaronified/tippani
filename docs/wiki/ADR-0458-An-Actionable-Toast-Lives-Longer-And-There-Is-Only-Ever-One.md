# ADR-0458: An actionable toast lives longer, and there is only ever one action

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.8.0

**Decided.** `toast(msg, {label, onClick})` renders one action beside the message and extends the pill's life from 1.5s to 6s. There is no two-action form.

**Why.** 1.5 seconds is one glance, which is right for news and useless for an offer: an Undo nobody can reach is decoration. Six is about how long it takes to read "deleted · Undo", decide, and move a hand — and the offer does not really expire when the pill goes, because the bin holds the thing for thirty days. The pill is the shortcut, not the safety net.

One action, because a toast is a glance and a choice is a dialog. Two buttons in a pill that vanishes is a decision under a timer.

`.toast` keeps `pointer-events: none` — it floats over the bottom of the screen where a tap belongs to the page underneath — so the action turns them back on for its own box only. That is the smallest hole that can be cut in it, and it is the kind of thing only a human tapping the button would find, so it is asserted against the stylesheet.

**Instead of** a persistent snackbar with a dismiss, which is a second thing to close, and instead of no shortcut at all: Settings → The bin is two screens away from the mistake.

**Approved.** Mine.

<sub>1.8.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/undo.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/undo-toast.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
