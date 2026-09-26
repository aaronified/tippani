// A reader who is confused by one screen asks that screen to show itself, and gets
// that screen — not the whole app from the beginning.
//
// WHERE THIS CAME FROM. The guided tour was one journey through every feature,
// replayable only from a card in Settings. The owner: "the help section shall have
// the onboarding journey for each screen separately. a button in the help screen
// that will go you through the features in that screen" — and then, of the card it
// replaces, "no need for a global onboarding settings". So the walkthrough moved to
// the "?" that is already one press from everywhere, and it runs the steps that
// belong to the screen the reader is standing on.
//
// THE ASSERTION THAT MATTERS IS THE ONE ABOUT WHAT IS ABSENT. A tour that opened
// here and started at "Welcome to tippani" would be the old behaviour wearing a new
// button — it would navigate the reader to Home, which is the opposite of being
// shown the screen they were stuck on. So this checks both halves: a Settings step
// is on screen, and the welcome step is not.
//
// THE MUTATION: drop `onlyTab` where App starts the tour, and this fails on the
// `gone` — the whole-app tour opens on its welcome step and walks to Home.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader asks Settings to show itself and is shown Settings, not the whole app', async () => {
  await app.goto('/settings')

  // The "?" every screen carries. Its name says which screen it is for, which is
  // also how this journey knows it pressed the right one.
  await app.press('Help for Settings')

  // THE COUNT IS PART OF THE PROMISE. Settings owns three steps, and the button
  // says so rather than opening an unknown number of them.
  await app.press('Tour this page (3 steps)')

  // A Settings step, spotlighted on the screen it belongs to.
  await app.see('Make it yours')
  // AND NOT THE TOUR FROM THE TOP.
  await app.gone('Welcome to tippani')

  // AND THE WAY BACK IS ON THE STEP ITSELF. The owner asked for both halves: "on any
  // of the onboarding screens the user can skip all or if he has already skipped, on
  // any one of them they should be able to manually enable them as well."
  //
  // This reader HAS skipped — the harness signs in and skips the first-run tour so
  // it does not sit over every other journey's screen — so the slot that would
  // otherwise say "skip tour" is offering it back. That is the state the owner's
  // second half is about, and it is the one a journey can reach without pretending.
  await app.press('Turn the tour back on')
  await app.see('The tour is back on.')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
