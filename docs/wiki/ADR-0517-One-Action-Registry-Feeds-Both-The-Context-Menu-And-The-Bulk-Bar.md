# ADR-0517: One action registry feeds both the context menu and the bulk bar

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.10.0 · works 1.11.1

**Decided.** `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)` in one module, built as commit 1 — before either feature — changing no behaviour. `QuoteActions` renders the registry instead of its hardcoded three; `SearchBulkForm` renders the bulk list.

**Why.** A context menu asks "what can I do to *this*"; multiselect asks "what can I do to *these*". Built separately, the app ends up with two answers to the same question — a menu that offers Delete beside a bar that does not — and the divergence is invisible until somebody notices one of them is missing something. Today an action's definition is spread across whatever renders it: `QuoteActions` knows Share/Edit/Delete, a work's delete lives in `WorkDetails`, the shelf move lives in `Library`, and nothing knows the *set* — which is exactly why there is no context menu and why the bulk form offers tags-and-fields rather than "the things you can do to a quote". If the screens look identical after commit 1, the registry is right. My call, and building the shared thing first is the part I have to keep re-deciding.

<sub>1.10.0 · works 1.11.1 — `web/frontend/src/actions.jsx` · `web/frontend/src/selection.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
