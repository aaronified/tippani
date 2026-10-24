# ADR-0118: The shelf cap is a client-side nudge of 5 books · 2 films · 5 shows, never enforced by the server

Source of truth: this wiki page.

- **Area:** [§5 Works, Shelves and Reading History](ADR-Index.md#area-5)
- **Status:** Accepted
- **Version:** 1.3.0

**Decided.** `shelfCap` returns 5 for books, 5 for shows and 2 for films, mirrored in the frontend as `SHELF_CAPS`. Going past it opens the shelf so you can settle something from the list, or carry on anyway. The server never refuses.

**Why.** Films are capped hardest because two at a time is already unusual, whereas five part-read books is an ordinary shelf, and a binge-watched series should not crowd out a film — which is why films and shows count in separate pools. The cap is a nudge: a second device must never be told "no" about a limit the first device is only suggesting.

**Instead of.** Server enforcement — rejected outright; the user can always wave it through, so enforcing it would only break the sync path.

**Approved.** Mine, and I approved keeping the two constants mirrored with a comment on each side pointing at the other rather than fetching the number from the server, which would have been a request for a value that is advisory anyway.

<sub>1.3.0 — `internal/httpapi/shelf.go` · `web/frontend/src/works.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
