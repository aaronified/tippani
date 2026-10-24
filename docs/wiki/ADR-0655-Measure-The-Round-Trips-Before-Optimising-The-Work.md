# ADR-0655: Measure the round trips before optimising the work

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** `GET /review/daily` is coalesced so one page load makes one request. Nothing else about the write path changed.

**The report was "edits take a long time, probably waiting to establish two way connection to the server".** Measured first, in-process, on 60 books and 1500 highlights: `PUT /books/{id}` 2.1 ms, `GET /books` 0.75 ms, `GET /annotations` 5.8 ms, `GET /review/daily` 4.2 ms. There is no connection to establish either — the API client is same-origin `fetch` with keep-alive and no preflight — and the work Details panel already patches its board from the reply rather than refetching. So the server was never the wait, and a fix aimed at query cost would have been a fix aimed at four milliseconds.

**What a slow-feeling app is made of here is round trips**, and the only way to spend fewer is to stop making the ones nobody needed. There was exactly one duplicate, and it was the most expensive read in the app: the shell fetched the daily deck for its badge and Home's card fetched it again for the deck, so the library-wide distractor scan ran twice per load and the SECOND one is the one the reader watches a loading line for.

**A coalescer, not a cache.** It holds the in-flight or just-settled promise for five seconds — long enough for one load's two callers to meet, far too short to be state. An answer clears it, because grading a card takes it out of today's list and a cache would hand a remounted card questions it has already asked. A failure is never held: a retry has to be a retry.

**What is NOT fixed, so it is not mistaken for done.** An edit is one round trip and the control goes disabled, which is feedback but not motion; on a phone over a VPN that is a few hundred milliseconds of a screen that looks frozen. Making it feel instant means writing optimistically and reconciling afterwards — a change to how every form in this app relates to the server, and a design discussion rather than a patch. It is not scheduled.

<sub>2.2.3 — `web/frontend/src/daily.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
