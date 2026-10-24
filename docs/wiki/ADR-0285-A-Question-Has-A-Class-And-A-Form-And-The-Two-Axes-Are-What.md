# ADR-0285: A question has a class and a form, and the two axes are what makes the missing ones visible

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** Every question type declares WHAT it asks (which work · which quote · who is behind it · the words themselves) and HOW it is answered (pick one of four · type it back · mark yourself). The table gains three entries filling holes the two axes make visible: **`author`** ("who wrote this?", books only), **`speaker` extended to a speech** (it was screen-only), and **`cloze-mcq`** — the same blank as `cloze`, answered by choosing rather than typing.

**Why the flat list hid them.** Five types with no axes read as an arbitrary set, so "the same class asked a second way" had nowhere to be and a whole class — *who is behind it* for a book — was missing with nothing to say so. The reader's report was two observations that turn out to be one: *"I also never see who wrote this or who said this"*. "Who wrote this?" did not exist; "who said this?" existed and was gated on `kindScreen`, which was never a fact about the question — `utterances.speaker` has been a column since 0026, so a library of speeches had a switch on that could never fire.

**What stays true.** Both "who?" questions are **not universal**: `author` needs a book and `speaker` needs a recorded speaker, so neither can be the last question standing in a deck (rule 3 of `review_questions.go`). `cloze-mcq` **is** universal, which makes it the second card type that needs no distractor work to be askable — but unlike the typed cloze it needs three other quotes to cut phrases out of, so it refuses on a one-book library and the typed one answers instead. The typed cloze keeps its difficulty weighting and its answer stays on the server; the with-choices twin is graded client-side from `answer` like every other MCQ, because the answer is printed on the card.

**Approved.** The reader's, in the form "there should be different class (who said it, which book is this from, which quote is from this book, etc) and types (cloze, mcq, cloze with options) of questions."

<sub>v3.0.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/speaker.go` · `internal/httpapi/cloze.go` · `internal/httpapi/review_questions.go` · `internal/httpapi/question_types_test.go` · `web/frontend/src/quiz.js` · `web/frontend/src/review.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
