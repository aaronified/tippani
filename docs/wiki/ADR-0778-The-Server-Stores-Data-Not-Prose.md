# ADR-0778: The server stores data, not prose

Source of truth: this wiki page.

- **Area:** [§18 Jobs and Logs](ADR-Index.md#area-18)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A job's row holds a kind, a subject and counts. The title and the summary a reader sees — "Fill gaps", "9 fields filled · 1 failed", "Waiting — 2 jobs ahead" — are composed in the app, from `settings.jobs.kind.*` and its siblings, in the reader's language; a kind the screen does not know yet reads "Job". The server keeps one English name, `jobs.Title`, for the two places no locale reaches: the line it prints when a queued job ends, and the heading of an exported log.

**Why.** A title column would be prose in one language in the database, stale the day a wording changes, and the screens would have to ignore it for every reader not reading English.

**Instead of.** A title written with the row. A table of names in `httpapi` beside the export, which the runner cannot import.

<sub>3.1.0 — `internal/jobs/title.go` · `web/frontend/src/jobs.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
