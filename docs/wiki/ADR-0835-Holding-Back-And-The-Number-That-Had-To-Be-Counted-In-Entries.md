# ADR-0835: Holding Back, and the number that had to be counted in entries

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The ask: *"phone bottom bar: the back button long press should give the user the list
of last 5 pages (not as a sliding popup, but as a popup anchored over the back button).
choosing one there will overwrite the device back history as well. first tell me if
that is possible."*

**MOSTLY YES, AND THE ONE LIMIT IS WORTH STATING BEFORE THE DESIGN.** The History API
cannot be read: no browser will say what is behind the current entry, and none will
delete or reorder entries. Both are anti-spoofing rules rather than omissions. What it
does offer is `go(-k)`, which rewinds the real stack — so the list has to be the app's
own, and picking a row is a genuine traversal rather than a navigation dressed up as
one. What cannot be done is the tidying-up afterwards: the entries above the chosen one
become FORWARD entries, and the device's Forward key still reaches them.

**THE NUMBER IS THE WHOLE DESIGN, AND THE OBVIOUS ONE IS WRONG.** Every route entry
already carried `tpDepth`, which looks exactly like the number to subtract. It is not.
Panels and overlays push entries of their own — `usePanelStack.push` and
`useBackToClose` — and both carry the route's depth FORWARD unchanged, because their
entry is not a screen. Two screens three entries apart in the stack therefore read one
apart in depth, and a jump computed that way stops short on somebody's panel entry. A
panel's entry carries the address of the screen it opened OVER, so the address does not
change, the shell reads the pop as an overlay dismissal and returns early, and the
reader's press does nothing at all — which from the outside is a dead control rather
than a wrong one.

So every entry the app pushes carries `tpSeq`, one more than the entry it was pushed
from, panels and overlays included, and the distance between two entries is the
difference of their serials. `test/rules/history-seq.test.js` fails on a `pushState`
that skips `stampSeq`, and on a second definition of it, because the arithmetic is only
true while the count is of ENTRIES.

**THE TRAIL IS RECORDED FROM THE SHELL, NOT FROM `pushRoute`, AND THE REASON IS THE
NAME.** A work's title arrives after the work does — the screen publishes it through
`useCrumb` once the fetch lands — so a name taken at push time would be whatever the
previous screen was called. An effect on the route and the crumb together fires again
when the name arrives and corrects its own row. It also covers what a push site cannot:
a `popstate`, the /tags redirect, and the replace `navigateBack` falls back to all land
there, and every one of them leaves the reader on a screen the list should know about.
What is stored is the TAB rather than a finished label, so the menu resolves its words
when it opens — the defect the top bar's context pill shipped with, where a Bengali
switch left the pill speaking English.

**THE HOLD IS A PROP ON `Tooltip` RATHER THAN A SECOND TIMER.** Every long press in
this app already runs through that component's 500ms clock and its 10px slop, and the
control being held wears a tooltip because every dock key does. A hold handler added
beside it would start two clocks on one `pointerdown` and fire both: the key's own name
in a bubble, and a menu drawn over the bubble, at the same instant. `onHold` replaces
what happens at the end of the existing clock, and the click-swallow that was already
there is what keeps the held key from also going back.

**THE JOURNEY ENDS ON THE PRESS AFTER THE ARRIVAL, WHICH IS THE ONLY PART THAT CAN
TELL THE TWO IMPLEMENTATIONS APART.** A menu that navigates to the chosen screen looks
identical — right screen, right row, feature apparently working — and leaves a stack
with the skipped screens still in it. Mutating the row to the shell's own `go(row.tab)`
keeps the arrival correct and lands that final Back on Settings instead of Library,
which is what the case asserts.

**AND A THIRD CASE WAS WRITTEN AND DELETED.** Holding the Back key on a top-level
screen reached cold, where the key is drawn disabled, passes with the hold itself
removed: a disabled button raises no pointer events, so there was never anything for
the gesture to fail at. The case it was trying to be is a work opened cold — a live
Back key, because it falls back to the shelf, with an empty trail behind it — and that
one fails when the `rows.length` guard goes.

**AND THE TRIM BELONGED TO EVERY PUSH, WHICH THE FIRST CUT GOT WRONG.** A rating
found that `trimTrail` could be deleted from `pushRoute` with every case still green.
Chasing why turned up the real defect rather than a missing test: a panel opened after
a Back takes the abandoned serial and records nothing, so the stale row sits BELOW the
next route's serial — out of reach of a trim that only runs on a route push, and never
overwritten, because `noteRoute` only ever writes the serial it is standing on. The
menu then offers a screen for an entry that has become somebody's panel, and a panel's
entry carries the address it opened OVER. That is a row that goes to the WRONG screen,
which is worse than the dead row the serials were introduced to prevent.

A push is a push: it destroys the forward entries whether or not the thing pushing is a
screen. So the trim moved into the function every push site already calls, which is now
named `stampPush` rather than `stampSeq` because it does two things and the old name
admitted to one. The case that holds it up goes back two, opens a panel, and navigates
out of it — the path that buries a panel's entry rather than popping it, which `leaveTo`
already documents from the other end.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
