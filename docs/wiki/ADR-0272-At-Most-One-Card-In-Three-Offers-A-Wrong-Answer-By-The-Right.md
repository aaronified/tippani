# ADR-0272: At most one card in three offers a wrong answer by the right answer's own author

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** A round grants its same-author allowance to cards 0, 3, 6 … by position (`authorLureAllowed`). A card without it demotes every candidate sharing the answer's author below the whole rest of the pool, so a same-author title is reached only when there is nothing else to offer. It applies at **every** tier except Easy, whose inverted comparator already avoids close lures on every card and for which demotion would point backwards.

**Why.** `distractorScore` rewards a same-author candidate above every other kind of similarity — 100,000 against 100 per shared genre — so on a shelf with one well-represented author it wins nearly every card. Measured over a ten-card deck of Le Guin quotes with six other authors parked in the pool, it won **ten out of ten**. That is not a closer question repeated; it is one question repeated, and the reader stops reading the options. "Close" is a property of the round as much as of the card.

**Demoted, not excluded**, which is the difference between a cap and a lost card. A shelf whose books are all by one author has no other lure; refusing to ask "which book?" there would take the question away from exactly the reader whose library makes it hardest, and `buildQuestion`'s own history records what a card counted as due but never served looks like. Ranked last, the cap holds wherever it can hold and the question survives where it cannot.

**Instead of.** Withholding the bonus — scoring a same-author candidate as though the authors did not match. **That was built first and did not deliver the promise**: with eight other books and two by the answer's author, all scoring alike, the shuffle put one of the two in the top three about half the time. "At most one card in three" is a cap, and a cap needs the candidate out of contention rather than merely unrewarded. Also rejected: a one-in-three coin toss per card, which gives one in three on average and three in a row often enough to be the thing being complained about; the ordinal is already known where the deck is built and is identical for every client on a given day, which makes the promise exactly testable.

**And this is the one part of the tier work that changes medium.** The entry above says the tier axis moves nothing for a reader who never opens the panel, and that stays true — this is a lure rule, not a tier dial. But it does change which wrong answers that reader is offered, and four documents had to be corrected for having read "medium adds nothing" as "the release adds nothing".

**It applies at Hard as well, deliberately.** The plan files the quota under Medium, and Hard drops all three directions that offer work options — so it is nearly unreachable there, and reachable only for a reader whose whole repertoire is one of those, whom `tierDirections`' never-empty rule leaves it to. It is not exempted, because the reason holds at every difficulty: a reader who meets one author's titles all round is being asked one question. Hard's own spec asks for same-SERIES lures rather than same-author ones, and there is no series term in `distractorScore` to make that with — a separate entry proposes adding one.

**And it does not reach the fill-in-the-blank card's phrase lures**, which it did for two commits. The cap is about which TITLE is offered: a phrase carries no visible author, so demoting same-author quotes there buys the reader nothing and costs the thing the entry below was written to get — two cards in three were drawing their phrases from the FARTHEST works in the library while the plan asked for closer ones. The two rules point opposite ways and only one of them is about something on the screen.

**Approved.** Mine, from the plan's own step 6, with the ten-out-of-ten measurement as the thing that decided the cap was worth a behaviour change this close to a release.

<sub>3.1.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_lures_test.go` · `internal/httpapi/review_tier.go` · `internal/httpapi/auth_handlers.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
