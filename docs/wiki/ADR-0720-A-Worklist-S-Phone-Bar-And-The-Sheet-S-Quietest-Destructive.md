# ADR-0720: A worklist's phone bar, and the sheet's quietest destructive control

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's calls, three of them, and each undoes a decision this file argued for.*

- **The order rejoins the filter sheet.** 1.14 split them, on the reasoning that "a
  filter changes WHICH rows you are looking at and a sort changes only their order" and
  that "two dock keys pointing into one sheet would be the same door twice". The first
  half is true and the second is the mistake: the two keys pointed into two DIFFERENT
  sheets that looked identical, which is worse than one door — a reader had to remember
  which of two identical surfaces held the thing they wanted. The sort is the last
  section of the filter sheet, after everything that can change the count its footer
  states.
- **Export takes the seat.** It is the one verb on a worklist with nowhere else to be on
  a phone; the previous note put it in the top bar's ⋯ and called sorting "something you
  reach for while you are looking at the board", which the sheet now serves.
- **The ⋯ drops *show only* and *sort*.** The menu-bar principle — deliberate duplication
  of the visible controls, so a reader can find something without knowing it is there —
  is not wrong, it has run out of room on this screen. Those rows were the third door:
  chips and a sort select on the page at desktop widths, the same controls behind the
  Filter key on a phone. What is left in the menu is what has no other door on the
  viewport it is drawn at.
- **Reset is a button now.** `SheetFooter` drew it as a 34px `FieldIconButton` with an
  anticlockwise arrow and no word, beside a 110px filled Done. A tinted ghost rather than
  a filled slab, because the app's fill vocabulary reserves a slab for the row's primary
  action and this one is not it; `keepLabel`, so the word survives labels resolving to
  off on a phone, which is the only place this footer is drawn.

<sub>Unreleased — `web/frontend/src/works.jsx` · `ui.jsx` ·
`test/dom/board-filters.test.jsx` · `internal/i18n/{en,bn}.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
