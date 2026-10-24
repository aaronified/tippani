# ADR-0254: Quotes not yet asked lead the deck, in the Daily Quiz and in Practice

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.0.3

*Reverses the two entries above on the points it names, at 3.0.3.*

- **Two slots in three go to a quote never asked**, and every third to the most overdue
  review (`reviewDueEvery = 3`). It was the other way round: one unseen slot in three. The
  owner: *"fix the spaced repetition so that it gives highest weightage to quotes not yet
  asked"*, and, asked how far, *"Unseen get most slots"*, which keeps a third of the quota
  for reviews rather than stalling them.
- **Practice deals the same mix.** The owner: *"same as daily quiz"*. It still has no due
  filter and no grace week, so an asked card can come up at any time and a quote saved
  yesterday can be practised today. The entry above refused Practice the reservation so
  that an asked card would not be more likely than an unasked one. The ruling now wants
  the unasked more likely, which is the other side of that same argument.
- **A quote never asked reads "not yet reviewed" from the day it is saved.** The owner:
  *"this shall be grace week, the quotes will not be 'forgotten', but not yet asked."* The
  grace week stays, as a rule about the deck: a quote waits a week before the Daily Quiz
  asks it. It no longer claims the quote is remembered, which was the one thing about it
  nothing had checked. A quote answered inside its first week still reads remembered.
- **The works stay mixed across the seam.** Each bucket arrives rotated by work, and dealing
  two rotated lists two-to-one could put one work in consecutive slots. So a slot takes,
  from its list's next four cards, the first whose work is not among the last two dealt.
- **The slots are counted across the day, not per visit.** The Daily deck is rebuilt on
  every visit with only the slots left, so a count that started at zero each time led every
  visit with two unseen cards, and a reader who answered a card or two per visit was never
  asked a review while any unseen card remained. The count starts at the cards already
  answered today.
- **The cost, accepted.** The arithmetic in the entry above still holds, and intake now
  outruns it: due reviews get a third of the quota, so a backlog builds sooner and a due
  card waits longer. The daily quota (2 to 10) is the reader's lever.
- **Instead of.** Unseen strictly first, which the owner turned down: a large unseen pile
  would stop reviews altogether.

<sub>3.0.3 — `internal/httpapi/review_handlers.go` · `web/frontend/src/ui.jsx` · `docs/wiki/Spaced-repetition.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
