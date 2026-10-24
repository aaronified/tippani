# ADR-0753: "In this work" and "Note" are two facts, and the screen does not say which

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner, over a work-level character sheet: "what is supposed to be the difference
between 'in this work' and 'notes' fields? why do I need both?" This is the answer, written
here because the question was about the design and the answer is a design decision — and
because answering it in chat alone leaves nothing for the next reader of that screen.*

**They are genuinely different, and the code says so more clearly than the screen does.**

| Row | Column | What it holds |
|---|---|---|
| `In this work` | `work_cast.description` | Who this character IS in this work, falling back to `characters.description`. A description OF THE CHARACTER, scoped to one work — "the mask, before Evey" |
| `Note` | `work_cast.credit_note` | The reader's private remark about THIS CREDIT — "de-aged shot", "the stunt double did the fall", "uncredited in the titles" |

Migration 0063 separated them deliberately, and its own comment says why: **"NOT
`description`, which 0056 put on this row for a different job… a character's blurb [would]
silently discard the reader's note about a stunt double."** One is about the character, the
other about the casting. Folding them would mean either losing the distinction or asking a
reader to keep two kinds of writing in one box.

**So the question is fair and the defect is real: the SCREEN does not carry that
difference.** Two rows, both reading `none`, and the only thing distinguishing them is a
sub-line under one of them — which the repo's own rule warns about ("a row says a thing
once… a sub-line earns its place by carrying something the label does not"). A reader who
has to read the sub-line to tell two rows apart is reading prose to navigate.

**WHAT WAS DONE, on the owner's word ("do it") — and it turned out to be a DELETION, not
a move.** The recommendation was to relocate the note under the credit it annotates. Reading
the code to do that found the destination already built: `openCreditNote` is wired to the ✎
on every credit row and has been since that row was written, and it titles its editor **"Note
on {name}'s credit"** — so it already says whose note it is, which the sheet-level row
structurally could not.

**So the two rows were two doors to one field.** Both `onNote` and `openCreditNote` called
`openFact(…, 'credit_note', …)`; the sheet-level one on `here`, whose own credit row is
always in the list above it (`creditsFor` narrows the character's credits to this work, and
`here` is one of them). The difference between them was a sub-line. That is the repo's own
rule broken twice: *"a row says a thing once"*, and *"two things that look the same behave
the same"*.

The sheet-level row is gone. Nothing became unreachable, and on a two-hander — Delia
Surridge and V in one scene — the surviving door is the only one that could ever have said
which casting the note was about.

**AND THE LABEL NOW NAMES ITS SUBJECT.** `In this work` answered WHERE and left WHAT to be
guessed, which is exactly what made it indistinguishable from the note beneath it. It reads
**`Who they are here`**: the subject is the character, and `here` carries the scope in one
word. `one-door-per-field.test.jsx` fails on both mutations — putting the second door back
takes one case, reverting the label takes another.

**Rejected: renaming `Note` to `Your note` and leaving it where it was.** It resolves the
ambiguity in the label, which is the cheap half, and leaves the note four rows from the
credit it describes — so a reader with two performers still could not tell which one it was
about. **Also rejected: a third row-shape** (a note row attached to a credit), which is what
the recommendation implied before the existing ✎ was found. Building it would have been a
third door to the same field.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
