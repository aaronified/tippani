# ADR-0288: A blank is asked only of a short quote, and the line is the reader's

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.2.0

**Decided.** Neither blank, typed or chosen, is cut from a quote longer than the reader's
"Blanks only up to" number, 25 words by default, counted by the same tokeniser whose
six-word floor already kept the shortest quotes out (`clozeShortEnough`). The number is a
row in Settings › Review beside the other tuning numbers, bounded 6 to 200 like the rest
of `clampTuning`: below six no quote could be blanked at all, so the setting could switch
the blanks off by itself. A longer quote is asked the other questions. On Hard, which gives
up "which work?" and "which quote?", a long quote gets them back, after Hard's own "who?"
questions, so a card whose "who?" cannot be built (too few people to choose from) is still
asked rather than dropped from a scored deck (`tierDirectionsFor`). A reader who keeps
nothing but the blanks has long quotes no deck can ask, and the daily `remaining` figure
the API reports leaves them out (`askableAlone`), or it would never reach zero. No screen
draws that figure (Home counts the deck it was dealt), so this keeps the API honest rather
than changing anything on screen; the rating pass that found it, and the fix's commit
body, called it Home's count, which it is not.

**Why.** In a one-liner every word carries the line, and recalling the missing word is
recalling the quote. In a paragraph it is a guess at one word among sixty, and getting it
right says little about whether the passage is remembered.

**The blanks stay universal.** They were already asked only of quotes of six words or more
and in Latin script, and a reader who keeps nothing but blanks has chosen to leave the
other quotes out of the round, as they already left out the shortest ones. Taking the
blanks off the universal list was tried first and withdrawn: `review_questions.go` resets a
set with no universal question to the defaults, so every reader who had chosen blanks only
would have had that choice overruled on their next load.

**Approved.** The owner, 9 October: "there is no point testing for exact words (cloze, in
either easy or hard modes) in longer quotes. this is important only for smaller quotes."
Asked where a short quote ends: "A setting, default 25". Asked what Hard does with a long
quote once the blank is gone: "Ask which work".

<sub>v3.2.0 — `internal/httpapi/cloze.go` · `internal/httpapi/review_tier.go` · `internal/httpapi/review_tuning.go` · `internal/httpapi/review_handlers.go` · `internal/httpapi/cloze_length_test.go` · `web/frontend/src/quiz.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
