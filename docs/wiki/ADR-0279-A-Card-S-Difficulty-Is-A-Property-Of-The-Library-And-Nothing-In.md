# ADR-0279: A card's difficulty is a property of the library, and nothing in the deck knew it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** Not shipped

**Decided.** The diagnosis the next four entries answer. The deck asks one question — which work is this line from, or its mirror — and turns one knob, `distractorScore`, which is written to make the wrong answers as confusable as it can. Where that knob lands is decided by the shape of the library rather than by anything about the reader.

**Why it is expensive rather than merely irritating.** `workRef` has no `series` field and `distractorScore` never mentions one, so a volume in a series is the worst case the scoring can produce: same medium, same author, same genres, and the siblings outrank every other candidate. The card offers four books whose titles differ by a subtitle, and the reader is asked to separate things that are genuinely inseparable — a line in volume three could as easily have been in volume four. A show is a level worse: same series, same cast, and an `episodeRef` means the question can be *which episode*.

A standalone film fails the other way. Nothing scores highly, the distractors share no genre and no cast, and the title alone gives it away — while the option chip for a screen work shows its dialogue actor, so on a line you half-remember the actor names the film for you.

**And the schedule cannot tell.** This section already records that *a recorded lapse is decisive* and that the ladder is fixed at 7 → 30 → 100. So an unanswerable series card **resets the half-life of a line the reader knew perfectly well**, and a free film card **advances one to a hundred days** on a question that tested nothing. Every decision in this section is about *when* to ask. None was about whether the question was worth asking, which is the gap.

**Approved.** The reader's report — "the recall the book thing is very hard for serieses. and very easy when they are not serieses (especially so for movies)" — and my reading of the two halves as one defect.

<sub>Not shipped</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
