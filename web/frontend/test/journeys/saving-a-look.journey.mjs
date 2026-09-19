// A reader names the look they are wearing, changes something, and goes back to it.
//
// WHAT THIS GUARDS. A saved look holds six fields that travel together — both
// grounds, the accent, the material set, the tiles and the dials — and the whole
// point is that switching between two is one press rather than six. The pure tier
// proves the six are carried; what it cannot prove is that pressing a saved name
// on a real screen puts the app back into that look, because the applying happens
// through the stylesheet rather than through React state.
//
// THE MUTATION. Delete the press on the saved name and it goes red: the ground is
// still the one changed to, not the one saved.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader saves a look, wanders off, and comes back to it', async () => {
  await app.goto('/')
  await app.press('Settings')
  await app.press('Theme')

  // The shipped ground, which is what we are about to name and then leave. The
  // grounds live behind the door the row's sub-line has always described — "each
  // one opens its own options" — so seeing what is on is a press away.
  await app.press('The light ground')
  expect(await app.chosen('Cream')).toBe(true)
  await app.press('Close')

  await app.type('Name for the look you are wearing', 'Daylight')
  await app.press('Save this look')
  await app.see('Daylight')

  // Wander: a different ground entirely.
  await app.press('The light ground')
  await app.press('Sepia')
  expect(await app.chosen('Sepia')).toBe(true)
  expect(await app.chosen('Cream')).toBe(false)
  await app.press('Close')

  // And back, in one press.
  await app.press('Daylight')
  await app.press('The light ground')
  expect(await app.chosen('Cream'), 'the saved look should have come back').toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
