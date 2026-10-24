# ADR-0307: A cloze card is offered only where the stopword list means something

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `clozeReadable` gates cloze on the text being at least three-quarters Latin script. Everything else gets one of the other directions, which are all script-agnostic.

**Reversal.** The plan said a quote in another script "simply will not produce a good span". It produces a *confident* one: an English stopword list matches zero Devanagari or Cyrillic or Han tokens, so every token reads as a content word and the selector blanks a phrase out of text it understands nothing about. Far from producing no span, it produces one with nothing to say against it.

**The limit is written in the code rather than in the plan**, so whoever adds a second stopword list knows exactly what to change.

**Approved.** Mine, on the specification pass.

<sub>1.15.0 — `internal/httpapi/cloze.go` · `internal/httpapi/cloze_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
