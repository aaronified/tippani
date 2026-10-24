# ADR-0156: Metadata is fetched when somebody asks, and a pass over many works is a job on the server

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** the jobs 3.1.0

**Decided.** Nothing fetches on a schedule, ever. `POST /books/lookup` and `POST /movies/lookup` return candidates for a person to pick. A pass over many works — Fill gaps, Fetch covers, People's Fetch missing, a re-verify — is a job somebody starts, run on the server one at a time behind whatever else is queued (§18), and the covers pass is admin-only, as its route always was. `POST /covers/refetch` still answers an API caller a chunk at a time — up to `limit` rows after `cursor`, returning `{next_cursor, done, total, remaining}` — and the covers job walks the same rows one at a time, so a Stop lands after the row in hand.

**Why.** §8 sets an idle-CPU budget of approximately zero on a NAS sharing a box with a hundred other services, and a background enricher is a poller by another name. A job somebody started is not one: it runs because a person pressed, and the worker that runs it is gone when the queue is empty. Chunking was the first answer to a long run: each HTTP request stayed short, so a proxy timeout could no longer silently abort it, and the client could draw real progress instead of a spinner that means nothing. I approved the chunked shape after the un-chunked one died against a reverse proxy. A job has no request to outlive, so a tab navigation, a locked phone or a closed tab no longer stops the run part-way either, and it reports its progress as `done` of `total`.

**Reversal.** In part, in 3.1.0. The entry was *"Metadata is fetched on demand only, and the one bulk path is admin-triggered and cursor-chunked"*, and its first line was "No background fetching, ever." The browser looped `POST /covers/refetch` a chunk at a time for as long as the tab stayed open, and Fill gaps, the People fetch and re-verify each looped their own route the same way; now each is a job, and a job does its fetching in the background by design. What the old line was for — the server never deciding by itself to go and fetch — holds.

<sub>the jobs 3.1.0 — `docs/wiki/Design-decisions.md` · `internal/httpapi/metadata_handlers.go` · `internal/httpapi/jobs_kinds.go` · `internal/httpapi/server.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
