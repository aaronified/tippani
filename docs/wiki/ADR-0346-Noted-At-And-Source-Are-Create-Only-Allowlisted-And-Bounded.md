# ADR-0346: noted at and source are create-only, allowlisted, and bounded against clock skew

Source of truth: this wiki page.

- **Area:** [§9 Import and the Staging Queue](ADR-Index.md#area-9)
- **Status:** Accepted
- **Version:** 1.1.0

**Decided.** Both are accepted on create only — "a capture's origin doesn't change when you fix a typo in it". `source` is allowlisted to `manual` and `ocr`; importers set their own source strings server-side and are not on that list. `noted_at` accepts four layouts and is refused if it sits more than 24 hours ahead of the server clock.

**Why.** A capture made on Tuesday and flushed on Friday used to be dated Friday, with the real date unrecoverable — that is why the field exists. The allowlist exists because `source` is displayed and filtered on, so a client must not be able to invent provenance, and only a real import may claim to be one. The skew tolerance has to cover the timezone range, because a phone in UTC+14 sending local time is legitimately most of a day ahead; beyond that a date is a typo or a broken clock, and accepting it would park the quote at the end of every sort forever.

**Approved.** My call on all three constraints. The 24-hour window is the one I thought hardest about, and I approved it as a deliberate over-tolerance rather than a tight bound.

<sub>1.1.0 — `internal/httpapi/capture_fields.go` · `internal/httpapi/quote.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
