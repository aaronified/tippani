# ADR-0833: Two copies of one filter, and the test that guarded the wrong one

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

A rating scored this work 7/10 and its first finding is the one worth keeping: the
guard written for the admin gate was guarding a different line from the one its own
header named.

`tourSteps` builds the WELCOME tour. `tourStepsForTab` builds a screen's own walk.
Each applies `!s.admin || isAdmin` separately — two copies of one rule, which is the
shape this repo has a file's worth of warnings about. The journey written to hold that
rule (`a-tour-that-skips-what-you-cannot-do`) opens a screen's help and reads the step
count, so it exercises the second copy. Its header said, in capitals, that the
mutation it dies on is removing the filter from `tourSteps` — the FIRST copy.

**AND THAT CLAIM WAS FALSE.** Strike the filter out of `tourSteps` and all 4,425
vitest tests and all 39 journeys stay green, this file included, while a reader who is
not an admin is walked through the API-keys card and the Backup card on their first
launch — the exact harm the file's own prose describes at length.

**THIS IS THE SECOND TIME IN THIS DIRECTORY.** The other was
`an-anthology-of-a-tag`, whose last line asserted the anthology's TITLE while its
header promised a tagged quote. Both files were mutation-verified when written — against
the mutation each header happened to name, which in both cases was not the mutation the
prose was about. So the rule this leaves behind is narrower and more useful than "mutate
more": **the mutation named in a header is a claim, and it is checked by running it.**
A header that describes a stronger test than the file contains is worse than no header,
because it is the reason nobody looks again.

**WHAT THE GUARD IS NOW.** A fresh account's welcome tour says "1 of 19" — nineteen
being what survives both filters for a non-admin with default sections. Removing either
one moves the number, which a journey can see without pressing Next nineteen times. It
does mean adding a tour step updates the number; that is the right cost, because the
number is what the reader is promised at the top of the tour.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
