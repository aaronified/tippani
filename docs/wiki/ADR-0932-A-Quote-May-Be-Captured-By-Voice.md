# ADR-0932: A quote may be captured by voice

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0346](ADR-0346-Noted-At-And-Source-Are-Create-Only-Allowlisted-And-Bounded.md)

**What was decided.** `source` accepts `voice` beside `manual` and `ocr`. The Android app dictates a quote (speech to text) and used to
save it as `manual`, so the origin was lost; it now sends `voice`. Nothing else about the field changes: it is create-only,
allowlisted, and an importer still cannot claim it.

**Why.** The allowlist exists so a client cannot invent provenance ([ADR-0346](ADR-0346-Noted-At-And-Source-Are-Create-Only-Allowlisted-And-Bounded.md)),
and a dictated quote is genuine provenance the way a photographed page is. The recording itself is not kept: the server has no place for audio, and keeping one is its own roadmap item
(a voice note on a quote, issue 13).

**Rejected.** Opening the field to any string: an open vocabulary would let a client mislabel a quote as an import.

See also: [ADR index](ADR-Index.md)
