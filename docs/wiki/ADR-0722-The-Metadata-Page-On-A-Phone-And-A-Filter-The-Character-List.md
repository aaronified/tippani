# ADR-0722: The metadata page on a phone, and a filter the character list never had

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The rail is a row at every width above a phone.** It became a 13.5rem left column
  at 900px and up, which is a sixth of a console screen spent on five words — in front
  of content that is almost entirely TABLES, the one thing that wants every pixel of
  width there is. Sticky, which the left column was and for the same reason.
- **A phone gets a field, not a strip.** Five tabs at 390px show two and a half of
  themselves, so the section you are not in is behind a scroll gesture with no arrow —
  the edge-fade rule working exactly as designed and still being the wrong control for
  this. The counts survive into the field's options, because the counts are why the
  rail is a rail and not a tab strip.
- **"Everything that needs work" is a superset of the coverage tiles.** The desktop
  answers this with a wall of tiles, each a filter button into the console beside it; a
  phone has room for neither, so it had the same numbers as sentences and nothing to
  press. Reading "3 with no author" and having no way to reach those three is the worst
  half of both designs. The sheet's rows are doors, and three of its six groups are
  people and character problems the strip has never counted — it only ever looked at
  the catalogue. Only non-zero rows are listed: a sheet of fourteen zeroes teaches a
  reader to stop reading it.
- **The people console's row was as tall as its widest cell.** "author · translator ·
  editor" wraps to three lines in a narrow column and a links strip wraps to two, so
  some rows were one line and some were three — the "weird gaps between some people"
  the owner reported. The roles are glyphs now, with the word in a tooltip and an
  sr-only span, on BOTH viewports: a cell drawn as words on a desk and as glyphs on a
  phone is two cells to keep in step, and the desk wants the width just as much.
- **The phone drops the two columns whose content is on the record.** Quotes is a count
  the person's own panel states; the links cell is the widest thing in the row. Neither
  is lost — the name opens the record.
- **And it stops being a scroller inside a scroller.** A 60vh box inside a page that
  also scrolls is two scrolls under one thumb, and the inner one wins every gesture
  that starts over the table. The desk keeps it: there the window is short and the
  console is long, which is the case the box was measured for.
- **The character list filters by work, which needed a server change.** `GET
  /characters` carried a COUNT of works and nothing else, and the filter cannot be
  built from a count. It now carries `works_in` — one entry per work, attached from a
  single extra query rather than a correlated subquery per row, because a character
  appears in a handful of works and the whole set is smaller than the list it hangs
  off. A failure there costs the dropdown and not the list. The dropdown is built from
  the characters themselves rather than from the library: a list of nine hundred books,
  eleven of which have a cast, is a list a reader scrolls past the answer in — and the
  console is also mounted where there is no library list to read.

<sub>Unreleased — `internal/httpapi/identity_handlers.go` ·
`web/frontend/src/MetadataPage.jsx` · `index.css` · `internal/i18n/{en,bn}.txt` ·
`test/dom/metadata-sections.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
