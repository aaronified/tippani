# ADR-0718: The board header is one row, and the settings went behind ⋯

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The desktop prototype's own argument, applied to the app's shell rather than copied
into it.*

- **What the pack draws and what we drew.** `Book Detail Wide.dc.html` ends its board
  header with two verbs — `More` and `Add a quote` — and nothing else. Ours had grown to
  four controls plus Add: a grouping select, a sort select, a direction key and a
  three-option view toggle. The pack's reason for moving the view is not width alone:
  "it is also the control changed least often: you pick a view and read for an hour. A
  setting that costs the most width and earns the least use belongs behind ⋯."
- **Where the ⋯ is, we did not copy.** The pack has one popover, in the board header,
  titled *This book*, holding the board settings and the work verbs together. The app's
  shell has a published screen menu — `useScreenBar` — whose own note says it exists to
  name "which view you are in, which sort is running, what the filters are". Drawing a
  second ⋯ an inch below the shell's would give one screen two overflow menus. So the
  board publishes a SECTION into the shell's, and `buildScreenActions` concatenates it
  ahead of the page's — a child's effect runs before its parent's, which is why the
  order comes out right without either side knowing about the other.
- **A row that opens a menu became a radio group.** The pack nests: `View` opens a
  second popover listing three. The shell's menu cannot nest, and it does not need to —
  three ticked rows under a heading answer "which view am I in" outright, at one press
  instead of two, and announce as `menuitemradio` rather than as a door.
- **The sort is the last row of the grouping's menu**, which is the pack's placement and
  its sentence: "the grouping is a field on the page, so the sort is the row at the end
  of its menu rather than a second control competing for the header". The row states the
  current order as its value, so one press away is still one glance away. `ActionMenu`
  grew `meta` and `sub` for that, and `keepOpen` so the sort's two questions — column and
  direction — can be answered in one visit, which is what the pack's own sort panel does.
- **List came back.** `ViewToggle` dropped it because "the third option cost a third of
  the switch's width to offer a fourth of a difference" — an argument entirely about the
  switch. `AnnotationBoard` never stopped rendering it, so `list` was a setting a reader
  could hold and not choose. A menu row costs no width.
- **Quote text is new, not moved.** `TVIEWS` in the pack is *both / quote only /
  translation only*, and the app had no way to ask. `quoteBody` PREFERS rather than
  obeys: asked for the translation of a quote that has none, it shows the quote. The
  alternative empties every untranslated card on a board where translations are the
  exception, which reads as a bug that has eaten the library rather than as a setting.
- **`useSelection` gained `begin`.** The two existing doors into the mode — long press,
  Ctrl-click — are gestures a reader must already know, on a board that never says the
  mode exists. `begin` enters it with nothing picked, which is the state `open` was split
  from `count > 0` to make expressible, and the row hides itself while the mode runs.

<sub>Unreleased — `web/frontend/src/Library.jsx` · `ui.jsx` · `selection.jsx` ·
`App.jsx` · `index.css` · `internal/i18n/{en,bn}.txt` ·
`test/dom/quote-text-view.test.jsx` · `test/dom/annotation-group-sort.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
