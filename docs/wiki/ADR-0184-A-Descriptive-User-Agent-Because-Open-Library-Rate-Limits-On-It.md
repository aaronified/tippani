# ADR-0184: A descriptive User-Agent, because Open Library rate-limits on it

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/metadata/metadata.go` · `internal/metadata/amazon.go`

**Decided.** One shared descriptive UA on every outbound call, with a 10 s client timeout and `io.LimitReader` on every body.

**Why.** Open Library grants 3 req/s (versus 1) to descriptive agents. Amazon needs the opposite kind of UA — a browser string, because it serves a bot wall to obvious non-browser agents — and is still strictly best-effort, since CAPTCHAs happen. Both constants sit next to comments saying which provider they are for, so neither reads as cargo cult. Mine, and the split is the honest consequence of two providers wanting opposite things.

<sub>`internal/metadata/metadata.go` · `internal/metadata/amazon.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
