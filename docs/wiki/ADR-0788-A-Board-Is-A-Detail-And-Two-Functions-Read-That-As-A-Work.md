# ADR-0788: A board is a detail, and two functions read that as a work

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The report was two sentences — quotes will not go to a named board, and ＋ does nothing
useful on the Quotes screen — and they are one defect seen from two sides.

Opening a board sets `detail = {type:'board', id}`, the same shape an open book sets. Two
functions then read it:

- `addSection` said `if (detail) return 'quote'`, meaning "a work is open, so ＋ means a
  highlight against it". A board satisfies that test. So standing inside a board of proverbs
  and pressing ＋ opened the card that demands a book or a film before it will save anything.
- `addFor` was already a positive list of `book | movie`, with a comment saying why: a target
  means a WORK all the way down to the picker, and a board id read as a book id would
  pre-fill whichever book happens to share the number. That guard was right and is kept.

So `addSection` becomes a positive list for the same reason `addFor` already was, and the
board travels in a prop of its own (`initialBoard`) rather than inside the target.

THE SECOND HALF WAS OLDER AND QUIETER. `UtteranceForm` has drawn a board Select since boards
shipped, and the Quotes screen passes it the list. The capture card is a different form —
it always has been — and it never asked, so `POST /quotes` went out with no `board_id` and
`resolveBoard` supplied the reader's default. Nothing failed; every quote written from ＋
simply arrived in the wrong place. The control is now on both forms, in the same position
relative to the kind beside it, because the two questions look alike and must not behave
differently.

`board_id: null` still means "the server decides", and the picker says so in words rather
than showing a value that is not in its own list — the client cannot know the
`defaultBoardId` preference, so naming the effect is the honest option.

ANTHOLOGIES CHANGE TOO, and it was not asked for. An open anthology also satisfied `if
(detail)`, so its ＋ opened the highlight card; it now answers whatever the anthologies list
answers. That screen's own note says the one door in is the selection bar, because the
server has no route that adds an entry — so a ＋ that pretended otherwise was a door onto
nothing either way.

REMAINING, NOT DONE HERE: the capture card's four 0047 boxes are still shown together under
one heading rather than per kind. The comment above them gives the reason — "the kind lives
on the BOARD and this surface has not asked for one yet" — and that reason has just expired.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
