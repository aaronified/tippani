# ADR-0695: The ⋯ is a menu bar, not an overflow

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **Decided** — the top bar carries a ⋯ on both viewports, and it lists everything the
  screen can do *including* controls also drawn on the page. `useScreenBar` gained
  `actions`; the shell draws the menu.
- **Why a menu bar.** An overflow holds the leftovers, which makes it a different shape
  on every screen and empty on several — the app has twelve screens and eight of them
  had no screen-level chrome at all. A menu bar is one place a reader can always look.
  The cost is deliberate duplication of the visible controls, and it buys the only thing
  that makes a menu worth opening: you can find something in it without already knowing
  it is there.
- **`actions` is a BUILDER, not a list, and it is not published.** The rows carry state,
  and a list published through the subscription the sub-line and the dock keys use would
  be stamped by its ids — the ids do not move when the sort does, so nothing
  re-publishes and the menu goes on ticking the view you left. Stamping the state only
  moves the problem: every closure would have to be covered by the stamp, and the one
  that is not is the bug nobody finds. The shell holds a pointer to the current builder
  and calls it when the menu opens.
- **A Set of builders, not a slot.** Checks composes the staging queue and the
  stray-marks list, both `embedded` and both entitled to publish. With one slot whichever
  rendered last would win silently and the other half of the page would look like it had
  no actions.
- **Three kinds of row.** A heading carries no role, so the arrow keys skip it for free.
  A choice is a `menuitemradio` with `aria-checked` — a plain menuitem with a ✓ drawn on
  it is a decoration a screen reader never mentions. The key handler reads
  `[role^=menuitem]`, because a selector naming only `menuitem` steps over exactly the
  rows that are a choice. **The test for that had to be written twice**: with the choice
  row FIRST it passes while the bug is live, because `indexOf` returns −1 for the
  unmatched active element and −1 + 1 is 0.
- **The one place "complete" is bounded is a width, not a screen.** The big selects —
  genre, shelf state, series, who is credited — are drawn on the page at desktop widths,
  so a menu row there would open a sheet over controls the reader is already looking at.
  On a phone the same controls are behind that sheet, so the row is how you reach them.
- **The skin was a render decision.** The first cut used `.help-btn`, a hairline ring in
  `--line`; the ? beside it has worn the Add button's fill since the top bar was built,
  so a bare glyph sat between two solid controls and read as bolted on. Matched.

<sub>Unreleased — `web/frontend/src/App.jsx` · `web/frontend/src/ui.jsx` · the screens that publish</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
