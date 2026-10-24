# ADR-0073: Normalise each field, then join

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** `normalizeQuoteText` is its own function, and every field goes through it *before* the `\x1f` join, never after.

**Why.** Normalising the joined string puts the separator inside the run being collapsed. `strings.Fields` then treats a space beside `\x1f` as a token boundary, so `"freedom\x1fsubhas"` and `"freedom \x1f subhas"` are different strings and a trailing space in a form field produces a second copy of the quote on the next import. It was a live bug in `DialogueDedupeHash` and a caught-in-review one in `UtteranceDedupeHash` — caught by a test I wrote expecting it to pass.

**Approved.** I approved the shared helper rather than a second local fix, because two hashes spelling the same rule differently is how they diverge.

<sub>1.5.0 — `internal/store/hash.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
