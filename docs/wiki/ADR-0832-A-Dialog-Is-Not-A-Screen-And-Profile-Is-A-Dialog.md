# ADR-0832: A dialog is not a screen, and Profile is a dialog

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Every screen's "?" offers a walk through that screen. Profile has a "?", so it looked
like it should have one, and for one commit the CHANGELOG said it did.

**IT CANNOT, AND THE REASON IS THE HISTORY STACK.** The account panel takes a history
marker through `useBackToClose` and gives it back on unmount with `history.back()`.
That pop is ASYNCHRONOUS. Opening a tour from inside the panel means closing the
panel, so the sequence is: panel unmounts and schedules a pop, tour mounts and pushes
its own marker, the pop arrives and `backPop` closes the thing now on top — the tour.
The button drew, the press landed, and the walk vanished on the way in. Measured, not
reasoned: the screen after the press was plain Home with no tour card on it.

**AND NOT CLOSING THE PANEL IS WORSE.** The account step spotlights the avatar chip
in the shell's own bar, which is behind the panel's scrim — a caption pointing at
something the reader cannot see.

**SO THE STEP STAYS WHERE IT WORKS.** It is in the welcome tour, anchored to a control
that is on every screen, and Profile's "?" keeps its glossary. The general rule this
leaves behind: `tourStepsForTab` answers for SCREENS, and a surface that has to
dismiss itself to be walked is not one. `helpScreen` returning a key for it is not
evidence to the contrary — the add surface answers `capture` and `import` the same way,
and for the same reason has no walk either.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
