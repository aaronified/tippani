# ADR-0731: The twelfth line in Details, and the fourth state a cast row has

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask: "the metadata needs to show the source, line wise."*

- **Eleven of the twelve lines already did.** Every credit field has carried its supplier
  since 0054; the cast list drawn directly beneath them carried nothing, while
  `work_cast.origin` had held the answer since 0048 and no screen had ever read the
  column. The panel was line-by-line for eleven fields and then showed twenty lines with
  no line on them.
- **Four states, not the tag's usual three, and the extra one is the argument.**
  `corrected` — seeded by a supplier, then edited by the reader — keeps the SUPPLIER's
  mark, because that is where the row came from and a refetch still owns its billing and
  its ids; a note says what has happened since. Collapsed into `provider` it tells the
  reader a refetch will overwrite their correction; collapsed into `reader` it hides that
  there is an upstream row underneath at all.
- **The note reaches the tooltip and the screen reader, not the row.** A cast list is
  twenty rows deep and a word repeated on each is a word nobody reads.
- **A missing supplier slug is answered two different ways, by origin.** On a `provider`
  row: nothing, because naming a supplier that was never recorded is a supplier the
  reader would go looking for. On a `corrected` row: the accent, because "you edited
  this" is the only true half left and it is the half a refetch is forbidden to
  overwrite. Falling silent there would drop the more important of the two facts.
- **NOT BUILT, and named so it is not mistaken for done:** handoff §1.2's last clause —
  "tapping it opens that field's candidates with the value each source is offering, side
  by side". The data is already end to end (`fieldAlt{source, value}` per field, rendered
  side by side by `ReverifyReview.jsx`); what is missing is the door from a Details
  field's tag into it. **Built in the entry below** — and it needed more than a door,
  because the diff those alternatives hang off is empty for exactly the field whose tag
  you would press.

<sub>Unreleased — `web/frontend/src/cast.jsx` · `ui.jsx` ·
`internal/i18n/{en,bn}.txt` · `test/dom/cast-source.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
