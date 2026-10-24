# ADR-0312: The cloze mask is derived from (kind, id) and never from the day

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `clozeSpan` takes no day seed. The same card blanks the same words on every device, on every day, in Daily and in Practice alike.

**Why.** The grading endpoint has to recompute the span the card was built with. A mask that moved with the date would grade tomorrow's answer against today's blank, and nothing would report it — the reader would simply be marked wrong for the right words.

**And the answer never travels.** Unlike an MCQ, whose `answer` is an index that means nothing without the options, a cloze answer IS the words being recalled. The card carries the masked text and no answer; the words come back in the reply to the attempt.

**Approved.** Mine.

<sub>1.15.0 — `internal/httpapi/cloze.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
