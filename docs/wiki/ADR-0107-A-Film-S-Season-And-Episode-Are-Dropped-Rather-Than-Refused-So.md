# ADR-0107: A film's season and episode are dropped rather than refused, so flipping a show to a film does not brick its edit form

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `episodeRef.normalize` clears both fields outright when the parent's `media_type` is not "show", instead of returning an error.

**Why.** Flipping a show to a film in the Edit form leaves its dialogues holding episode numbers that no longer mean anything. Refusing them would make every later edit of those lines fail, with no way to fix it from a form that correctly does not offer the fields. Clearing heals the line on its next save, and matches the importer's forgiveness for the same case. The rule lives in `normalize` rather than in a CHECK because SQLite cannot reach across to `movies.media_type`.

**Instead of.** A 400 on the mismatch — rejected as a trap with no exit.

**Approved.** I signed this off after working out that the strict version produced a row that could never be edited again, which is a worse failure than silently dropping two numbers.

<sub>1.3.0 — `internal/httpapi/dialogue_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
