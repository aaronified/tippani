# ADR-0826: Season and episode join the live bulk editor, and a claim about SQLite that was wrong

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner, 13 September: *"Season and episode in bulk edit: absolutely do that."*

**WHAT HAD KEPT THEM OUT WAS ALREADY HALF-RETRACTED.** `#185` held them back citing two
guards that said a number retarget already moved them; that was found false (retarget
moves a staged GROUP and never touches either column). What survived was a data-safety
worry: a Quotes selection can span works and episodes, so one season lands on lines from
different episodes alike.

**AND THAT WORRY DID NOT SURVIVE ITS OWN NEIGHBOUR.** `episode_name` has been live since
0047 — the app already let one press rename the episode across a selection spanning two
shows, through the same door, onto the same rows. Refusing the *number* while accepting
the *name* was not a safety position; it was one field's exemption dressed as one.

**THE RATCHET DID ITS JOB AND IS NOW EMPTY.** `bulk_fields_test.go` requires every
staged-only field to be named with a reason — season and episode were its only two
entries, and removing them from the table made the test demand they be removed from the
record too. The empty map stays rather than being deleted: the direction it guards is
still real, and an empty map is a stronger statement than a missing one.

**A CLAIM I MADE ABOUT SQLITE, MEASURED AND WITHDRAWN.** The first draft of the write
said these must avoid the text loop because `nullable()` would leave the text `"7"` in a
numeric column "which SQLite would accept and then sort as text" — borrowed from
`chapter_no`'s note one screen up. **Measured against this package's own driver, that is
false for INTEGER affinity**: binding `"10"`, `9` and `" 7 "` all store `typeof()` =
integer, and `ORDER BY season` puts 7 first. The two writers are equivalent here.

So `nullableCount` is kept for SYMMETRY — the staged side writes these two columns the
same way, and one field written one way either side of approval is worth having — and the
comment now says that instead. **What actually protects the data is the 400**, because
`nullableCount` maps anything unparseable to NULL: a typo'd `S2` across forty lines would
otherwise clear the season on all forty and answer 200, with nothing on screen to say so.
The test asserts the refusal, and that nothing moved, BEFORE it asserts the happy path.

**A MUTATION THAT "MISSED" WAS THE FINDING.** Swapping `nullableCount` for `nullable`
left the test green, and the first instinct was to strengthen the test. The right answer
was to check whether the two actually differ — they do not — and to fix the sentence that
claimed they did. A test that cannot see a difference that does not exist is not a weak
test.

**AND THE DOOR ENFORCED LESS THAN EVERY OTHER DOOR ONTO THE SAME TWO COLUMNS**, which a
rater found by posting at the real handler rather than by reading. `season: "20260913"`
was accepted and stored across a whole selection while `PUT /dialogues/{id}` answered
*"season must be at most 999"*; season and episode landed on a FILM's line, which
`normalize` clears one row at a time; and an episode was written onto a line with no
season, which the single door refuses outright.

The cause is the one this session keeps finding: the block was a hand copy of the staged
door's, with the ceiling dropped in the copying. **So the rule is `showPairProblem` now
and both bulk doors read it**, which is the repo's own directive about two things that
look the same applied to a validator instead of a control.

**THE TWO PER-ROW RULES COULD NOT GO IN IT, AND THAT IS THE INTERESTING PART.** `nil`
means different things at the two kinds of door. In a full PUT, `Season == nil` says the
line will HAVE no season, so "an episode needs the season it is in" is answerable from
the request. At a bulk door it says this REQUEST does not touch season, and the forty
rows may each already have one — so porting the rule verbatim would have refused the
commonest use of the control there is. It is asked of the ROW instead, in
`bulkSetShowPair`: season is written first, so `season IS NOT NULL` is the whole question
by the time the episode write runs. The film case is the same shape — `normalize` CLEARS
rather than refuses, deliberately, so the bulk equivalent is to write nothing to the film
and everything to the show in the same selection, rather than failing the request because
of the company one row keeps.

**AND CLEARING A SEASON CLEARS ITS EPISODE**, because otherwise the clear MAKES the orphan
the rule above exists to prevent. Four mutations, each killed: drop the ceiling, drop the
show gate, drop `season IS NOT NULL`, drop the cascade.

**WHAT THE RESPONSE STILL DOES NOT SAY** is how many rows a write actually touched —
`{"updated": len(owned)}` counts the selection. That is already true of every other field
(setting a colour to the colour it is changes nothing and is counted), so a `skipped`
tally is a change to what `updated` means everywhere and belongs in its own commit.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
