// A reader picks a run of books off the shelf and keeps everything inside them.
//
// THE ASK, AND THE HALF OF IT NOTHING WATCHED. "multiselect context menu: add to
// anthology, for both works and annotations". The annotation half has had a journey
// since the day it landed (`gathering-a-selection`); the WORK half had a jsdom test
// that asserted the menu row renders and nothing at all about what pressing it does
// — so `const rule = ''` in SelectionBar passed the whole suite while the feature
// made an empty anthology and reported success.
//
// AND IT COULD NOT BE WRITTEN, WHICH IS WHY IT WAS NOT. A work selection's ⋯ would
// not open in a browser, and that was recorded as a harness limitation for two
// releases. It was a stylesheet bug: `.selection-bar` stuck at `top: 0`, which on a
// desktop is where `.topbar` already sits — 56px tall, z-index 40 — so once the page
// scrolled past the toolbar the bar parked BEHIND the header. Measured rather than
// guessed: the ⋯ reported a 44×44 box at y=9 and `elementFromPoint` at its own centre
// returned the top bar's search input. Every control on that bar was dead, which is
// also why "Set fields" has been unreachable since 1.16.0. The phone half of the
// offset was already right. A browser is the only tier that could have seen this:
// jsdom has no layout, so it opened the menu happily.
//
// A SERIES RATHER THAN THE WHOLE SHELF. Three books is a SET — the thing one book
// cannot demonstrate — and small enough that what comes back can be read rather than
// counted. The fixture is a committed file, so the series and the line below are
// facts about it, not a draw.
//
// THE MUTATION: force `rule` to '' in SelectionBar's `gather` and the anthology is
// created, the toast still says it gathered, and the final `see` fails on an
// anthology with nothing in it. That is exactly the shape that was passing.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const NAME = 'The whole run'
// One book of the three carries this line and nothing else in the library does.
const INSIDE = 'Shingle before wold in.'

it('a reader gathers every passage inside a selection of books', async () => {
  await app.goto('/library')

  await app.press('Filter by series')
  await app.press('Rowan against Hea')

  const ticked = await app.pressAll('Select this book')
  expect(ticked, 'the series should put several books on the shelf').toBe(3)

  // THE MENU THAT WOULD NOT OPEN.
  await app.press(`More for the ${ticked} selected`)
  await app.press('Add to anthology')

  await app.type('Anthology', NAME)
  await app.press('Save')
  // The app's own word that the server answered, rather than navigating into a
  // request still in flight.
  await app.see('gathered')

  // WHAT A SELECTION OF WORKS MEANS. Not the books — the server will not take a book
  // as an entry — but every passage inside them, which is what the reader picked the
  // books FOR.
  await app.goto('/anthologies')
  await app.press(NAME)
  await app.see(INSIDE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND THE BAR'S MENU OPENS ON A SHELF LONG ENOUGH TO SCROLL, which is the case the
// test above does NOT make.
//
// A RATING CAUGHT THAT, and it was the sharper half of this file's own story. The
// stylesheet fix that made a work selection reachable at all — `.selection-bar`
// parking behind the sticky top bar — had no guard: put `top: 0` back, rebuild, and
// the journey above goes on passing. Three books do not fill a viewport, so the bar
// never sticks, so the bug it was written for cannot reproduce inside it. A test that
// cannot fail on the defect it documents is the shape this whole directory exists to
// end, and it was sitting in the file whose header explains the defect.
//
// SO THIS ONE TAKES THE WHOLE SHELF. Every book on the Library is twenty-seven of
// them; ticking them scrolls the page, the bar stickies to the top, and THAT is the
// state where the header used to answer the press instead. It is also a plain thing
// to want — select everything, then open the menu.
//
// IT ASSERTS THE MENU AND NOT THE GATHER, deliberately: the act is covered above, and
// repeating it here would make a slow test slower for a claim already held. What is
// new is only that the control ANSWERS.
//
// THE MUTATION: revert `.selection-bar` to `top: 0` and this fails — the ⋯ reports a
// box, `press` clicks its centre, and the top bar's search field takes the click.
it('the selection bar still answers once the shelf has scrolled under it', async () => {
  await app.goto('/library')

  const ticked = await app.pressAll('Select this book')
  expect(ticked, 'the whole shelf should be more than a screenful').toBeGreaterThan(20)

  await app.press(`More for the ${ticked} selected`)
  // A row that only exists inside the menu, so seeing it IS the menu having opened.
  await app.see('Add to anthology')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
