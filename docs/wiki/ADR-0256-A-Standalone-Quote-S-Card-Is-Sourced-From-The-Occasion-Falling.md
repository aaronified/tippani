# ADR-0256: A standalone quote's card is sourced from the occasion, falling back to the speaker

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.5.0

**Decided.** Every card asks where the quote is from. For the other two kinds that is a title read off a parent row; for an utterance it is the occasion — the speech, the broadcast, the letter — falling back to the speaker when the occasion went unrecorded.

**Why.** A standalone quote has no parent to take a title from, and "where is this from" is the whole question. Two speeches by one person are each other's hardest wrong answer, the way two books by one author are.

**Reversal.** The standalone-quote design predicted the review deck would "apply unchanged". It did not, and that turned out to be the most interesting part of the feature. The roadmap keeps the wrong prediction and the correction side by side, because a roadmap that only keeps the predictions that came true is not worth reading.

**Approved.** Mine, and I approved leaving the bad prediction visible rather than editing it out — which was the easy option and the one I refused.

<sub>1.5.0 — `docs/roadmap.html` · `internal/httpapi/review_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
