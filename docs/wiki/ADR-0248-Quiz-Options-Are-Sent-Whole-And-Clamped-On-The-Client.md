# ADR-0248: Quiz options are sent whole and clamped on the client

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.2

**Decided.** Quote options used to be cut to 140 runes server-side with an ellipsis. They are now sent in full; the client clamps them.

**Why.** 140 runes is about three lines on a phone, so on any quote longer than a sentence the reader was asked to choose between four passages whose endings they could not read, and no amount of tapping would show them. Clipping was the server deciding a layout question, and deciding it destructively. It had a second cost: two quotes sharing a 140-rune opening were folded together as duplicates by `choicesFrom`, quietly leaving a card with fewer choices than it should have had.

**Reversal.** Of my own server-side truncation.

**Approved.** Mine, and I approved moving the decision to the only place that knows how much room there is.

<sub>1.5.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
