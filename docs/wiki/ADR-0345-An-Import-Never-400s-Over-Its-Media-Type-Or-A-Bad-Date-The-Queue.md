# ADR-0345: An import never 400s over its media type or a bad date — the queue is where a wrong guess gets corrected

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.2.0

**Decided.** `importMediaType` folds anything that is not "show" into "movie", unlike `normalizeMediaType`, which validates a client's field and rejects a bad value. On the shelf side, a status the server does not recognise is dropped, an invalid position is cleared, and a date that would fail validation is dropped while the read itself is kept.

**Why.** A parsed file *guesses*; a client *asserts*. A hand-edited file should not fail an import over one bad word, and the staging queue is a review screen — the wrong guess is meant to be corrected there, by a person looking at it, rather than bounced at the door with the other four hundred quotes in the file.

**Instead of.** Strict validation on the import path — rejected; it fails a whole file over one line.

**Approved.** I approved the asymmetry between the two normalisers, and approved the comment on `importMediaType` that names it, because two functions doing nearly the same thing differently is otherwise read as a bug.

<sub>1.2.0 — `internal/httpapi/import_movies.go` · `internal/httpapi/shelf.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
