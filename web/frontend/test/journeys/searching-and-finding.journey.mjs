// A reader remembers a phrase from a book, not its title, and searches for it —
// and the result names the book it is a highlight of rather than surfacing as a
// bare line of text with nothing to say where it came from.
//
// NEITHER OF THE TWO CHEAPER TIERS CATCHES WHAT THIS DOES. The box a person
// actually types into lives in the shell's top bar (App.jsx's TopBarSearch),
// nowhere near SearchPage.jsx — on Enter it writes the query to the keys
// SearchPage reads from localStorage and switches the whole app to the search
// tab. A jsdom render of SearchPage in isolation starts already standing on
// that screen with a results prop handed in; it cannot catch the top bar
// failing to hand the query off, or the navigation landing anywhere else. And a
// Go handler test of GET /search proves the JSON hit carries the right book_id
// — it says nothing about whether the browser then draws that hit grouped
// under its parent's own cover and title, which is the whole promise of a
// "sectioned" search.
//
// So this presses the real box on Home, submits with the key a person actually
// uses, and reads the book's name back off the rendered screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader searches for a phrase from a highlight and the result names the book', async () => {
  await app.goto('/')

  // "Epanchin" is the general's name in one of The Idiot's highlights the fixture
  // keeps ("General Epanchin was in the very prime of life…", found word for word
  // in Eva Martin's translation, Gutenberg #2638) — not a word the fixture's random
  // generator would ever produce (its invented titles run on alder, bramble,
  // cobble, ember and the like), so a hit here is never a coincidence of the
  // fixture, and a checked line survives a regeneration the way the invented books
  // do not. (It searched "roubles" until 3.1.0, from a line that was not checked
  // and is invented prose now.)
  await app.type('Search everything', 'Epanchin')
  await app.pressKey('Enter')

  // Home's own Favourites shelf never carries this book or its author — so
  // both lines are true only once the search actually ran, crossed to the
  // search screen, and grouped the hit under its parent work. Delete the type
  // and the Enter above and the screen never leaves Home: neither line would
  // ever appear.
  await app.see('The Idiot')
  await app.see('Fyodor Dostoyevsky')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
