# ADR-0316: QuizRunner had no tests at all, and six features rewrote it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Tests landed *before* the state machine was split, not after.

**Why it is worth an entry.** The only thing that rendered `QuizRunner` was a smoke test that mounts every screen with all requests refused, so nothing ever reached an active deck. The submit-off path — the one every current reader is on — had never been asserted by anything, and six of the seven features in this release rewrite that component. Two of the three answer leaks above are in code that path runs.

**And a test that passed against its own bug.** The first version of the submit-step leak test checked for the words "not quite", which are gated separately, rather than for the option styling. It passed with the guard removed. Every guard in this release was verified by reverting it and watching the test fail.

**Approved.** Mine.

<sub>1.15.0 — `web/frontend/test/dom/quiz-runner.test.jsx` · `web/frontend/test/dom/card-tools.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
