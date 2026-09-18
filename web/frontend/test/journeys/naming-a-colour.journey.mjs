// A reader goes to name the colour they mark quotes with.
//
// WHAT THIS GUARDS. Colour categories were a card on Settings and are a section of
// the Metadata console now, because what KIND of note a quote is is a fact about
// the library rather than a preference about the app — the same reasoning that
// moved the tags and the language table. A move between screens is exactly the
// change that unit tests cannot see: both screens still render, both still pass
// their own suites, and the control is simply somewhere else.
//
// THE MUTATION. Delete `press('Colours')` and it goes red — Metadata opens on
// Overview, and the category names are not on it.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader finds the colour categories on Metadata, not in Settings', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Colours')
  // The card's own heading, which only this section carries.
  await app.see('Colour categories')

  // AND IT IS NOT ON SETTINGS ANY MORE, which is the half a "it is here" check
  // cannot state. Theme is where it used to live.
  await app.press('Settings')
  await app.press('Theme')
  await app.gone('Colour categories')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
