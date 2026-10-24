# ADR-0635: Every screen is mounted by a test, because extracting the logic left the screen unexecuted

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 1.13.2

**Decided.** `test/dom/screens-mount.test.jsx` renders all thirteen screens and asserts none throws. The list is checked against the `data-screen-label` attributes in `App.jsx`, so a screen App can route to and this file does not name is a failure. `Login` and `Onboarding` are exported from `App.jsx` for it. The api is mocked to REFUSE every request.

**Why.** 1.13.0 shipped a Quotes screen that threw on sight — `board` was read in three dependency arrays written above its own `const`, and a dependency array is not a closure, so it was evaluated inside its own temporal dead zone. Every render, every library, empty or full, replaced by the error boundary. It survived a release, a point release, and two servers.

**The reason no test caught it is the part worth keeping.** Ten tests covered that file and every one of them imported a FUNCTION out of it — `groupUtterances`, `utteranceState`, `utteranceMeta`, `utteranceYear`. Extracting logic from a component so it can be tested without rendering a screen is right, and it is precisely what left the screen itself never once executed. **A page can be wholly broken while every extracted piece of it is green**, and the greener the pure tests are, the more convincing the illusion. So the coverage this adds is not depth, it is the one assertion those ten could not make.

**Shallow on purpose.** It claims only that a screen can be put on a page. The screens with behaviour worth pinning have their own files; a smoke test that starts asserting content becomes a second, worse copy of them and rots.

**Refusing every request rather than returning empty collections.** A failed load needs no invented payload shapes, so this file cannot quietly become the place where thirteen response formats are guessed at and left to drift. It also exercises the state every screen must survive and nobody tests by hand: the server said no. A first-render throw happens before any fetch settles, so the mock's answer is irrelevant to catching the class of bug that prompted it.

**Driven by the source rather than by a list.** The same shape as the FTS-sweep completeness test: a table maintained beside a file is a table that rots, so `App.jsx`'s own screen labels are the authority and adding a screen without covering it fails.

**Verified by reverting the fix** — the quotes case fails with `Cannot access 'board' before initialization` and passes with it. A regression test never watched to fail is a test of nothing.

**Approved.** The reader's, in the form of the report: "quote screen now shows: can't access lexical declaration 'Se' before initialisation", later confirmed on a second server with quotes already in it.

<sub>1.13.2 — `web/frontend/test/dom/screens-mount.test.jsx` · `web/frontend/src/Quotes.jsx` · `web/frontend/src/App.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
