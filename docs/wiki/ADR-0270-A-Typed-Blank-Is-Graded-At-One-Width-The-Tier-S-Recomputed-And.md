# ADR-0270: A typed blank is graded at one width — the tier's, recomputed — and the union of widths was withdrawn

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted, then changed or withdrawn: the entry says how
- **Version:** 3.1.0

**Decided.** `handleReviewAnswer` resolves the tier from the card and the UTC day (`tierForCard` + `tierDaySeed`, the same two the deck used), takes its width from `tierClozeThreshold`, and grades the attempt against that one span. There is exactly one authoritative width per answer.

**Why the obvious answer is wrong.** The card is built through `tierClozeThreshold`, so at Hard the blank is the widest the quote allows. Grading against the stored `tuning.ClozeWords` meant a reader typed exactly the three words asked for, was told "forgot", and watched the card drop to the first rung — with the reveal showing a one-word answer still printed beside the gap. No test in the package had ever answered a cloze card at any tier, which is why a fix landed for the build path and left the answer path reading a different number.

**And the generalisation that looked like the real fix is worse than the bug.** For one commit this entry said the attempt was judged against **each** of the three tiers' widths, taking the best verdict, on the argument that a self-graded loop can afford to be generous. Both halves were wrong:

- **The widths are not a short and a long version of one span.** `tierClozeThreshold` pins Easy at one word and Hard at three whatever the half-life, so the set is always {1, 3} — and `clozeSpan` picks each independently, so the one-word span is frequently a word still **printed inside** the three-word prompt. Accepting either meant the server volunteering the exploit that the rejected alternative below is rejected for.
- **It changed medium.** A three-word attempt on a first-rung card was a lapse before the tiers existed and became a pass. That breaks the one claim the whole feature rests on — a reader who changes nothing sees nothing change — and it broke it in the direction no test was watching. `TestMediumChangesNothingAtAll` guards medium at the tier FUNCTIONS — every one of them returns its argument — and that is where the claim had always been checked. The GRADING path had no such guard, because nothing in the package had ever graded a cloze attempt at the default settings at all, so a rule that touched every tier including medium could be added inside a function all six of those assertions pass straight through. `TestMediumGradesAWideAttemptAsAMiss` is the one that would have caught it, and it now exists.

**What remains unfixed, said plainly rather than claimed away.** A reader who changes the difficulty between seeing a card and answering it is graded at the tier now in force, and on Random a round left open across UTC midnight is graded at the new day's tier. Both cost one card, once. The server cannot know otherwise without being told the width, and being told is the alternative below. `TestChangingTheTierMidRoundGradesByTheTierNowInForce` pins that as the behaviour rather than asserting the guarantee — it asserted the guarantee for one commit, and if it ever has to change again the change is to the feature and not to the test.

**Instead of.** Recording the width on the card and honouring what comes back — rejected: that is the client telling the server what its own answer was worth, which is the abuse this file already refuses for the direction weight, and a claim of width 1 on a three-word blank is exploitable in exactly the easy direction. Also rejected: the union above, on its own merits.

**And the tier's day is UTC.** `tierDaySeed` is the one day either endpoint may use for Random, because Daily and Practice do not agree about the local day — Practice takes no timezone offset at all. An earlier repair drew Practice's tier at random per round, which made it unrecomputable and so made every Hard cloze there ungradeable by construction.

**Approved.** Mine, on the second attempt, with "medium is byte-identical to yesterday" as the property that decides it — the property the first attempt traded away to buy a guarantee it could not deliver.

<sub>3.1.0 — `internal/httpapi/review_handlers.go` · `internal/httpapi/review_tier_test.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
