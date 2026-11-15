// A reader keeps their material set and puts one other material on the cards.
//
// WHAT THIS GUARDS. The set picker dresses four surfaces at once and, until the row this walks, nothing in Settings
// could change just one of them: the preference was stored and drawn and no control wrote it. What the pure tier cannot
// show is that a reader can reach it and that the choice is kept (a reload comes back with it).
//
// THE MUTATIONS. Delete the press on the door and it goes red: the panel is behind it. Make the panel's choice not save
// (drop the write) and the reload no longer finds Granite.
//
// It knows the words on the screen and nothing else: no tile name from the source, no preference key.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader puts one material on the cards, and it is still there after a reload', async () => {
  await app.goto('/')
  await app.press('Settings')
  await app.press('Theme')

  await app.press('Open the materials')
  await app.see('Background')
  await app.see('Covers')

  await app.choose('Cards', 'Granite')
  await app.see('Granite')

  // a reload comes back with it
  await app.goto('/')
  await app.press('Settings')
  await app.press('Theme')
  await app.press('Open the materials')
  await app.see('Granite')
  // one surface wears it; the other three still read "the set's own"
  const words = (await app.onScreen()).toLowerCase()
  expect(words.split('granite').length - 1, 'the choice reached more than the cards').toBe(1)
  expect(words.split("the set's own").length - 1, 'the other surfaces lost the set\'s own').toBe(3)

  // and the set's own is always one choice away
  await app.choose('Cards', "The set's own (Paper)")
  await app.gone('Granite')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
