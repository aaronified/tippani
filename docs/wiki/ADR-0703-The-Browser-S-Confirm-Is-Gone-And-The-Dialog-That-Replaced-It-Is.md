# ADR-0703: The browser's confirm() is gone, and the dialog that replaced it is portalled

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — `useConfirm()` in `ui.jsx` returns `{ ask, confirmDialog }`, the shape
  `usePractice` already uses. The call site keeps the line it had:
  `if (!(await ask(question))) return`.
- **Why a promise rather than a pending-item state.** Thirteen destructive actions were
  still written as one guard line before the work, reading in the order it happens.
  Rewriting each as a pending item plus a dialog plus a second handler is thirteen chances
  to wire the wrong item into the wrong dialog, on thirteen screens, for no gain.
- **The half nobody could see: jsdom has no `confirm()`.** It warns and returns undefined,
  which is falsy — so every one of those thirteen deletes returned early in every test that
  reached it. They were not thinly covered, they were uncoverable, and the first test to
  run a tag delete end to end is the one that shipped with this.
- **`ConfirmDialog` now portals to `<body>`, and that was a live bug.** A `.hand-card` is
  `isolation: isolate`, so a dialog rendered inside one is trapped in that card's stacking
  context and every later sibling paints over it — `z-50` cannot help, because z-index is
  only compared within a context. `FormModal` had already learned this and says so at its
  own portal; `ConfirmDialog` had not, and only got away with it because every previous
  caller happened to render it at the top of a page. **Found by looking at a render** of
  the tag delete, where the question appeared underneath the tags. jsdom has no paint, so
  no test could have seen it; the test that now guards it asserts the structural cause —
  the dialog is not a descendant of the component that asked.

<sub>Unreleased — `web/frontend/src/ui.jsx` · nine screens · `test/dom/confirm-hook.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
