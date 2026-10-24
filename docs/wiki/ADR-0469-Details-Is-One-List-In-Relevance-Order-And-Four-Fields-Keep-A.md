# ADR-0469: Details is one list in relevance order, and four fields keep a sheet

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `BOOK_FIELDS` and `MOVIE_FIELDS` are ordered title · subtitle · people · description · genres · year · language · publisher · series · pages · isbn — the handoff's `D_ORDER`. `people` is one row opening `workPeoplePanel`, which holds the credit specs (`BOOK_CREDIT_FIELDS` / `MOVIE_CREDIT_FIELDS`) and `CastSection`. `description` and `genres` carry `sheet: true` and open `fieldSheetPanel`. `BigField` draws all three rows and is `InlineField`'s resting row to the pixel.

**Why.** Sorting the record by which editor a field opens sorts it by implementation: it tells the reader which rows are cheap, which is the app's problem and not theirs, and it had buried People and Description — the two things most often wanted — under ISBN and ASIN. No section headings either: "Fields" over a list of fields inside a panel called Details is the panel's title said twice.

**A WORK'S PEOPLE ARE NOT A VALUE,** which is why they are a door and not a row that edits one. Three text boxes sitting between Year and Series said that naming the author is the same size of edit as a series number; the cast sat *above* the form, so a film opened with twenty cast rows between its cover and its first field. Both halves answer one question — who made this, and who is in it — so they are behind one door and the row prints the names.

**The credits stayed SPECS.** They kept their shape, their coercion, their provenance tag and their place in the merge proposal, which reads both lists: a lookup match offering an author must still be offerable, and a spec that left the form must not leave the proposal. The per-medium label rule is tested against both lists for the same reason — one that applied only to the fields still drawn on the form would let a game's Studio go back to reading Director the moment it moved.

**Four fields keep a sheet, each for its own reason,** and the reasons are written down so that nobody adds a fifth by feel: a description is prose and editing it under a 44px label means reading it through a letterbox; genres are a token input with a filter list of their own; a cover is a grid of pictures with no text to type; people are a list of rows with roles and actions. The description's sheet is twelve rows rather than four — a blurb is read while it is corrected.

**THE AFFORDANCE IS ONE AFFORDANCE.** `BigField` is `InlineField`'s resting row exactly: same label, same source tag, same pencil in the same place. Only what the pencil opens differs, and nothing announces it. A reader is not asked to learn which rows are cheap before pressing one.

**Instead of.** A "Longer fields" heading over the four — that is the implementation order with a label on it. Leaving description and genres editing in the row, which is where the app had put them: it went further than the pack here and the pack's reason still holds, because the row's four-line textarea is a slot to type into rather than a page to read. Making the People panel a third kind of surface — it is a panel on the same stack, with the same ✓, the same unsaved-work guard and the same back word.

<sub>3.1.0 — `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/test/dom/details-save-all.test.jsx` · `web/frontend/test/dom/work-details-order.test.jsx` · `web/frontend/scripts/glossary/catalogue.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
