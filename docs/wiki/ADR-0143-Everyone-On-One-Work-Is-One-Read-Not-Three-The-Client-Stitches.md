# ADR-0143: Everyone on one work is one read, not three the client stitches

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `GET /books/{id}/people` and `GET /movies/{id}/people` return a work's credits by role, its cast with both record ids on each row, and the people its own quotes point at with a line count each. Curried by kind like `handleListCast` beside it, so the kind is never parsed out of a caller-controlled segment.

**Why.** This is the door the identity model had no door for. 0056 gave credits and cast records to point at and 0059 gave quotes one too, and every person link on every screen still opened a *name* — there was nowhere a reader could stand on a work and see the records behind it. Three reads rather than a join because they are three different attachments: a credit is a role on the work, a cast row is a character with a performer beside them, a speaker is a person some quote points at. A join would have to invent a shape that flattens all three.

**A book reports no speakers, and that is the schema being honest** rather than a branch that skips the query: `annotations` has no person column at all. It reads and never writes — the one write this surface offers is the pairing, which stays `PUT /cast/{id}/link` so that *who this role is* can never become a side effect of saving a billing order.

<sub>`internal/store/identity.go` (`PeopleOfWork`) · `internal/httpapi/identity_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
