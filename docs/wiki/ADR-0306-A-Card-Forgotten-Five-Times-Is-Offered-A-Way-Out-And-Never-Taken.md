# ADR-0306: A card forgotten five times is offered a way out, and never taken out automatically

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** `lapse_count` was stored since 0015 and read by nothing. At five lapses the card says so **after** it has been answered, and offers "Set it aside" beside "Keep asking". Neither suspends nor shortens anything by itself.

**Why an offer.** A card that vanished because a counter reached five would be the app making a decision nobody asked it to make, and a half-life quietly altered behind the reader is the schedule lying about itself.

**Why after the answer, and why the flag comes back on the grade.** The answer that MAKES a card a leech also pushes it a week out of the deck, so waiting for the flag to arrive on a future card would surface the offer a week after the frustration that earned it.

**Approved.** The reader's, as "leech handling".

<sub>1.15.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
