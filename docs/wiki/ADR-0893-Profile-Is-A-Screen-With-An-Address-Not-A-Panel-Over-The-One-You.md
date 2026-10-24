# ADR-0893: Profile is a screen with an address, not a panel over the one you were on

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Version:** v3.0.0

The owner, 21 September, of the chip at the foot of the phone drawer: *"the profile chip
is also opening settings on mobile… It should open the profile screen. I see no way to get
there."* Then, having looked again: *"it doesn't open settings. It merely refreshes the
screen for me. Same page as i was before."*

Both sentences are about the same missing thing. Profile was a dialog — `AccountOverlay`,
a fixed z-70 layer with its own bar, its own title and its own "?" — opened by a flag in
the shell. So the address never changed: press the chip on Settings and the URL still said
`/settings`, the screen label still said `settings`, a reload came back to Settings, and
nothing could link to the account at all. A screen the router has no name for is one the
reader cannot be sent to, cannot return to, and cannot tell apart from the screen it is
drawn over.

**Decided.** `profile` joins `ROUTE_TABS`, the chip calls `go('profile')`, and the account
renders in the tab panel like every other screen — the shell's bar names it, the dock's
Back leaves it, `helpScreen` finds its help without being told. `AccountOverlay` and its
four stylesheet blocks are gone rather than kept for a component nobody renders.

**Why the address is the fix and not a smaller one.** The panel's own dismissal rides on
`useBackToClose`, which pushes a history marker per open overlay and unwinds it on unmount
— and the drawer's footer opened Profile and closed the drawer in ONE handler, so two of
those markers were pushed and unwound against each other inside a single commit. That is
the shape of "it merely refreshes the screen": the layer arrives and leaves in one gesture
and the reader is left looking at what they started on. A screen pushes one ordinary route
entry and owns it, so there is no second marker to race.

**WHAT WAS NOT REPRODUCED, SAID PLAINLY.** Driven headlessly at 390×844 with touch and a
real in-app history stack, the OLD code opened Profile and kept it open — twice, on the
pre-change binary. So the race above is the mechanism the code allows, not a failure
anyone here watched happen; the owner's device saw it and this machine did not. That is a
reason to remove the class of bug rather than to patch a line, which is what this does.

**AND THE FIRST TWO PROBES BLAMED THE WRONG CONTROL.** They pressed the first button whose
accessible name matched `/account|profile/` — which is the RAIL's chip, rendered in the DOM
at every width and merely hidden by CSS on a phone. It calls `onAccount` without closing
the drawer, so the drawer stayed open over the result and the probe reported a screen that
had not changed. A finding about the wrong button would have been indistinguishable from
the owner's report. The third probe named `.drawer-footer`.

**The journey**, `reaching-your-account-on-a-phone.journey.mjs`, asserts the half a panel
cannot pass however well it renders: the reader presses the chip, lands on the account, and
**a reload brings the account back** rather than Settings. Two mutations, both run: pointing
`onAccount` at nothing fails the first `see('Log out')`, and dropping `profile` from
`ROUTE_TABS` fails the same line after the reload.

<sub>v3.0.0 — `web/frontend/src/routes.js` · `web/frontend/src/App.jsx` ·
`web/frontend/src/index.css` · `web/frontend/test/journeys/reaching-your-account-on-a-phone.journey.mjs` ·
`web/frontend/test/pure/routes.test.js` · `web/frontend/test/rules/help.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
