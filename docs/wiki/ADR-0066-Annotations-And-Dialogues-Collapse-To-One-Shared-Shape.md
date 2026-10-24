# ADR-0066: Annotations and dialogues collapse to one shared shape

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.1.0, with the embed-flattening correction after it

**Decided.** Both kinds embed a common `quoteReq`/`quoteRow` (`internal/httpapi/quote.go`) — quote, note, colour, favourite, tags, stickers, `noted_at`, `source` and review state — and differ in exactly one respect: how a quote points back at its source. `TestQuoteKindsShareTheirFields` pins the boundary, requires the embed to be anonymous so the wire format stays flat, and **walks embedded structs rather than skipping them**.

**Why.** Writing the two sides separately is what let them drift. The flattening rule is the load-bearing detail: `episodeRef` arrived as an embed and would otherwise have carried `season` and `episode` onto one kind unseen, which is precisely the failure the test exists to prevent. `How-this-was-written.md` records the earlier version skipping embeds and staying green while two fields rode past it — found by reading the test, not by running it.

**Approved.** My call, and I stand by it; the test is the half of the decision I care about.

<sub>1.1.0, with the embed-flattening correction after it — `internal/httpapi/quote_parity_test.go` · `docs/wiki/Design-decisions.md` · `How-this-was-written.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
