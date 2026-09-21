// A reader has been tuning Settings, decides they preferred it as it came, and
// puts the whole screen back from one place — the ⋯ menu — rather than walking
// the five sections and pressing Reset section on each.
//
// WHY THIS NEEDED A JOURNEY AND NOT A DOM TEST. There are four separate things
// here and only the last one is what a reader gets: a row published to a menu
// the screen does not render (the shell reads a Set of builders when the ⋯
// opens, so a screen can publish nothing and the menu still looks fine), a
// count that decides whether the row is offered at all, a confirm worded from
// that count, and a write to the one route that can CLEAR a preference — the
// ordinary PUT reads an empty value as "leave this alone", which is how a
// green suite and a button that kept nothing coexisted here once before. A
// mounted-component test can hold any one of those and still be describing a
// menu with no rows in it.
//
// THE MUTATION. Delete the `actions:` builder from `useScreenBar` in
// Settings.jsx and this goes red at `see('Reset settings')`: the ⋯ opens on
// Help alone, which is exactly what it did before this row existed and exactly
// what a reader would have found. Deleting the reset's `'*'` branch instead
// leaves the row and the confirm and goes red on the reload, where Sepia is
// still the ground.
//
// THE RELOAD IS THE POINT. Before it, "the ground is Cream again" is also true
// of a press that only set a React state variable and told the server nothing.
// `app.goto` is a real navigation and a fresh mount, so asking after one is
// asking the server.
//
// AND THE MENU IS ASKED AGAIN AT THE END, because the row is meant to be
// ABSENT when there is nothing to reset. That pair — offered while something is
// set, gone once nothing is — is the whole of its arming, and checking only the
// first half would pass over a row that is always there.
//
// The reset is also this journey's own cleanup: it leaves the shared fixture
// with the preferences it found.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader puts every section back from the screen menu', async () => {
  await app.goto('/settings')
  await app.press('Theme')

  // Something set, in a section, so there is a configuration to undo.
  await app.press('The light ground')
  await app.press('Sepia')
  expect(await app.chosen('Sepia'), 'the pressed ground should be the chosen one').toBe(true)
  await app.press('Hide the options')

  await app.press('Everything this screen can do')
  await app.see('Reset settings')
  await app.press('Reset settings')

  // It says how much the press will change before it changes it.
  await app.see('Reset every section?')
  await app.press('Reset them all')

  // Not the state the press left behind — a fresh navigation, asking the server
  // what it actually kept.
  await app.goto('/settings')
  await app.press('Theme')
  await app.press('The light ground')
  expect(await app.chosen('Cream'), 'the shipped ground should be back').toBe(true)
  expect(await app.chosen('Sepia'), 'the reset did not reach the server').toBe(false)
  await app.press('Hide the options')

  // Nothing is set, so there is nothing to offer.
  await app.press('Everything this screen can do')
  await app.gone('Reset settings')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
