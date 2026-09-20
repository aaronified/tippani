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

// AND THE SAMPLE FITS ITS COLUMN ON A DESK TOO. It draws as many covers as the
// column holds, and on a desk the column is half the card — which takes two 165px
// covers and not three.
//
// WHAT IT DOES NOT GUARD, stated because the first draft of this comment claimed
// it did. It looked as though a third book appearing here would also catch the
// spanning coming off the order group, since that was the shape that gave the
// size groups the whole width. It does not: with the size groups no longer marked
// wide, the sample's column is half the card whether the order list spans or not,
// so removing the spanning leaves this passing. Mutation-checked, both ways —
// only the first of the two below fails it. The layout itself is guarded in
// `test/dom/features-card.test.jsx`, which can see which group carries the span.
//
// THE MUTATION: restore `works.slice(0, 3)` and this fails on the third book.
it('a reader at a desk sees a sample that fits its half of the card', async () => {
  await app.goto('/settings')
  await app.press('Sections')
  await app.see('Almanac Ember')
  await app.see('Marram Ke')
  await app.gone('Reed Reed Reed')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
