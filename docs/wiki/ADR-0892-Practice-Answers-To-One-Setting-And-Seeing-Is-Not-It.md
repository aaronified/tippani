# ADR-0892: Practice answers to one setting, and "seeing" is not it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Version:** v3.0.0

The owner, 21 September, on finding both dials on the Review screen priced the same press:
*"Practice should only be in the practice specific gate. Seeing moves should lay off
practice."*

They were reading the two rows together and the screen could not answer. "Practice moves
the schedule" said No; "Seeing lengthens half-life by" said 1.05×; and a Practice answer
took the seeing bump regardless, because the gate on it was the MODE (`practice`, non-skip)
rather than the reader's consent. So the toggle that exists to say whether Practice touches
the schedule was not the thing deciding, and the answer to "does Practice move anything"
was spread across two settings neither of which described the result.

Two shapes made it worse than an overlap. A card **forgotten** in Practice was halved by
nothing — `moveSchedule` was off — and then lengthened by 1.05×, so the only schedule
effect a non-counting Practice round had was in the wrong direction. And with
`srPracticeCounts` ON the two **compounded**: 2.5 × 1.05 on every correct answer, a
schedule 5% longer than the tuning panel it was read off.

**Decided.** A Practice answer is not a seeing event. The bump after
`answerResponse` is gone, and `QuizRunner` stops reporting a Practice card's other options
to `POST /review/seen`. Practice moves the schedule exactly when `srPracticeCounts` says
it may, by exactly the recall multipliers, and by nothing else.

**Why the distractors went too, which is the part that is not obvious.** Leaving them would
have kept the defect and hidden it better: a "which quote?" card reports its other three
options as seen, so a deck answered with Practice-moves-the-schedule OFF would still have
lengthened three cards per question — most of a small library, through a door the toggle
does not lock. The gate belongs where the mode is known, so it is one condition in the
effect rather than a `mode` field added to a route that has never needed one.

**Seeing keeps what it was always for**: encounters with no grade behind them to contradict
— sharing, favouriting, and reading a quote among the choices on a **Daily Quiz** card you
answered. Those are weak evidence and get a weak effect. A Practice answer is not weak
evidence; it is evidence the reader has already been asked what to do with.

This supersedes the `srSeen` entry above ("*practising a quote (a non-skip answer)*") and
narrows the "which quote?" entry to the daily deck. Both legs are mutation-verified:
re-adding the server bump fails `TestReviewSeen` at the practice leg, and removing the
client gate fails *reports nothing as seen in Practice*.

<sub>v3.0.0 — `internal/httpapi/review_handlers.go` · `web/frontend/src/review.jsx` ·
`internal/httpapi/review_test.go` · `web/frontend/test/dom/quiz-runner.test.jsx` ·
`internal/i18n/en.txt` · `internal/i18n/bn.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
