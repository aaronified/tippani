# ADR-0317: The reader chooses the deck's repertoire, and three rules stop them breaking it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** Which question types each deck may ask is now a per-user preference, per deck, behind an **In-depth controls** pop-up. The card itself keeps only the two settings somebody changes and then stops thinking about — deck size and what it covers.

**Why.** Until 1.16.0 the repertoire was a constant: `directionsForMode` returned one table for everybody, and the only thing a reader could say about the review loop was how many cards and which medium. That is a strange place to draw the line in the one part of this app with no equivalent elsewhere. Somebody who cannot bear multiple choice, or who wants the daily deck to be nothing but fill-in-the-blank, had no way to say so.

**Stored as a string, like the language marks, and for the identical reason.** `preferences` is a flat comparable struct — `ui_test.go` declares a mirror and compares two values with `!=` — and a struct holding a map or a slice is not comparable in Go. So `srQuestions` is a small JSON document, normalised on read *and* on write.

**The three rules are the feature, and all three fail silently without them.**

1. *An unknown direction is dropped, not rejected*, so a backup taken on a newer build restores onto an older one.
2. *The daily deck cannot be made self-scoring.* 1.15.3 took the flip card out of the daily deck deliberately — one self-marked card in five does not make the deck slightly softer, it makes the score mean something else — and handing over the repertoire would have handed that decision back by accident. `flip` is dropped from `daily` on the way in, wherever the preference came from.
3. *No deck can be configured into nothing* — and the sharp half of this is why it is not simply a non-empty test. `speaker` applies only to a line of dialogue, because a book has no cast. A deck holding only *"who said this?"* is not empty and is empty for every book and every standalone quote in the library. So a deck must keep at least one direction that applies to **every** kind, or it reverts to its defaults.

**The client mirrors the rules, which is a duplication this repo normally refuses.** `facets.js` opens by refusing exactly this shape. The reasoning differs here: the server *must* normalise, because a preference can arrive by PUT, by restore, or from somebody editing their own database; and the client must *also* know, or a switch that would empty a deck is accepted, sent, silently corrected, and flips back under the reader's finger explaining nothing. So the offending toggle is **disabled with its reason on screen**, and a test reads the Go source to check the two tables still say the same thing.

**Back to defaults** sends `srQuestions: ""` — and because empty is a real value here, that field takes the pointer as presence rather than the `!= ""` shorthand the older string fields use. It resets every review preference on the panel, not only the questions: a reset that left three switches behind would be the least trustworthy button there.

**Instead of.** Leaving the repertoire a constant; or letting the interface be the only thing enforcing the rules.

<sub>1.16.0 — `internal/httpapi/review_questions.go` · `web/frontend/src/quiz.js` · `web/frontend/src/Settings.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
