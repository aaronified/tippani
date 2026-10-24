# ADR-0243: A recorded lapse is decisive

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 0.6.2

**Decided.** A card whose most recent answer was "forgot" reads as probably forgotten however recently it was reviewed, until the next successful recall.

**Why.** The forgetting curve assumes the last review was a *successful* recall — `p = 1` at elapsed zero. A wrong answer also resets `last_reviewed_at` to now, so without this any fresh answer, right or wrong, read as fully remembered on the tally and on every status dot. The failed attempt is the fact, not the timestamp it left behind.

**Approved.** Mine, and I approved it as a correction to the model rather than a display fix, because the deck ordering reads the same value.

<sub>0.6.2 — `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
