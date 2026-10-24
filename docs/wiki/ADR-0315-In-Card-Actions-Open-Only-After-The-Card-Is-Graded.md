# ADR-0315: In-card actions open only after the card is graded

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.15.0

**Decided.** Edit, ♥ and re-tag live in one panel on the review card, and the panel is unreachable until the card has been answered.

**Why the gate is the feature.** An edit form carries the quote, the title and the credit: on a "which book?" card that IS the answer, and on a cloze card it is the masked words in full. A pencil beside an unanswered question is a way to read the answer without answering it. With the confirm step on there is a real interval between choosing and committing, and the gate holds across it.

**It also disposes of two bugs that lived between features.** The specification pass found that folding an edited row back onto a card would un-mask a cloze card, and would write a film title into the answer slot of a speaker card whose options are actor names. Both were about revealing something early; once nothing folds back before the grade, what remains is one short rule — the note always, the quote unless the card is a cloze one, and the options never, because they were the question.

**The whole row goes back, because the PUT is full-state.** The payload is the row with the edited fields over it rather than a hand-built object that has to remember `board_id` on a standalone quote and the sticker's coordinates on all three. A field forgotten there is a field an edit to the words silently blanks.

**Approved.** The reader's, as the roadmap line.

<sub>1.15.0 — `web/frontend/src/review.jsx` · `internal/httpapi/quote.go` (`idFilter`)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
