# ADR-0116: Status, progress and the read log move together through their own endpoint, never the full-state PUT

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `PUT /books/:id/status` and `PUT /movies/:id/status` are the only paths that write status, progress, position and the read log. On `bookDetail` and its film counterpart, those fields are read-only.

**Why.** They are one consistent state, not three fields. A full-state PUT that carried them would let an ordinary Edit-form save silently rewrite reading history. Everything the transition implies — opening a read, resuming a pause into the same read rather than a second one, closing as finished or abandoned, restarting a reread at 0 — lives in one function so status and log can never disagree.

**Instead of.** Carrying them on the existing PUT — rejected precisely because the Edit form would then be able to erase a history it never showed.

**Approved.** My call, and I stand by it; the endpoint split is what makes every later rule about the read log enforceable in one place.

<sub>1.3.0 — `internal/httpapi/book_handlers.go` · `internal/httpapi/shelf.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
