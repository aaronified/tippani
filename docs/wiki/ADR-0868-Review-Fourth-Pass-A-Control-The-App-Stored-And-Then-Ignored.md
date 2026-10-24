# ADR-0868: Review, fourth pass: a control the app stored and then ignored

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE RATING SCORED 8/10 AND STILL FOUND A DEAD FEATURE, WHICH IS THE ARGUMENT FOR FIXING
EVERY FINDING RATHER THAN EVERY FINDING UNDER THE BAR.** `srStart` — "New lines start at",
Not seen or Mastered — was written by Settings, validated by `normalizeReviewStart`,
normalised on both read and write, carried in the section's reset list and the client's
defaults table, and read by **no review code at all**. `grep -rn 'SRStart' internal/` outside
`auth_handlers.go` and its tests returns nothing; the six `loadPrefs` call sites in
`review_handlers.go` use `SRReviewScope`, `SRQuestions`, `SRTuning`, `SRDaily`, `SRSeen`,
`SRTier`, `SRPracticeCounts` and `SRLadder`, and never this one. Every first answer seeded a
half-life at the floor whatever the reader had chosen.

**IT PREDATED THIS SWEEP AND THIS SWEEP MADE IT WORSE**, which is the part worth recording.
The pass took the row out from behind a door and onto the section's prime space, and made it
the subject of the headline journey — a journey that asserts the preference round-trips. So
the repository ended up with a passing browser test standing over a control that did nothing,
which is precisely the failure `CLAUDE.md`'s testing ruling was written after: *"a feature
shipped 100% dead while two tests stayed green through it"*.

**THE FIX IS TO WIRE IT, NOT TO REMOVE IT, AND THE OWNER'S OWN WORDS DECIDE THAT.** The row
exists because they asked for it — the comment beside it quotes the ruling, *"either at not
seen or mastered (first tier)"*, which is also why this app offers two rungs where the pack
offers three. Removing the row would have been the smaller diff and would have deleted
something that was asked for; "no new features now" is about not inventing from the
prototype, not about abandoning a half-built request.

**WHERE IT IS SEEDED, AND WHY NOT EARLIER.** In the answer handler, for a card with no
`item_reviews` row. Entering the schedule is the first ANSWER, not the first sight: a card
with no row is exactly what the deck's unseen bucket is made of, so writing a row ahead of
time would take the line out of the bucket it is supposed to arrive through.

**AND A WRONG FIRST ANSWER GOES TO THE FLOOR IN BOTH MODES, WHICH IS A DEPARTURE FROM THE
ORDINARY LAPSE RULE AND IS DELIBERATE.** Adaptive shrinks a lapse rather than resetting it,
so a card seeded at 365 days that the reader then gets wrong would land at 182 — half a year
before it came back, for a line they just demonstrated they do not know. The row's own text
says *"a wrong answer brings it back"*. The top rung here is an ASSUMPTION the reader made
about their own library, not a half-life any answer earned, so it does not get the treatment
an earned one gets. A card already in the schedule is untouched by any of this, and a test
pins that: otherwise a reader could launder a forgotten line back to the far end by toggling
a preference.

**THE TWO HALVES ARE TESTED IN THE TWO TIERS THAT CAN SEE THEM.** The half-life a first
answer comes out with is a number, and `internal/httpapi/review_start_test.go` asserts it
against the real handler. What a reader can reach on the screen, and that the choice survives
them leaving, stays in the journey — whose header now says which half it is, because the
previous version of it read as though it covered the feature.

**AND THE SCREEN WAS FINALLY MEASURED AT A PHONE'S WIDTH**, which no commit in this sweep had
done for Review. At 390 the section reports `scrollWidth` 390, no sideways scroll and zero
elements crossing the viewport, with the four groups in the pack's order; opening "The numbers
behind the schedule" holds the same, with the ten tuning rows bringing the row count to 21.

**THREE SMALLER CORRECTIONS.** The changelog described "how many practice cards you get",
which is not a control this app has — the Practice group holds *Practice moves the schedule*
and the practice repertoire. `PracticeCounts` still carried a comment header naming a function
that had been renamed, arguing it belonged in the schedule's group one commit after it was
moved out of it. And the daily-deck row keeps the pack's **Daily deck** in place of "Daily
quiz cards / day", now that its neighbours took the pack's words.

*Unreleased — `internal/httpapi/review_handlers.go`, `internal/httpapi/review_start_test.go`,
`web/frontend/src/Settings.jsx`, `web/frontend/test/journeys/tuning-the-deck.journey.mjs`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
