# ADR-0298: Skipping the quiz is a fact about a quote, and a work's toggle is a bulk edit

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted

**Decided.** `reviewSource.where()` reads the QUOTE's `review_excluded` and nothing else. A work's toggle writes that column onto every quote it holds, and the work wears its own mark only when all of them are skipped.

**Reversal.** 0033 put the flag on both and ANDed them in the deck, which made the child's flag lie. The report: *"Take a highlight that is excluded both on its own account and by its book. The selection bar reads the own flag, so it offers Add to quiz; pressing it clears the quote's own column and toasts 'back in the quiz' — but the book still excludes it, so the deck still won't serve it and the mark stays put."*

**Why the toast was the worst part.** It reported an outcome that did not happen, about a change that did. Nothing on screen resolved the contradiction, because the mark read both flags and the button read one — so the app was simultaneously right and wrong about the same quote.

**Instead of** making the button read both flags and clear both, which was the smaller change. That would let one press of *Add to quiz* on a single highlight put forty others back into the deck as a side effect — a bulk write behind a single-item control.

**Affordable because the rule has exactly one choke point.** The comment there already said that a rule added to four of the five callers is "a deck that will not serve a card the badge is still counting"; removing a term is the same argument.

**Approved.** The reader's, and the resolution is theirs too: *"hide from quiz/spaced repetition should be an annotation level thing. and user can simply turn them on / off in bulk when they change the setting in work level. and work level icon will be shown when all annotations in it are skipped."*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
