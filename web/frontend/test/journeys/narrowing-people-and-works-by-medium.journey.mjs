// A reader narrows People and Works to one medium, and both lists name each
// row's medium in words on a desk.
//
// THE ASK: "character page needs one more filter: type (book, game, movie, show)
// … the icons for all of them shall be there in the list itself. on desktop,
// these glyphs will also have the type name. same for works, and people as
// well". narrowing-characters-by-medium covers Characters; this is the "same for
// works, and people" half, which a rating found had no journey — People's filter
// line could be deleted with every test green.
//
// THE MUTATIONS:
// - drop People's medium filter (the `(p.media || []).includes(medium)` line) and
//   `gone('Rhoda Thurlow')` fails;
// - take 'game' out of the Works type list and `choose('Type', 'Games')` fails;
// - hide the painted word on a desk and `see('game')` fails on both screens,
//   because before the dropdown is opened the rows are the only place it is
//   written.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader narrows People to the ones in games', async () => {
  await app.goto('/metadata/people')
  await app.see('Rhoda Thurlow')
  await app.see('Ysolde Quainton')
  await app.see('game')

  await app.choose('Type', 'Games')

  await app.see('Ysolde Quainton')
  await app.gone('Rhoda Thurlow')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('a reader narrows Works to the games', async () => {
  await app.goto('/metadata/works')
  await app.see('Marram Cinder Almanac Sparrow')
  await app.see('Almanac Gable')
  await app.see('game')

  await app.choose('Type', 'Games')

  await app.see('Marram Cinder Almanac Sparrow')
  await app.gone('Almanac Gable')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
