# ADR-0174: An ISBN names one book, so provider records are merged best-of per field

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/books.go`

**Decided.** An ISBN lookup runs `mergeSameBook` and returns one record; a text search returns ranked rivals.

**Why.** Two providers describing one ISBN are not two choices — they are two partial accounts of the same object, and asking somebody to choose a *row* means choosing a whole set of fields at once. Pick the Google row and you get its blurb, its large cover and the year the paperback was printed. Pick the Open Library row and you get the first-publication year and often no description at all. Neither row is the best answer; the best answer is assembled: earliest non-zero year, highest resolution cover, longer description, fuller credit, the work's title rather than the edition's, and both providers' subject lists rather than one. On a modern paperback the year is a four-year quibble; on the Meditations it is eighteen centuries, and a shelf sorted by publication year was sorted by when the reprint went to press. My call, and each field's winner carries its own reason in the comment rather than a blanket "prefer X".

<sub>`internal/metadata/books.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
