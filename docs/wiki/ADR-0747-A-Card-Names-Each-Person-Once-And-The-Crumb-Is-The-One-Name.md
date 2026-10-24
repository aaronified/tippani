# ADR-0747: A card names each person once, and the crumb is the one name allowed an ellipsis

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The character/performer pairing lives on the chip, and nothing on the card
repeats what a chip already says. `work_cast.actor` and the performer's headshot now ride
along with the character's picture through `loadCharacterImages`, so every entry in a
line's `character_images` carries who plays that character — not just the stored speaker.
`creditsNotOnChips(names, images, speaker, seps)` is the rule as one function: it returns
the credited names the chips do NOT print, and both the film frame and Home's favourite
tile build their credit from it.

**Why it had to be the server.** The pairing is one row of `work_cast`, found by the fold
`store.CastKey` performs — which `cast_images.go` says in capitals cannot be redone in SQL
or in JavaScript. The client had the pairing for the stored speaker because
`quoteSpeakerCast` serves it, and for nobody else; so a card naming one character obeyed
the rule and a card naming two could not, and had to fall back to a `PLAYED BY` line
naming both performers a second time. The owner reported exactly that shape: "single
character cards are fine. multi-character ones still has a separate actor line."

**Name by name, not line or no line.** A line credits performers typed like genres and the
chips resolve only the ones the work's cast knows, so an all-or-nothing test kept a whole
line for one unmatched name and printed the other two performers twice. The line now
carries the leftovers and nothing else, and disappears when there are none.

**Instead of** teaching each card its own version of the rule, which is what was there:
the film frame had folded it into a local boolean and the favourites tile had never
learned it at all, so one screen went on obeying a rule while the other stopped. One
function, two callers, one answer.

**A DEPARTURE FROM A STANDING RULE, granted by the owner and argued at the site.** "Never
truncate a name" is the design pack's, landed in `CLAUDE.md` and enforced by
`no-truncated-names.test.js`. The panel's back crumb now ends in an ellipsis — "the back
breadcrumbs sometimes do this. ellipsis them", over a screenshot of a crumb reading
`← V / William Ro`.

**What "this" was, measured rather than inferred.** The word carried `overflow-x: auto` so
a fade could hang off it, and a flex item whose overflow is not visible has an automatic
minimum size of zero — so it shrank, and it clipped, and it clipped **silently**: the name
stopped mid-word with nothing to say it had been cut. That is the one failure the standing
rule exists to prevent, happening under a rule written to prevent it. The fade was never
going to prevent it either: a 26px mask over a 13px word inside an 11ch button promises a
drag that a thumb in a button cannot make.

**A claim of mine is corrected here.** The first version of this entry said the word could
not shrink and printed over the title beside it. That was a reading of the screenshot, not
a measurement; `run-panel-depth.sh` now forces a parent name far longer than the key and
reads the rectangles at 390, and against the old rules the crumb clipped with no mark on
both heads that draw one and did **not** overlap. The key's `flex: none` is a real hazard —
it cannot give up width and `.tp-panel-slot` clips nothing — so it is fixed too, and
labelled as a hazard rather than as the report.

The exception is granted because **the crumb is not where the name is read**: it is a
signpost back to a screen the reader has just come from, whose own header printed that
name in full. Every other name the rule protects is on the row that exists to show it.

The fade went with the scroller: an edge fade in this app promises a drag, and a clipped
box has nothing to drag. `no-truncated-names.test.js` keeps the class in its list with the
ruling beside it and requires a real clip; `crumb-stays-in-its-slot.test.js` asks the
declarations that decide it; `run-panel-depth.sh` reads the rectangles in a browser, and
fails on both heads against the stylesheet as it shipped.

<sub>Unreleased — `internal/httpapi/cast_images.go` · `internal/store/quote_person.go` ·
`web/frontend/src/people.jsx` · `Movies.jsx` · `Home.jsx` · `index.css` · `ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
