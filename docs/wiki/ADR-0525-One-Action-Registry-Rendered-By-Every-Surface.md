# ADR-0525: One action registry, rendered by every surface

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.9.0

**Decided.** `actions.jsx` holds `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)`. The card row, the ⋯ overflow and the context menu all render from the first; the search screen's bulk form renders from the second. An action carries its own placement (`row` or `overflow`), and one that does not generalise to a selection is marked `single`.

**Why.** An action's definition used to live in whatever rendered it. Nothing knew the SET, so nothing could offer the set anywhere else — which is why there was no context menu, and why the bulk form offered tags-and-fields rather than "the things you can do to a quote". The moment there are two surfaces, two definitions diverge: a menu offering Delete beside a bar that does not looks completely normal on both, and nobody notices until somebody asks why they cannot do to forty what they just did to one.

`single` rather than omission is the load-bearing detail. Edit genuinely does not generalise — editing forty quotes is a bulk field change with its own form, not this action forty times — and stating that with a flag makes it a decision. Absence would make it indistinguishable from drift, which is the thing this file exists to prevent.

**Instead of** building the context menu with its own list and reconciling later. Reconciling later means noticing later.

**Approved.** Mine, and I approved the ordering: the registry first, changing no behaviour, before anything read from it.

<sub>1.9.0 — `web/frontend/src/actions.jsx` · `web/frontend/test/dom/actions-registry.test.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
