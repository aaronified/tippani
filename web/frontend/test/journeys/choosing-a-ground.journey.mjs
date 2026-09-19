// A reader picks a different ground for the app to sit on.
//
// WHAT THIS GUARDS. A ground replaces the three stacked surfaces and the two inks
// at once, written onto the root as custom properties by the same function that
// applies the theme. The unit tier measures every ground's contrast and the dom
// tier can prove the button saves — neither can prove that pressing it repaints
// the app, because that happens through the stylesheet rather than through React.
//
// THE MUTATION. Delete the press on the ground and it goes red: the swatch that is
// chosen is the one the screen reports, and without the press that is still the
// shipped one.
//
// It knows the words on the screen and nothing else — no token, no preference key,
// no class.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader changes the ground, and the app is standing on it afterwards', async () => {
  await app.goto('/')

  await app.press('Settings')
  // Theme is the section this opens on, but say so rather than rely on it: the
  // section is remembered per device and a previous journey is not this one's
  // setup.
  await app.press('Theme')

  // The swatches are named by the ground they select, and the shipped one is the
  // one already chosen — so pressing a different one is a real change.
  // THE GROUNDS ARE BEHIND THEIR OWN DOOR NOW, which is what the row has always
  // said they were: "Light ground · dark ground · accent. Each one opens its own
  // options." A reader opens the side they are dressing and picks from it.
  await app.press('The light ground')
  await app.press('Sepia')

  // WHAT THE SCREEN SAYS IT IS STANDING ON, and both halves matter: the one
  // pressed is chosen AND the one that was chosen before is not. Asserting only
  // the first would pass against a control that lit every swatch it was given.
  expect(await app.chosen('Sepia'), 'the pressed ground should be the chosen one').toBe(true)
  expect(await app.chosen('Cream'), 'the shipped ground should have let go').toBe(false)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND THE OTHER SIDE, WHICH A READER COULD NOT REACH AT ALL.
//
// The row used to offer the grounds of whichever mode was on screen — defensible,
// because a swatch is an honest preview only in the ground it selects, and wrong
// for the reader it leaves stuck: somebody on a dark screen could not set their
// daylight look without switching the whole app to daylight to do it. A door is
// not a preview, so it can offer the pair.
//
// THE RELOAD IS THE POINT, as everywhere else: before it, "the dark ground says
// Tobacco" is also true of a panel that only ever set its own state.
//
// THE MUTATION: drop the dark door from the row and this fails on the press.
it('a reader dresses the night while standing in the day, and it is kept', async () => {
  await app.goto('/settings')
  await app.press('Theme')

  await app.press('The dark ground')
  await app.press('Tobacco')
  expect(await app.chosen('Tobacco'), 'the pressed ground should be the chosen one').toBe(true)
  expect(await app.chosen('Night'), 'the shipped ground should have let go').toBe(false)
  await app.press('Hide the options')

  // AND THE DAY IS UNTOUCHED, which is what makes these two settings and not one.
  await app.press('The light ground')
  expect(await app.chosen('Sepia'), 'the light ground moved with the dark one').toBe(true)
  await app.press('Hide the options')

  await app.goto('/settings')
  await app.press('Theme')
  await app.press('The dark ground')
  expect(await app.chosen('Tobacco'), 'the night was not kept').toBe(true)

  // Leave the world as it was found: this is a shared fixture.
  await app.press('Night')
  await app.press('Hide the options')
  await app.press('The light ground')
  await app.press('Cream')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
