# ADR-0729: The dock's two seats stop being Home's, and Export gives one back

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask, in two halves: "on library, catalogue, replace the phone hamburger menu
export with the navigate menu you have made for home (it should be in that same
position). same for quotes/proberb/speech etc collections in the quotes page." and "for
locations that do not have context menu, just use the home context menu in mobile."*

**This reverses two decisions in this document, both of them mine and both recorded
above.** Named here rather than quietly amended in place, because an entry that changes
under you is worse than one that is wrong.

- **"Published by the shell, not by Home"** was right about the publisher and wrong about
  the scope. `homeKeys` was built in the shell and then gated on `tab === 'home' &&
  !detail`, so every screen that published nothing — the Bin, Tags, Checks, Stats,
  Settings for a reader who is not an admin — drew two empty seats beside Back, Search
  and ＋. Two blanks is not restraint, it is a dock with holes in it. The gate is gone:
  the shell's two keys are the DEFAULT, and a screen's own keys override them. Nothing
  about the original reasoning changes; it simply stopped one screen short.
- **"Export takes the seat"** is withdrawn, and both of the reasons I gave for it have
  since expired. The claim was that Export "is the one verb on a worklist with nowhere
  else to be on a phone" — it is four rows up in the same screen's ⋯ , which is on every
  viewport, so it had somewhere else to be at the moment I wrote that. And the seat only
  came free because the sort moved into the filter sheet, which is the same entry. What a
  thumb genuinely cannot otherwise reach is the OTHER boards: the rail is a desktop
  control and the drawer is at the top of the screen, the far end from the hand.
- **A screen names the seat rather than building it.** `{ id: 'nav' }` in a screen's own
  keys is a placeholder the shell swaps for its boards key. The alternative was handing
  every screen `sections` and `selectTab` — two props everywhere for one key, at nine
  call sites, and the screen that forgets is the screen that had blanks before. One line
  in `WorkListScaffold` covers the Library, the Catalogue, the Quotes page and the
  boards; one line in `MetadataPage` covers the seat a non-admin reader had blank there.
- **REJECTED: publishing the two keys from each screen that wants them.** Same two keys
  nine times, needing two pieces of shell state at each site. A default belongs where the
  seats are drawn.

<sub>Unreleased — `web/frontend/src/App.jsx` · `works.jsx` · `MetadataPage.jsx` ·
`test/dom/dock-nav.test.jsx` · `test/dom/board-filters.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
