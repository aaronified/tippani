// A reader picks a different ground for the app to sit on.
//
// WHAT THIS GUARDS. A ground replaces the three stacked surfaces and the two inks
// at once, written onto the root as custom properties by the same function that
// applies the theme. The unit tier measures every ground's contrast and the dom
// tier can prove the button saves — neither can prove that pressing it repaints
// the app, because that happens through the stylesheet rather than through React.
//
// THE MUTATION. Delete the press and it goes red: the swatch that is chosen is
// the one the screen reports, and without the press that is still the shipped one.
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
  await app.press('Sepia')

  // WHAT THE SCREEN SAYS IT IS STANDING ON, and both halves matter: the one
  // pressed is chosen AND the one that was chosen before is not. Asserting only
  // the first would pass against a control that lit every swatch it was given.
  expect(await app.chosen('Sepia'), 'the pressed ground should be the chosen one').toBe(true)
  expect(await app.chosen('Cream'), 'the shipped ground should have let go').toBe(false)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
