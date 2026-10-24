# ADR-0862: One row of chrome, then the screen

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE OWNER, AFTER THE FIRST CONSOLIDATION:** *"This is also a double header issue. There is
already a back key in the bottom bar. The header title can be in breadcrumbs."* And then the
part that matters more than the screen it was said about: *"I sincerely hope that you
understand the structural problems bigger than just this screen. All your settings and
metadata screens are like this. Drowning in repetition. Useful controls buried under a
plethora of menus."*

**COUNTED OFF THE CAPTURE.** Arriving at Settings → Review on a phone, a reader passed four
rows of furniture before the first control: the top bar (`Settings / admin`), a drill head
(`← Review ⓘ  ALL DEFAULT`), a card heading (`Daily quiz & practice ⓘ`) and a group label
(`REVIEW COVERS ⓘ`). Three info dots, two back affordances, for one slider and three chips.
The same shape on all twelve sections, because it is one shell drawn twelve times.

**A SECTION IS AN ADDRESS, AND THAT HAD TO COME FIRST.** The section lived in localStorage,
so it pushed no history: the dock's Back key walked out of the whole screen, and the page grew
its own back arrow to make up for it. That arrow IS the second header, and deleting it
without a route would have stranded a phone reader inside a section. `/settings/<id>` and
`/metadata/<id>` — carried as the router's existing `detail`, because "a screen, and a thing
open inside it" is the shape a section already has, so `statePath`, `go`, `goBack` and the
popstate handler all work unchanged. A section is also the thing people want to link to.

**THE REMEMBERED SECTION SURVIVES AS THE FALLBACK, not as the state.** "Somewhere you come
back to, usually for the thing you were last looking at" is still true; the address wins
where there is one and the memory answers where there is not.

**THE CRUMB IS WHERE THE NAME WENT, AND THE COUNT WITH IT.** A third level on the two
screens that have one, which is hierarchy the routes really have rather than invented. On a
phone the section is the TITLE and the screen is the line under it: standing in Settings →
Review, "Review" is what a reader needs first and "Settings" is context — and that context
line used to say "admin", a word that took a row to answer a question nobody had.

**"ALL DEFAULT" IS GONE.** The owner: *"it says nothing of worth."* The old reasoning was
that a zero invites you to look for the nine things that are not zero — half a thought: a
pill reading "all default" on four sections out of five is a pill a reader stops reading,
which costs the fifth one its meaning. The count draws only where there is something to undo.

**`open` REPLACED A FLAG, AND THEN TOOK ONE BACK.** "Am I in a section" is a question the URL
answers, so the rail's `entered` state and its two effects went. Both halves of that were too
much. A caller with no navigator — a test, a screen mounted alone — needs the flag, so the
rail is controlled-or-not by the ordinary React idiom, and `open={!!routed}` was wrong
because `false` is a controlled value where `undefined` is the ask to keep your own: nine
suites reported the index where a section should have been. And the effect that enters when
something OTHER than the index chooses a section is load-bearing uncontrolled — Metadata's
issue sheet lands on the console filtered to the gap you pressed, and without it that press
went back to the index it was pressed from.

**`publishBar` HAD TO LEARN TO MERGE.** It replaced the whole bar state, which was safe while
exactly one screen published — and the rail now publishes the crumb while the screen around
it publishes the dock's verbs. The rail rendered second, so its publish wiped `keys` and the
Settings dock lost Back up and Update entirely; the suite reported "no sheet opened", which
is a true thing to say about a button that was not on the screen. Each caller now touches
only the fields it passed, including on the way out.

*Unreleased — `web/frontend/src/routes.js`, `web/frontend/src/App.jsx`,
`web/frontend/src/sectionRail.jsx`, `web/frontend/src/Settings.jsx`,
`web/frontend/src/MetadataPage.jsx`, `web/frontend/src/ui.jsx`,
`web/frontend/src/index.css`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
