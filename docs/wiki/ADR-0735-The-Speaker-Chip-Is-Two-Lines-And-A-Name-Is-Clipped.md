# ADR-0735: The speaker chip is two lines, and a name is clipped

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner, on the work detail: "make them multi-line, with the character taking the
top line and the actor the bottom … we do not want wrap, long names can instead get a
… after a certain number of chars."*

- **A DEPARTURE FROM A STANDING RULE, recorded here rather than left to look like an
  oversight.** "Never truncate a name" is the pack's, and the reason is good: a shortened
  name and a short name look alike, so an ellipsis on one destroys the thing the row
  exists to show. `.person-chip-name` now clips at 18 characters, on the owner's
  instruction, and the argument for it is the row rather than the name: these chips must
  not wrap, because a reflow moves every other chip when one name is long — and a
  scroller inside each chip of a row of chips is a gesture nobody would find. The whole
  name, and the actor's, are on the button's `title`.
- **The clip is in JS at a character count, not `text-overflow`.** Two reasons. The
  ellipsis lands in the same place whatever the type dial says, and
  `no-truncated-names.test.js` reads the stylesheet for exactly this declaration on the
  six classes that hold names — putting it in CSS would either trip that test or teach
  the next reader that the rule has exceptions in the stylesheet.
- **The face falls back to the actor's portrait, and that was a bug rather than a
  design.** A book highlight's chip drew the character's picture or nothing, so a
  character with no image of their own drew no face even when the person who played them
  had one on file. Two characters on one line, one with a character image and one with
  only an actor image, showed exactly one face — and the missing one read as missing
  data. `Movies.jsx` had the ladder already, through its own `actorMap`, and the two
  cards disagreeing is how it survived; `quote_speaker.go` now carries the actor and
  their portrait so both cards climb the same ladder from the same payload.
- **Still one chip per line, not one per character.** The owner also asked for multiple
  chips where a line names several characters. `annotations.speaker_cast_id` is a single
  column (0056) — one line resolves to one cast row — and the other names live in the
  free-text `character` field, which no cast row backs. Multiple chips is therefore a
  schema change, not a render change, and it is not in this entry.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
