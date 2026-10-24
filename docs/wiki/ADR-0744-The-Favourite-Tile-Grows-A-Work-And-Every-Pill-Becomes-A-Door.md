# ADR-0744: The favourite tile grows a work, and every pill becomes a door

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Four rulings in one session, each overturning something shipped an hour earlier. They are
recorded together because the last one only makes sense against the first three.*

**THE OUTSIDE LINE WENT, AND THE WORK CAME UP.** A favourite read
"A Wednesday! · Sambhu (Electric Baba)" under its quote — the work, then the character —
and both halves are drawn better elsewhere now: the character on its own pill with a face,
and the work at the top of the card beside the kind badge, which had been sitting there
alone. The rule is one sentence: **the line under a card never repeats what the header and
the pills already say.** It has three outcomes, not one — a film line is left with nothing
and the line goes; a book keeps its AUTHOR, which no pill carried at the time; a standalone
quote keeps its occasion, which is the whole of what that kind has.

**THE COVER IS EXPANDED-ONLY AND HOME-ONLY** — the owner's ruling. Collapsed, the
favourites are a wall, and a thumbnail on every tile turns that wall into a shelf of covers
with the words between them. Opened, the tile is about one line and the work it came from
earns a picture. A work's own pages never get one: you are already inside that work.
**And the header stacks when the picture is there** — "otherwise the poster/cover looks
weird" — because a 2:3 thumbnail is taller than one line of small caps, so a single row
leaves it sticking out of a line it does not fit. Kind above, title below, the two filling
the height the picture already takes. The title is a `NameScroll`, so a long one fades
under the edge rather than being cut.

**EVERY CHIP IS A BUTTON, WHICH OVERTURNS A DECISION FROM EARLIER THE SAME DAY.** In the
owner's words: "all chips will be buttons as well! that's their function." The span form
had been argued for on real grounds — a button that does nothing takes a tab stop and is
announced as a press — and the ruling overturns the conclusion rather than the observation:
the answer is to give the chip a destination, not to demote it. What survives is
`aria-disabled` on the one case that still has none.

Two things had to change underneath before a pill could have anywhere to go, and both were
defects rather than gaps:

- **`loadCharacterImages` threw the cast row away and dropped anyone without a picture.**
  That filter was right while this fed a row of faces — a face with no picture is nothing to
  draw — and wrong the moment the chip became a door: a character the reader has in the cast
  but has never found a portrait for is exactly as openable as one they have, and dropping
  the row left the chip with a name, no face and nowhere to go. It now returns every cast
  row with its `cast_id` and `character_id`. The chip opens on the CAST ROW, not the record:
  a work can bill one character twice and the record id cannot tell the two apart.
- **Home owned no panel stack.** `usePanelStack` is the app's one idiom for a surface that
  opens another and any screen may call it — MetadataPage calls it twice — so Home now
  calls it and hosts a `PanelHost`. This was the gap behind a question that should never
  have been asked: the machinery was there, unread.

**AND THE PILL ROW MOVED OUT OF THE TILE'S OWN BUTTON**, which is structural rather than
cosmetic. The favourite tile wrapped its whole head AND that row in one `<button>`, and a
`<button>` inside a `<button>` is invalid markup the parser hoists out — the chips escape
their row and lay out as loose text. It cost a wrong screenshot to notice. Outside it, both
presses work: the head opens the quote, a pill opens who is in it.

**WHAT WAS DELIBERATELY NOT TOUCHED**, on the owner's note that the card carries a great
deal else: the expanded tile's Open-work button, its hearts, its colour categories and
picker, its tags and its overflow are all where they were, and `Library.jsx` and
`Movies.jsx` have no diff at all in this change — a work-detail card's expand, hover and
long-press behaviour is untouched by construction rather than by inspection.

**Still open:** a name typed on a line that the work's cast does not know has no row and so
no door. It is drawn (the line names them) and says `aria-disabled`. The obvious
destination is "add this name to the work's cast", which would give every pill one; it is
not built, and it is the last thing standing between this and a row with no dead members.

<sub>Unreleased — `web/frontend/src/Home.jsx` · `people.jsx` ·
`internal/httpapi/cast_images.go` · `annotation_handlers.go` · `internal/store/quote_person.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
