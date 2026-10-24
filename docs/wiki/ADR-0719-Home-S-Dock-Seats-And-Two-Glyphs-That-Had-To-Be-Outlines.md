# ADR-0719: Home's dock seats, and two glyphs that had to be outlines

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask: "homepage bottombar: right of the ＋, put one navigation icon … and
another will open a popup with settings, stat, and metadata."*

- **Published by the shell, not by Home.** `useScreenBar`'s `keys` is the screen's
  channel, and Home would have needed six new navigation props to use it — it has three
  today (`onGoLibrary`, `onGoMovies`, `onGoQuotes`) and they exist because Home draws
  tiles for them. `selectTab` and `sections` both already live in `Shell`, one line above
  the `MobileDock` call, so the seats are composed there and handed over as
  `barKeys || homeKeys`. A screen that publishes its own still wins.
- **The first key collapses to a door.** With one section switched on there is nothing to
  choose between, so it becomes that section's own tab wearing that section's own rail
  glyph. A menu of one is the dead control this repo keeps arguing against, and it is
  reachable: `visibleSections` guarantees at least one content section but not more.
- **Both glyphs are outlines, and the rail's for the same destinations are not.** The
  fill rule's second exception is "the glyph names a PLACE rather than a job" — and a key
  that opens a list of four places is a control. The place is the row you press inside it.
  `IconTools` is deliberately the outline of `IconSliders`, which is the rail's Settings
  glyph: same family, and the outline says door rather than room.
- **Tags is not one of the tools.** Settings, Stats and Metadata are the three screens
  *about* the library; a tag is a thing you file quotes under. A fourth row would make the
  key "the rest of the drawer" rather than a group.
- **`DockMenu` draws the dock's own button** instead of reaching for `MoreMenu`, which
  renders an `IconButton`: a seat 4px shorter than the four beside it is the kind of
  difference nobody can name and everybody sees. `ActionMenu` underneath is the same menu
  every card opens, so the rows and the keyboard behaviour are not written twice.
- **The hairline after ＋ is gone**, on the owner's call. It separated the shell's three
  fixed keys from the screen's two, and the accent key already does that.

<sub>Unreleased — `web/frontend/src/App.jsx` · `ui.jsx` · `index.css` ·
`scripts/glossary/catalogue.js` · `internal/i18n/{en,bn}.txt` ·
`test/dom/shell-mount.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
