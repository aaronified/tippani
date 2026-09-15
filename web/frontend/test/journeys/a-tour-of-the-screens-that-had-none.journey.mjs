// A reader opens the Bin, asks it to show itself, and is shown the Bin.
//
// SEVEN SCREENS DREW NO BUTTON AT ALL. The per-screen tour is a filter over the
// steps that already exist, and the steps that existed were the whole-app tour's:
// Home, Library, the Catalogue, Tags, Metadata, Stats and Settings. Every other
// screen — Quotes, Search, Anthologies, the Bin, Checks, Cleanup and the import
// queue — fell out of that filter empty, so its help offered nothing, which is right
// for a tour of nothing and wrong as an answer to "the help section shall have the
// onboarding journey for each screen separately".
//
// WHY THE BIN AND NOT ONE OF THE OTHER SIX. It is the plainest: one step, no admin
// gate, no section preference that could switch it off, and nothing on it that a
// fixture has to provide. A screen whose walk depends on what is in the library
// would be asserting the fixture as much as the feature.
//
// AND THE COUNT IS THE HALF THAT CATCHES A MISFILED STEP. "(1 step)" is a claim
// about which steps answer to this screen; a step given the wrong `screen` or `tab`
// would still draw a button, still open, and still say something true about the
// app — just not about the Bin. The number is what notices.
//
// THE MUTATION: take the `tab: 'bin'` off the bin step and the button is gone, so
// the press fails with nothing named that way on the screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a screen that had no walkthrough has one, and it is that screen’s', async () => {
  await app.goto('/bin')

  await app.press('Help for Bin')
  await app.press('Show me around this screen (1 step)')

  // The Bin's own step, on the Bin.
  await app.see('Nothing goes straight out')
  // AND NOT THE TOUR FROM THE TOP, which is what a per-screen walk is not.
  await app.gone('Welcome to tippani')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
