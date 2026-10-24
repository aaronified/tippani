# ADR-0289: After the grade, every option says what it is

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.2.0

**Decided.** Once a card is answered, each of its options, the wrong ones as well as the
right one, says what it is under its own text. A quote, or a phrase on a blank with
choices, names the work it came from with its cover, that work's writer or director, its
year, and the character who says it with their face, or a speech's speaker. A work
option adds its creator and year under its own title and cover. A person option names
the work they were drawn from and, for an actor, the character they play there, after an
"as". The card's own work, with its year and a film's director, is printed under the
quote on every card that hid it, which is every direction but "which quote?" (whose
prompt is the attribution) and the flip card (whose reveal is). The card's own characters are drawn there
with their faces, on every direction, where they were a word in the line; a speech option
carries the line's own speaker and its date in place of a year. The speaker comes off the
line, never the work: speeches are pooled by their attribution, so two given on occasions
of one name ("Inaugural address") share an entry, and the first version named whichever
speaker that entry was read from under both lines.

**Where there is no "who".** A work option ("which book?") and an author option ("who
wrote this?") name no character: the option is a work, or the person who wrote a whole
book, and no one line is theirs to attribute. The card's own line still says who speaks
it, under the words.

**How.** The server fills these on every option (`optionMeta.reveal`,
`revealPerson`), and the client draws them only after the grade (`OptionReveal` in
`review.jsx`), which is the contract `answer` and `source` already had: sent with the
card, never painted before it is answered. The characters' faces come from the round's
one picture lookup, which already found the Easy tier's chips and now takes the options'
characters as more refs for the same two queries (`fillCharacterFaces`). A phrase is not
the quote it was cut from, so a blank's options carry no item identity and reading them
does not count as seeing those quotes.

**Not done.** The answer's details are not fetched after the grade by a second request:
a route that hands out a card's answers while it is in play is a worse thing to own than
fields the client is trusted not to paint early, the reason `optionMeta` gives for
`source`.

**Approved.** The owner, 9 October: "when an answer is submitted, all important details
about the answer should be shown, along with their peers." Asked which details: "Work:
cover, title, creator, year" and "Who: speaker or character". Asked who the peers are:
"The other choices".

<sub>v3.2.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/speaker.go` · `internal/httpapi/answer_reveal_test.go` · `web/frontend/src/review.jsx` · `web/frontend/test/dom/quiz-runner.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
