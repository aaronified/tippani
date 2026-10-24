# ADR-0714: A locked screen is one unbroken chain of heights, and a missing link is silent

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*Written after the first attempt shipped without one. Kept because the shape of the
mistake is more useful than the fix.*

- **What the chain has to do.** A screen that opts out of the window's scroll asks two
  boxes inside a locked document to scroll instead. That needs a definite height passed
  down every element from the viewport to the columns, and each link needs BOTH halves:
  a height from above (`flex: 1`), and permission to be shorter than its content
  (`min-height: 0` — without it a flex item's automatic minimum size is its content and
  it grows anyway).
- **What shipped was one link.** `.container-tp { height: 100% }`, and a percentage
  height resolves against a parent that has one. Its parent is Tailwind's
  `.min-h-screen`, which is a min-height and nothing else, so the chain ended one element
  above where it began. Main grew to its content, every box below grew with it, both
  columns finished exactly as tall as what was in them — `scrollHeight - clientHeight =
  0`, no scrollbar, nothing to drag — and the body's own `overflow: hidden` cut off
  everything past the first screen. Measured in Firefox at 1440×900: a 900px body holding
  1062px. A book's quotes were unreachable and the page looked deliberate.
- **The two missing links did not look like links.** `#root`, because `index.html`
  declares it and the app has never had a reason to style it; and the screen's own
  section, because a book detail is nested INSIDE the Library screen's
  `[data-screen-label]`, so `.tab-panel > [data-screen-label]` reached the wrapper and
  stopped one element short. That selector reads as correct in the stylesheet.
- **A green suite was evidence about a different subject.** jsdom has no layout —
  `scrollHeight` is a constant 0 there — so nothing in 2,238 frontend tests could fail on
  any of this, and "done, suite green" was an honest sentence about the wrong thing.
- **So there are two guards, because one cannot do it.**
  `test/rules/screen-scroll-chain.test.js` reads the stylesheet and fails when a link is
  deleted (it also fails on the specific child-combinator form, since that is the version
  that shipped); `scripts/screenshots/frame-scroll.mjs` — `make frame-scroll` — opens a
  book in Firefox at 1440×900 and 1440×520 and fails on a clipped page, on a column that
  cannot scroll, or on a column with room below it wearing no edge fade. The short window
  is not decoration: the fixture's books carry three quotes, which fit whatever the frame
  does, so at one size a broken stream and a working one report the same number.

<sub>Unreleased — `web/frontend/src/index.css` · `test/rules/screen-scroll-chain.test.js` ·
`scripts/screenshots/frame-scroll.mjs` · `Makefile`</sub>

<sub>Unreleased — `web/frontend/src/ui.jsx` (`DetailFrame`, `useScreenOwnsScroll`,
`useColumnScroll`, `MediaBlock`, `COVER_MIN_W`) · `works.jsx` (`WorkHero`, `HeroKindRow`,
`HeroGenres`, `HeroFact`) · `Library.jsx` · `Movies.jsx` · `App.jsx` · `index.css` ·
`CoverPicker.jsx` ·
`test/rules/cover-floor.test.js` · `test/dom/media-block.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
