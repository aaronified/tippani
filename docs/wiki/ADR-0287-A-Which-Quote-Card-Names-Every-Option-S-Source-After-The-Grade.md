# ADR-0287: A "which quote?" card names every option's source after the grade, and reading them counts as seeing them

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** Each option of a `quote` card carries its source work (title + art) and its own row identity (`item_kind`, `item_id`). The client draws the sources only once the card is graded, and reports the OTHER options — never the card being graded — to `POST /review/seen`, which prices them by the reader's existing `srSeen` factor.

**Why.** The card puts three passages from three other works in front of the reader and then says nothing about any of them: the round ends with three quotes read and unattributed, which is the opposite of what the deck is for. And they were genuinely read — weighed against the question and rejected — so the event the app already models for "you met this quote outside the schedule" is the honest one to record.

**Why the provenance travels with the card rather than through a second request.** It is the same argument `Answer` already settles: a route that hands out facts about a card in play is a worse thing to own than a field the client is trusted not to paint early. The client draws them under the same `answered` gate that reveals the verdict.

**Why the card's own row is excluded.** Its answer moves the schedule properly a few lines earlier; a seeing on top would pay it twice.

**Approved.** The reader's, in the form "when an answer is submitted ... the books for the other quotes need to be shown as well. and that should count as seen (affects halflife as per the seen settings)."

<sub>v3.0.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx` · `web/frontend/test/dom/quiz-runner.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
