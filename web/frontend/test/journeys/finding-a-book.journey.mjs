// A reader opens their library and finds a book that Home was not showing them.
//
// THE FIRST DRAFT OF THIS FILE WAS VACUOUS AND PASSED, which is why the assertion
// is the shape it is. It pressed "Library" and then looked for Moby-Dick — and
// Moby-Dick is on HOME too, so deleting the press changed nothing and the journey
// stayed green. A test that passes with its own central action removed is testing
// the setup.
//
// So it names a work the Home screen does not carry and a control only the full
// list offers. Both were read off a real render, and the press was deleted to
// check that both go red without it.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens their library and finds a book Home was not showing', async () => {
  await app.goto('/')

  // Home shows a handful of works and shuffles which; the whole shelf is a press
  // away. "Library" and not "Library 22 | 13": the nav carries its counts in its
  // accessible name, and a journey that spelled them would break the next time
  // the fixture gained a book.
  await app.press('Library')

  await app.see('Library')
  // A BOOK THAT SURVIVES A REGENERATION OF THE FIXTURE. Every other title in the
  // library is invented, so re-running the curator could change it; the four
  // public-domain books are kept verbatim and this is one of them. A journey
  // pinned to an invented title would go red on a fixture rebuild that changed
  // nothing about the app.
  await app.see('The Idiot')
  await app.see('Fyodor Dostoyevsky')
  // And a verb only the full shelf offers.
  await app.see('Export')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
