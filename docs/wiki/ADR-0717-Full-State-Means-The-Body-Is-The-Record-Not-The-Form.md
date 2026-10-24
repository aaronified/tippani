# ADR-0717: Full-state means the body is the record, not the form

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Three sites, found while scoping the Details panel. The worst of them could not be
undone.*

- **The rule, restated because it keeps being forgotten.** `PUT /books/:id` and
  `PUT /movies/:id` write every column unconditionally. A body that does not name a field
  writes the zero value over it. So the correct shape for any such body is *the record,
  with the form's own boxes on top* — and the incorrect shape, which is the one that
  reads naturally, is a literal listing the boxes this particular form happens to draw.
- **What each site lost.** `bookState` (the ♥ and the shelf) omitted `published_circa`,
  `language` and `orig_language` — the two languages storable since 0047 and never once
  sent by a client. `movieState` omitted `release_circa`. `fullState('book')` omitted both
  languages, which is why the language rows could not ship before this. And three bodies
  did not call a builder at all: `EditBook.submit`, `EditMovie.submit` (which cleared
  `imdb_id`), and Metadata's `BookRow.apply`.
- **Metadata's apply is the one that mattered.** A screen whose purpose is to make a
  record *more* complete was sending only the fields a candidate can improve, so applying
  a match cleared the translator, the editor, both languages and the circa flag.
  `store.SetCredits` DELETEs every `work_person` row for a role before re-inserting from
  the names it is given, and an absent translator is zero names — so the link went and
  `credit_as` went with it. That column is how one work prints a name differently from the
  person's own record; retyping the translator afterwards yields a fresh link with no
  per-work spelling. **The deliberate one is unrecoverable.**
- **Two guards, because they catch different mistakes.** `full-state-put.test.js` now
  covers the work kinds as well as the quote kinds, and takes a LIST of builders per kind
  rather than one — a book is saved by both `bookState` and `fullState`, written out
  separately in two files, and checking one leaves the other free to drift.
  `work-put-shape.test.js` reads the source instead and requires every work PUT body to
  open with a spread, so a fourth site written the old way fails on the day it is written.
- **The second guard had to learn two things before it was worth anything.** It read only
  object *literals* at first, and Metadata's body is a named `const` — so it reported the
  worst site in the app clean. And its exemption for the re-sync verbs keyed on
  `source`+`source_id` alone; `handleUpdateMovie` short-circuits those before the UPDATE,
  but `handleUpdateBook` has no such branch, so the exemption excused a full-state book
  body that carried the same two keys. Both are fixed and both are named in the file,
  because a ratchet that silently skips what it cannot parse is worse than no ratchet.
- **`internal/httpapi/book_language_test.go` stays exactly as it is.** It deliberately
  pins that a PUT *without* the language keys clears both columns — the server behaving as
  documented. The defect was entirely client-side, and a later reader could easily mistake
  that test for the bug.

<sub>Unreleased — `web/frontend/src/Library.jsx` · `Movies.jsx` · `WorkDetails.jsx` ·
`MetadataPage.jsx` · `test/pure/full-state-put.test.js` · `test/rules/work-put-shape.test.js` ·
`test/dom/metadata-apply.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
