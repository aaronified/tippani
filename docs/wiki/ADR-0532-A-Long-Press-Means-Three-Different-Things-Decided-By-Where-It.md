# ADR-0532: A long press means three different things, decided by where it lands

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.11.1

**Decided.** REVERSED from 1.10.0. On a control it is still Tooltip's label. On `.card-text` — the quote and the note — it does nothing at all, so the platform's own text-selection handles come up. Anywhere else on a card it SELECTS that card. Right-click and Shift+F10 keep the menu; a surface with no selection to enter keeps the menu on the press too.

**Why.** 1.10.0 decided "long-press always means menu, with no exceptions" and put touch's way into a selection in a toolbar toggle. Both halves were wrong, and both are only visible under a thumb.

The menu on the press, plus `-webkit-touch-callout: none` on the card, meant a finger could not select half a sentence out of a quote. In an app whose entire purpose is keeping other people's sentences, spending the one gesture a phone has for reaching into text on a menu that already has a ⋯ button two inches away is the wrong trade — and I could not see it from a desktop, where dragging across the words has always worked.

And long-press-to-select is what every photo grid, file manager and mail app on both platforms already does. A toolbar toggle is a mode you have to be told about; the press is a gesture people arrive already knowing.

The region is MARKED rather than inferred. "Is this a text node" is not a question a pointer event can answer, and the two failure directions are not symmetric: too permissive gives you a card you cannot select, too strict gives you a quote you cannot copy out of. `.card-text` is set by `ExpandableText`, `FlowQuote` and `HandNote` rather than by each card, because those three ARE the prose everywhere they appear — a card that forgot the class would be a quote nobody could copy from, with nothing visibly wrong.

A cover tile carries no `.card-text` at all: a poster is a picture, and the title under it is a label rather than prose.

**Instead of.** Keeping the menu on the press and adding a Select toggle to each board's toolbar (the 1.10.0 decision — two mechanisms, one of them undiscoverable). Suppressing the callout everywhere and offering our own Copy in the card menu (reimplementing Look Up, Translate and Search With, badly, forever).

**Approved.** Reversed on the reader's report from a phone. I approved marking the region over sniffing it, and recorded the reversal here rather than editing the 1.10.0 entry.

<sub>1.11.1 — `web/frontend/src/ui.jsx` · `web/frontend/src/flow.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/card-menu.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
