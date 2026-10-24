# ADR-0199: A work links out, to any site, and an unrecognised address is a link and not a mistake

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 0062

**Decided.** Migration 0062 gives `books`, `movies` and `staged_works` a `links` column — the same whitespace-separated free text a person has carried since the person panel learned to fetch, and a character since 0057. Details grows a `Links` row, last in the order, opening `workLinks.jsx`: one row per link with the site's own mark, an address that is never truncated, a ✕, and a paste box that states its READING before anything is stored. `PROVIDERS` grows from five entries to twelve — every slug that has a mark in `providerMarks.js` and a name in `vocab.source.*`.

**Why.** A reader who wanted a work's Letterboxd entry, its fandom wiki or a review had one place to put it: the note on one of its quotes. The person panel had had this for releases.

**THE LIST IS WHAT IS ADDED, NOT WHAT EXISTS.** No fixed roster with "not linked" beside half of it. A panel made mostly of absences decides for the reader which sites their record may have and it is wrong about it — a novel with a film adaptation legitimately wants a TMDB page, a game novelisation wants IGDB. So `PROVIDERS` decides what can be RECOGNISED (a glyph and a name), never what may be pasted.

**THE GLOBE IS NOT A FAILURE STATE.** "A web page" is a legitimate kind of link, so an address matching nothing known is kept whole under `IconGlobe`. A dashed box or `--error` would tell the reader they had done something wrong by linking to the open web. It is also why there is no WorldCat slot: an obscure catalogue is not a special case, it is just a URL.

**A PANEL MAY CARRY ONE VERB IN ITS HEADER, AND ONLY ITS OWN** (§1.12): `+` on Links. The list is what is already there, and adding to it is not another member of it — so the paste box is its own panel rather than a last row pretending to be a link. The empty state carries the same verb as a labelled button, because a panel whose only affordance is a 34px key in the corner is a panel a reader leaves again.

**THE READING IS SHOWN BEFORE THE LINK IS ADDED.** A key and a URL are one fact written twice, so the box prints "Reads as IMDb — www.imdb.com" under what was typed. A field that silently transforms your input is a field you check afterwards every time. A scheme-less address is completed rather than refused, because copying out of a browser's bar drops it about half the time — and the match is on the HOSTNAME, so `imdb.com.example.org` is somebody else's domain and stays under the globe rather than borrowing IMDb's name.

**Free text and not a `work_link` table.** A table would let a link carry its own provenance and ordering, and would also make "any site on any record" a vocabulary somebody has to extend before a reader can paste a URL. One column, one parser (`parseLinks`), one merge and one panel shape for people, characters and works (the merge moved to the server in 3.1.0, where a person's Fetch now folds fetched links into the stored ones, keeping the names readers gave them); three shapes would be three chances to disagree about what a stored link is. Capped at 4000 characters where a person's is not, because this one is pasted into a box rather than assembled from a fetch.

**WHAT IS NOT BUILT, and it is in the source as well.** The pack's per-link provenance (`auto` · `you`) is absent. Nothing fetches a WORK's links yet — a person's are assembled from a lookup, a work's are all pasted — so a tag on every row would print the same word every time, which is not a tag. The column is the same free text a person's is, so the distinction can be drawn the day something fetches them. **The pack's other unbuilt clause, the list you pick a provider from, is built — see the entry at the end of this document**, and it is what makes the provenance question live: a derived page is one the app wrote.

**AND THE LOOKUP AND COVER ROWS KEEP THEIR BARE SUPPLIER NAMES**, which is a decision rather than a gap. A source mark is recognised without being read, and that is worth paying a licence for where the reader is SCANNING for a supplier among many — every field of a record, four columns of a diff, a list of pages to add. A lookup candidate and a cover thumbnail each name one supplier, once, on a row already being read for its own sake; there the name is not a thing to find, it is a caption. Marks everywhere would spend the recognition they buy.

**And it uncovered one.** `staged_works` had no `publisher`, so a game's publisher was lost between the parse and the approval — read by the importer, storable in `movies`, and dropped in the queue between them, with a successful import and matching counts to say nothing had happened. That is 0042's own defect class arriving one layer down. Fixed with the links, and tested by importing a catalogue export of a game.

<sub>0062 — `internal/store/migrations/0062_work_links.sql` · `web/frontend/src/workLinks.jsx` · `internal/httpapi/book_handlers.go` · `internal/httpapi/movie_handlers.go` · `internal/httpapi/export_handlers.go` · `internal/httpapi/import_staging.go` · `internal/httpapi/import_movies.go` · `internal/importer/markdown.go` · `internal/importer/movie_markdown.go` · `internal/httpapi/work_links_test.go` · `web/frontend/test/pure/read-link.test.js` · `web/frontend/test/dom/work-links.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
