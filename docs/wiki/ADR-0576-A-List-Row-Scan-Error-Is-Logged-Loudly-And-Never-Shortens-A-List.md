# ADR-0576: A list-row scan error is logged loudly and never shortens a list

Source of truth: this wiki page.

- **Area:** [§16 Serving and Running It: HTTP Surface, Logging, TLS and Updates](ADR-Index.md#area-16)
- **Status:** Accepted
- **Version:** 0.6.4

**Decided.** A row that fails to scan — a sign of SELECT/struct drift — used to be quietly skipped with a 200, which means a list silently gets shorter and nothing says so. There is now a per-subsystem code for exactly that class (`TIP-ANNO-001`, `TIP-BOOK-001`, and a dozen more), one per subsystem with list loops, so "mysteriously empty list" bugs surface immediately. The other half of the same release fixed the client-side version: if any of the three requests behind the Favourites grid returned an unexpected non-JSON response — an HTML page from a reverse proxy, or an expired session — the whole section vanished instead of degrading. Both are the same rule from opposite ends: a partial failure must not render as a smaller, plausible success. I approved the code family and the guard.

**Instead of.** Failing the whole request on a bad row, which turns a cosmetic drift into an outage.

**Reversal.** Yes, of the silent-skip behaviour.

<sub>0.6.4 — `internal/olog/codes.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
