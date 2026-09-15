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
