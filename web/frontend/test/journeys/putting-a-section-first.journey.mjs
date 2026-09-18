// A reader decides the Catalogue matters more to them than the Library, and
// moves it up.
//
// WHAT THIS GUARDS, AND WHY NO UNIT TIER CAN. The order lives in one preference,
// is written by one card, and is read by four separate nav lists — the desktop
// rail, the drawer, the phone's bar and the ＋ menu — all through one function.
// A dom test can prove the card writes the preference; what it cannot prove is
// that the thing a reader actually looks at moved, because the rail is drawn by a
// different component on a different screen from the card that reordered it.
// That gap is precisely where "the preference saved and nothing moved" lives.
//
// THE MUTATION. Delete the press on the up arrow and it goes red: the rail comes
// back in the declared order, and the assertion below is about which of two names
// comes first in it.
//
// It knows the words on the screen and nothing else — no route, no component, no
// preference key, no class.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// Where the two section names sit relative to each other, read off the rendered
// screen. Index rather than presence, because both names are always on screen —
// what the reorder changes is which comes first, and a test that only asked
// whether they were there would pass in either order.
const order = async () => {
  const text = await app.onScreen()
  return { library: text.indexOf('Library'), catalogue: text.indexOf('Catalogue') }
}

it('a reader moves the Catalogue above the Library, and the rail follows', async () => {
  await app.goto('/')

  const before = await order()
  expect(before.library, 'the Library should start above the Catalogue').toBeLessThan(before.catalogue)

  await app.press('Settings')
  await app.press('Sections')

  // The control says what it does, so the journey can name it the way a reader
  // would read it out.
  await app.press('Move Catalogue up')

  const after = await order()
  expect(after.catalogue, 'the Catalogue should now come first').toBeLessThan(after.library)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
