# ADR-0305: A confirm step replaced undo, because the roadmap asked for the wrong thing

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `srSubmit`, off by default: a tap SELECTS an option and a Submit button commits it. Until you press it, tapping another option changes your mind and nothing has left the browser.

**Why, and the reversal.** The roadmap line asked for "undo the last answer", which needs the previous half-life stored — a column this section is built on not having. The reader restated the actual want as *"optional submit button instead so answers can be changed after clicking. this will protect against misclicks"*, which is the same problem solved before it happens rather than after.

**Not offered on flip or cloze cards.** Typing an answer and pressing Check is already a submit step; revealing a card and then saying whether you had it is already two acts. A confirmation on either is asking twice.

**The plan said "this is client only" and was wrong.** The preference needs a field in the prefs struct and a branch in the merge, or the PUT is accepted and silently discarded by `loadPrefs`' typed unmarshal and the toggle reverts at the next login. What is genuinely client-only is the answer endpoint.

**Approved.** The reader's, in the form quoted above.

<sub>1.15.0 — `internal/httpapi/auth_handlers.go` · `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
