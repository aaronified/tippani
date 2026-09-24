// A reader narrows the Characters list to one medium, and each row says its
// media in words on a desk.
//
// THE ASK: "character page needs one more filter: type (book, game, movie, show)
// same character can have multiple type. the icons for all of them shall be there
// in the list itself. on desktop, these glyphs will also have the type name."
//
// THE MUTATIONS: make the medium filter pass every row and `gone('Osric
// Stonebrook')` fails; hide the painted word on a desk and `see('game')` fails,
// because before the dropdown is opened the rows are the only place it is written.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader narrows Characters to the games', async () => {
  await app.goto('/metadata/characters')
  // A character from a game and one from a film, both listed to begin with.
  await app.see('Ysolde Quainton')
  await app.see('Osric Stonebrook')
  // Each row names its medium beside the glyph on a desk. Asked BEFORE the
  // dropdown is touched: once it reads "games", that word is on screen too.
  await app.see('game')
  await app.see('film')

  await app.choose('Type', 'Games')

  await app.see('Ysolde Quainton')
  await app.gone('Osric Stonebrook')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
