# ADR-0198: A book gains a subtitle, a publisher and an extent, and none of it is newly fetched

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 0061

**Decided.** Migration 0061 adds `books.subtitle`, `books.publisher` and `books.pages`, and `staged_works` gains the same three. `BookCandidate` carries them; Google Books' `subtitle`/`publisher`/`pageCount` and Open Library's `subtitle`/`publisher`/`number_of_pages_median` fill them; the Details form has a row for each; the export writes `subtitle`, `publisher` and `page_count`; re-verify offers and applies all three.

**Why.** The design pack's Details form names twelve fields in relevance order and three of them had nowhere to be stored. Both suppliers have returned all three on every lookup since the app first queried them and the parse discarded the lot — so this is not new information to go and fetch, it is information already arriving and being dropped on the floor. The one that was actually costing something is the publisher: a reader deciding between two editions of a translated novel is deciding between two publishers, and the record could not say which one was on the shelf.

**A SUBTITLE IS NOT PART OF THE TITLE.** The two answer different questions: a title identifies the WORK and is what the dedupe, the lookup match and every export key on; a subtitle belongs to the EDITION and changes between printings. Folding it in would make "The Master and Margarita" and "The Master and Margarita: A Novel" two works, which is exactly the merge the catalogue spends its effort avoiding.

**`pages` IS NOT `pos_total`,** and this is the distinction the column exists to keep. `pos_total` (0024) is the denominator of a READ — episodes for a show, 100 for somebody tracking by percent, and whatever edition happens to be in hand. `pages` is the extent of the work as its publisher states it: it arrives from a supplier, it is the same for a book nobody has opened, and it survives a re-read tracked a different way. The relation is one-directional — a page-counted read may default its total from it, and nothing writes back, because finishing a 480-page paperback does not correct Penguin.

**GOOGLE WINS THE EDITION FACTS AND OPEN LIBRARY WINS THE WORK FACTS,** which is one rule and not two preferences. OL's record describes the work: its `publisher` is every house that has ever printed it and `number_of_pages_median` is exactly that, a median. Google describes the copy in your hand. So the merge takes OL's title and first-publication year — it already did — and Google's publisher, extent and subtitle, with the other's answer used where the first is silent. There is a test that calls the merge with OL FIRST, because an assertion made through the search passes on ranking rather than on the rule.

**`page_count` in the export, not `pages`.** The importer has bound `page`/`pages` to the reading POSITION since 0024 and still does: "page: 128/320" is where somebody is. One word could not carry both meanings, and the older one is already in every file anybody has exported.

**Instead of.** Indexing the subtitle in `books_fts` — the index is external-content with three triggers keeping it in step and 0029 is the record of what changing its shape costs, bought here for a field whose usual content is the words "A Novel". A `publishers` table with records — 0037's bar is that a new kind must have BEHAVIOUR, and a book's publisher has no logo, no portrait slot and nothing that groups or navigates by it, which is the identical call 0042 made about a game's. Reusing `pos_total` for the extent — see above; they are two facts that agree on most books and disagree on exactly the ones where it matters.

<sub>0061 — `internal/store/migrations/0061_book_edition_fields.sql` · `internal/httpapi/book_handlers.go` · `internal/httpapi/export_handlers.go` · `internal/httpapi/import_handlers.go` · `internal/httpapi/import_staging.go` · `internal/httpapi/reverify_handlers.go` · `internal/httpapi/metadata_handlers.go` · `internal/metadata/books.go` · `internal/importer/markdown.go` · `web/frontend/src/WorkDetails.jsx` · `internal/httpapi/book_edition_test.go` · `internal/metadata/book_edition_test.go` · `web/frontend/test/dom/book-edition-rows.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
