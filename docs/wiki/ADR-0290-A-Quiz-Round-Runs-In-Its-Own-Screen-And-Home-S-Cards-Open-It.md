# ADR-0290: A quiz round runs in its own screen, and Home's cards open it

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** v3.2.0

**Decided.** The Daily quiz and Practice cards on Home no longer hold the round. Each says
what is waiting (the Daily card how many cards are due, Practice its score or a round left
open) and has the press that opens it: Start, then Continue once some of the round has
been answered, and Start practice, then Continue practice. The round runs in
`FormModal`'s new `screen` mode, a centred popup on a desk and the whole screen on a phone,
whose head carries a back key naming Home; the phone's Back closes it too. Themed practice
uses the same mode, so a round looks the same wherever it was started.

**Why a screen and not the sheet.** The phone's other popups are bottom sheets that stop
at 94% of the height and drag between anchors. A round is something the reader does for
several minutes, and a quiz card can be taller than any anchor, so the card would scroll
inside a box that itself moves. The screen has one scroller, its body, and a head that
stays put.

**Closing is pausing.** A round closed part-way waits on Home and reopens at the card the
reader had reached, never at a card already answered: QuizRunner reports every answer it
keeps by its card's index (`onKept`), a typed one the server has not marked yet included,
and both Home cards reopen past the furthest. A round closed on its last answer, before
Finish, is done, and so is a kept Practice round whose last card was answered when the
page is reloaded. A Practice round with cards left comes back closed, behind Continue
practice, rather than opening over Home by itself. The first version counted grades
instead of kept answers, so a typed blank still waiting for its mark did not count and its
round reopened on the card after it; the rating pass found that and the reload case.

**On a desk the card stops at the window.** Its body scrolls and its head stays, so a tall
answer never carries the ✕ off the top. **On a phone the back key names where it returns:**
Home for the Daily quiz and Practice, and for a themed round the screen it was started
from (Stats, Categories, Library or Catalogue, a work, an anthology).

**Approved.** The owner, 9 October: "the review / quiz should happen in a popup (a
dedicated screen in phone) so that the user doesnt need to scroll up and down too much."
The plan (launchers on Home, a centred popup on a desk, a full screen on a phone, Back
closes it, themed practice the same) was put to the owner the same day.

<sub>v3.2.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/Home.jsx` · `web/frontend/src/review.jsx` · `web/frontend/src/index.css` · `web/frontend/test/dom/daily-quiz-in-its-own-screen.test.jsx` · `web/frontend/test/journeys/a-round-takes-the-phone-screen.journey.mjs`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
