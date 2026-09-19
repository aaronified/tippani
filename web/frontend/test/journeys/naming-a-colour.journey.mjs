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
// AND ITS LANDMARK IS A ROW, NOT A HEADING, which is the second thing this file
// has now been through. It watched for the card's title "Colour categories"; that
// title stood directly under a tab already reading "Colours", each with its own
// info dot, and it went when those were consolidated. A journey pinned to a
// heading goes red on a change to the heading rather than to the thing.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader finds the colour categories on Metadata, not in Settings', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Colours')
  // THE ROW THAT ONLY THIS SECTION DRAWS, not a heading. This read
  // `see('Colour categories')` — the card's own title — and that title is gone: it
  // sat directly under a tab already saying "Colours", two headings with an info
  // dot each, which is the thing the owner asked to have consolidated. The names
  // are what the section is for and they are still the only place they appear.
  await app.see('Default')

  // AND IT IS NOT ON SETTINGS ANY MORE, which is the half a "it is here" check
  // cannot state. Theme is where it used to live.
  await app.press('Settings')
  await app.press('Theme')
  await app.gone('Default')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
