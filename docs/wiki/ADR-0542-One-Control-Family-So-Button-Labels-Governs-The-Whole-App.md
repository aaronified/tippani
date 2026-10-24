# ADR-0542: One control family, so "Button labels" governs the whole app

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.13.0

**Decided.** `IconButton` and `MoreMenu` take an optional `label` and render the same `.btn-icon` + `.btn-label` pair `Button` does. The selection bar's actions carry their words, and its count became a button whose glyph is the number and whose label is "Deselect all".

**Why.** The setting claimed to govern the app and governed a minority. Controls split into two families and membership was accidental: `Button`, `StickerButton`, `FilmButton` and `FilterChip` emit the span the stylesheet clips; `IconButton`, `MoreMenu`, `CloseButton` and an icon-less `GhostButton` emit no span at all, so there was nothing for Show to reveal and nothing for Hide to clip. Counted: 31 of ~123 primitive uses honoured the preference, 78 could not, and 213 raw `<button>` elements bypass every primitive — 44 of them inside `ui.jsx`. The selection bar was built entirely from the family that cannot, which is the row with the least room and the one where the preference matters most.

**No new CSS was needed, and that is the sign the seam was already right.** `.btn-label` is deliberately not scoped to `.tp-btn` — that is what lets another control opt in — and `.tp-btn.has-btn-icon` squares back to the same 44px `IconButton` uses unlabelled, so a labelled row lines up with an unlabelled one. The label is opt-in, so all 25 existing uses are byte-identical.

**The count is the control.** A sentence saying "12 books selected" beside a worded `Deselect all` was one idea drawn twice, on the bar least able to afford either. Merging them also separated the two that were adjacent: `Deselect all` and `✕` side by side read as the same control twice, and the one that ends the mode is the one you reach for by accident.

**Zero is spoken rather than shown.** The badge reads `0`, dimmed and disabled, and its accessible name is "no books selected". The older rule — that a zero in a count reads as something having gone wrong — still holds for a bare number in prose, but the reason has to live where it survives the words being clipped.

**The test pins the mechanism, not the appearance.** Whether a word is visible is CSS and a preference, neither of which jsdom can see, so the assertion is that the word is in the span the stylesheet clips, on a button carrying the class that squares it. The `⋯` is asserted to have no label: "More" beside three dots is the same thing said twice.

**Not done here.** The remaining ~75 non-participating controls and the 213 raw `<button>` elements. Named as a known gap rather than left implied.

**Approved.** The reader chose one family over fixing the selection bar alone, having been shown the count.

<sub>1.13.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/test/dom/selection-bar.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
