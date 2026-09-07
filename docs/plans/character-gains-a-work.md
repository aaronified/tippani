# A work-level character can be given another work, and that promotes it

**Status: not built.** The owner's design, verbatim:

> this character only exist in one work (for now), and thus the work-level screen is
> shown. but there is no easy way to add him to another work from here. i will then need
> to add a separate character and then merge. i understand that work-level character
> cannot gain a new character. but we can probably create a gate here where of i add
> another work in work-character, that will get added to the global-character (which
> should in turn enable global character for the character as well).

## The situation today

A character exists in two shapes. `characters` is the record — a name, a description, a
portrait, aliases — and `work_cast` is a CREDIT: this character, in this work, played by
this person. A character credited in one work only is drawn by the **work-level** sheet
(`identityLocal.jsx`), which is about the credit; one credited in several also has a
**global** sheet (`identityGlobal.jsx`), which is about the record across all of them.

The work-level sheet has no way to add a second work. So the reader's route is the one the
owner describes: create a second character on the other work, then merge the two — which
works and is three screens and an undo away from what they meant.

## What the gate is

One row on the work-level sheet — *"Also in another work"* — which opens the work chooser
the global sheet already uses. Choosing a work writes a second `work_cast` row for the
same `character_id`, and the character now has two credits, which is the condition the
global sheet already tests for. **Nothing needs to be promoted**: the global screen is not
a flag, it is a consequence of the credit count, so the second credit IS the promotion.
That is worth stating plainly because the owner's framing — "that will get added to the
global-character (which should in turn enable global character)" — suggests two steps, and
the data model only has one.

## The open question, and it is the owner's

**Does adding the second work ask first?** Automatic is fewer taps. Asking is reversible in
the reader's head — *"this character will exist across works from now on"* — and the shape
of the record is the one thing on this screen that a reader cannot undo by pressing the
same control again. The recommendation is **automatic, with the global sheet reachable
immediately and the second credit removable from either work's sheet** (which is the undo,
and it already exists: "Remove from this film · Other works keep the character"). But it is
a one-way door for the record's shape until that removal, so it is not mine to decide.

## What it touches

- `identityLocal.jsx` — the new row, and only where the character HAS a `character_id`: a
  credit with no record behind it has nothing to give a second work to, and the row must
  not be drawn there rather than drawn dead.
- The work chooser in `identityGlobal.jsx` — the same component, passed the fact that it is
  adding rather than navigating. **Not a second chooser**: the repo's directive is that a
  control drawn on two screens has one behaviour living in one function both call.
- `POST /api/characters/{id}/works` or the existing cast-add path — whichever already
  writes a `work_cast` row with a `character_id`, because a second writer for one row is
  how the four writers of that table drifted apart before.
- A test that the sheet a reader lands on after the second credit is the global one, which
  is the whole point of the gate and the part a unit test of the writer would miss.

## Not in this plan

The merge path stays. This gate makes it unnecessary for the common case; it does not
replace it, because two characters that turn out to be one is a different problem from one
character that turns out to be in two films.
