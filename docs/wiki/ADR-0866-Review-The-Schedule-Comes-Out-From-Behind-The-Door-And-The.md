# ADR-0866: Review: the schedule comes out from behind the door, and the section gets rows

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE SECTION HAD NEVER BEEN GIVEN ROWS.** Every control on Review was a mono label over
its own block — the slider, the scope chips, the tier, the confirm switch, both question
repertoires — so it was the one screen in Settings where nothing lined up with anything,
and the two chip rows read as unlabelled blocks of accent. They are `PrefRow`s now, in the
pack's two columns: what the deck asks on the left, how the schedule moves on the right,
what is never asked at full width under both.

**AND THE DOOR WAS DRAWN ONE STEP FURTHER IN THAN THE PACK DRAWS IT.** The previous pass
split the section by "the QUESTION is the screen, the SCHEDULE is behind the door", and
recorded that ruling here. The pack disagrees, and the pack is right: its group 2 is
"Schedule" and it is ON the section — adaptive, practice, where a new line starts, how soon
a seen one comes back — with one door at the end of it, "The numbers behind the schedule →
Open the numbers". The earlier reading is true of the ten multipliers and false of the four
switches in front of them: *"start new lines at mastered"* is a decision about a library
you have already read, and *"practice moves the schedule"* is one people change the first
time practice stops feeling free.

**TWO CONTROLS KEEP THE APP'S WORDS RATHER THAN THE PACK'S, AND THAT IS A CHOICE.** The
pack's "Drawn from" is this app's **Review covers**: the app's word is the one the rest of
the screen uses for the same idea — a deck COVERS the library, the catalogue, the quotes —
and "drawn from" reads as a source rather than a scope. And the pack's "Don't show again
before / 3 days" is a cooldown in days; this app's **Seeing lengthens half-life by / 1.00×**
is a multiplier on an interval, because the schedule here is multiplicative and a fixed
floor in days would be a second, contradictory mechanism rather than a rename. Both are
small-element decisions, which the owner's rule gives to the repo — recorded because the
two deviations this pass DID argue in code (5–60 → 5–20 lines, the pack's three starting
rungs → two) were argued and these were silently kept.

**AND A DEFECT THIS SWEEP SHIPPED, CAUGHT BY A RATING RATHER THAN BY A TEST.** Balancing the
columns drew the question repertoire twice — daily on the left, practice on the right — and
that component held the WHOLE question map in state initialised once and never re-derived,
writing the whole blob on every press. With one instance that was survivable; with two, a
reader who turned a daily question off and then touched a practice chip had the first change
silently restored, while the chip on screen went on saying it had been made. The map is
derived from the preferences per render now, which is what every other row on the section
already does, and a journey presses one chip in EACH deck and reloads. It also cost the
chips a name: the same six questions in two columns were twelve buttons with six names, so
each chip now says which deck it belongs to — a journey refuses an ambiguous name, and a
screen reader had the same problem with no error message.

**THE DOOR IS A ROW, AND IT NAMES WHAT IS BEHIND IT.** It was a bare button under the
groups. A row says what it holds and the button says what pressing it does, which is the
pair every door in Settings now wears — and it carries its own changed dot, read from
whether the tuning blob exists at all rather than from a second table of defaults.

*Unreleased — `web/frontend/src/Settings.jsx`, `internal/i18n/en.txt`,
`internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
