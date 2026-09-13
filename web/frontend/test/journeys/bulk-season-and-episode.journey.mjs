// THE ACCEPTANCE TEST OF THE WHOLE PLAN.
//
// A reader picks every line from a show and sets the season on all of them at once.
//
// THIS IS THE FEATURE THAT SHIPPED 100% DEAD. The bulk season/episode control
// answered HTTP 400 on every press and wrote nothing, and two tests stayed green
// through it: one asserting the shape the client sends, one asserting the shape
// the server accepts, each right about its own half, nothing comparing them, and
// neither ever pressing the button. This journey presses the button.
//
// IT MUST GO RED IF 216c4865's WIRE FIX IS REVERTED. That is not a hope, it is the
// check the plan is judged by, and it is run.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader sets the season on every line of a show at once, and it sticks', async () => {
  await app.goto('/catalogue')

  // The one work in the fixture with a fixed title rather than a generated one —
  // it is ADDED by the curator precisely so this journey has a show with several
  // lines to work on. The archive's own show carries one line, which cannot
  // exercise a bulk edit at all.
  await app.press('A Serial In Several Parts')
  await app.see('the first of six')

  const ticked = await app.pressAll('Select this line')
  expect(ticked, 'the show should carry six lines to tick').toBe(6)

  await app.press('More for the 6 selected')
  await app.press('Set fields')
  await app.see('Set a field on 6')

  // The panel sets ONE field on every selected record: choose which, give it a
  // value, apply. Its own words: "Choose one field and one value. Every selected
  // record gets it; nothing else is touched."
  await app.press('Which field to set')
  await app.press('Season')
  await app.type('Season', '2')
  await app.press('Apply')

  await app.see('S2')

  // AND IT IS THE SERVER'S NOW, WHICH THIS JOURNEY OF ALL JOURNEYS HAS TO PROVE.
  // The line above passes on an app that draws what you asked for and wrote
  // nothing — and "wrote nothing" is the exact failure this file exists to
  // catch: the control answered 400 on every press while two unit tests stayed
  // green. Asserting only against the render the press produced would be the
  // same shape of mistake one level up. This was the critic's finding, and it
  // was right.
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.see('S2')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
