// A reader goes looking for what their quotes' languages are set to, and finds it
// where the app says it lives.
//
// WHAT THIS GUARDS. The v3 pack draws no Languages section on the Metadata
// console, and its own Settings prototype depends on one — the quote faces are
// "read from the metadata language table, which is the only place a quote's
// language is defined; Settings links there rather than keeping a second list."
// The table existed, but as a pop-up behind a button inside the Sources section,
// which is not an address another screen can send anybody to. This is the section
// that gap required.
//
// THE MUTATION. Delete `press('Languages')` and it goes red: Metadata opens on
// Overview, and no language row is on that screen.
//
// It knows the words on the screen and nothing else — no route, no component, no
// preference key.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader finds the language table on its own section, not behind a pop-up', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Languages')

  // A language the fixture's own quotes are in, and the control that says what a
  // quote of that language wears where every other quote wears a face.
  await app.see('English')

  // AND IT IS NOT BEHIND A DOOR. The button that used to open it is gone from
  // Sources, which is the half of this change a "the table is somewhere" check
  // cannot state.
  await app.press('Sources')
  await app.gone('Language marks')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
