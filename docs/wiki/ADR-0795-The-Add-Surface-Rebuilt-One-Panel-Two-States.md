# ADR-0795: The add surface, rebuilt: one panel, two states

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's brief was total: *"redesign from ground up. forget what is there right now.
think of how it should be. we need to add various types of works, and also need to add
various types of quotes. and then there is bulk imports. all these things need to be in the
add surface that is visually similar to the rest of the app."*

### What was there, and the sentence that condemned it

Three tabs — a look-up card, one capture form, a wall of import instructions — that a
comment described as tabs "the user rotates freely between". **Nobody rotates.** You know
what you are adding before you press the plus, so a segmented control across three things of
wildly different weights spent the top of every opening asking a question already answered.

And the middle tab was **one form for nine kinds of quote**, which is why it carried a
heading reading "What the kind carries" over four boxes that mostly did not apply. Its own
comment gave the reason: *"the kind lives on the BOARD and this surface has not asked for
one yet"* — a reason that expired the moment the board control landed in `3ba63af5`.

### The shape

One panel, two states. A **chooser** grouped the way the owner grouped it in their own
sentence — a work, a quote, many at once — and then **the form for the thing you picked**,
with Back in the header. That is the app's own panel-stack chrome rather than a new idiom,
and it is what makes "each surface needs to only show their specific fields" possible at
all: the kind is known before the form draws, so the form can be honest about what it wants.

**Nobody is asked twice.** A work's own plus opens the highlight or dialogue form with that
work filled in. A proverb board's plus opens the proverb form. A duplicate opens on the kind
it copies. The chooser appears only when nothing else has answered — a bare plus on the
Quotes screen, or a plain board.

### Where the design pack was overruled, and why

`docs/design/handoff/field-model.md` section 1 is titled "The kind question is gone from the
form" and argues that the board owns the kind, so a form never asks. **Half of that survived
and half could not**, and the schema is what decided which:

- **A board has two kinds, `plain` and `proverb`** (0037), and that migration argues at
  length against a third: *"a speech quote uses the same fields every other quote uses …
  so a kind for it would be a label with no behaviour behind it."* With two values, a board
  cannot answer "is this a letter or an essay".
- **0053 gave the quote its own `kind`**, seven values, precisely so something could.

So the door a reader presses IS the value stored in `utterances.kind`. The prototype was
drawn before that column existed. What survives of section 1 is the part that was right and
is now stronger: nobody is asked twice, and the one board kind with behaviour behind it
answers by being stood in (`doorForBoard`).

### The field table is data, and that is the point

`addFields.js` holds which fields each of eleven forms shows, hides behind *Show all
fields*, and hard-drops. A pure table, import-free, so `add-fields.test.js` can check it
against the owner's own words without rendering anything: a proverb is never asked who said
it, a game is never asked for a runtime the server discards, an essay loses the occasion and
the addressee they dropped by name, and `other` hard-drops nothing because a reader who
cannot say what a quote is has told you nothing to predict from.

**A form built from a table can send only what it drew**, which is the half that is easy to
get wrong. A POST here is full-state; a hard-dropped field must be ABSENT from the body
rather than empty in it, or a value that arrived by import is cleared by a reader who never
saw a box for it. `showsField` is that gate, in one place — and `add-surface.test.jsx`
asserts the absence rather than trusting it.

### Three bugs the tests found, all mine

- **`showsField` read the unsplit pair keys**, so a show's `season` — stored as
  `season+episode` for the row it shares — answered "not offered". That function decides
  what the form sends, so the bug would have cleared the season off every show line saved.
- **The door the reader picked was wiped when `/boards` came back.** One `door` state
  written by an effect that depended on the boards list: the moment the fetch resolved the
  effect re-ran and reset the door to whatever the plus implied. A chooser that empties
  itself a few hundred milliseconds after you answer it. Now two values compose — `picked`
  is the reader's and only a press or Back changes it, `openingDoor` is derived and free to
  recompute as data lands.
- **A sitting saved by the previous release lost its tags.** The old card kept them in a
  comma box and wrote the string it held; the token input takes an array, and reading only
  the array dropped them silently — on exactly the release that introduced the improvement.
  `asTags` accepts both spellings, and `duplicateSeed` hands back the array now, so it does
  one conversion where it used to do two.

### What the forms gained beyond the gating

The old capture card had no translation, no language, no sticker and a comma-separated tags
box. Every form has all four now, the tags box is the token input the three edit forms have
always used, and the chapter boxes pair both ways through `chapterPatch`. The four 0047
locators and 0070's two new fields are drawn by the kinds that have them and by nobody else.

### Deliberately not done here

- **The import door is still the seven source cards.** The one-drop-target redesign is its
  own plan (`docs/plans/import-one-drop-target.md`) and its own piece of work; this pass
  gave it a door rather than a tab.
- **The edit forms are unchanged.** They already show every field, which is the owner's
  stated reason for gating the ADD surface and not them ("the edit pages already are
  extensive"). The field table is where a later pass would bring them in line.
- **`AddLookup` keeps its manual escape hatch and its provider search.** Only its kind
  toggle went, because the chooser answered that question one screen earlier.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
