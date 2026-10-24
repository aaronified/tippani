# ADR-0264: The reviewer's local day comes from a client-sent UTC offset

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.4.0

**Decided.** `tzOffset` takes the client's current offset in minutes, east positive, bounded to −720…840; `reviewDay` derives the local date, the per-day shuffle seed and the SQLite datetime modifier from it.

**Why.** The client sends its current offset on every request, so DST is its problem rather than a table the server has to keep. One value drives the day boundary, the seed and the stored-timestamp shift, so they cannot disagree about when "today" started.

**Instead of.** Storing an IANA zone per user — rejected; a zone database to carry and a value that goes stale when somebody travels.

**Approved.** Mine, and I approved pushing the awkward half to the side that already knows the answer.

<sub>0.4.0 — `internal/httpapi/review_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
