// When a one-field save has to refetch the board, and when it must not.
//
// WHY THIS IS WORTH ITS OWN FILE. Hearting a quote is the most frequent thing
// anybody does in this app, and it cost two serialised round trips: a PUT whose
// reply already carried the updated row, and then a full GET of every row on the
// board to learn what the reply had just said. On a phone over a VPN that is the
// difference the owner reported as "terribly unresponsive" — and the release that
// went looking for it concluded there was exactly one duplicate read and named a
// different one.
//
// It lives in works.jsx — "what books and films share" — because all THREE boards
// need it and one of them was left out the first time, which is how the film
// board kept its extra round trip for a release after the other two lost theirs.
//
// The reason it could not simply be deleted is the other half: the filters are
// applied by the SERVER. Un-hearting a row while the favourites filter is on has
// to take it off the board, and splicing the reply back in would leave it sitting
// there looking saved and wrong. So the rule is a rule about the filters in force,
// and it is exported rather than buried in a closure so it can be read.

import { describe, expect, it } from 'vitest'
import { patchMovesTheRow } from '../../src/works.jsx'

describe('a heart, with no filter on', () => {
  it('does not move the row, so the reply is enough', () => {
    expect(patchMovesTheRow({ favorite: true }, {})).toBe(false)
    expect(patchMovesTheRow({ color: 'blue' }, {})).toBe(false)
    expect(patchMovesTheRow({ sticker_id: 3 }, {})).toBe(false)
  })
})

describe('and with the filter that reads it', () => {
  it('moves the row, so the board is refetched', () => {
    expect(patchMovesTheRow({ favorite: false }, { fav: true })).toBe(true)
    expect(patchMovesTheRow({ color: 'blue' }, { color: 'pink' })).toBe(true)
    expect(patchMovesTheRow({ tags: [] }, { tag: 'grief' })).toBe(true)
  })

  it('and only for the field that filter reads', () => {
    // A colour filter does not care about a heart. Refetching anyway is the round
    // trip this whole rule exists to avoid.
    expect(patchMovesTheRow({ favorite: true }, { color: 'pink' })).toBe(false)
    expect(patchMovesTheRow({ color: 'blue' }, { fav: true })).toBe(false)
    expect(patchMovesTheRow({ sticker_id: 3 }, { fav: true, color: 'pink', tag: 'grief' })).toBe(false)
  })
})

describe('the shape of the answer', () => {
  it('is a boolean, never a truthy string', () => {
    // `color && 'color' in fields` is the filter's VALUE when it matches, and a
    // caller writing `if (x === true)` would then be wrong in a way nothing else
    // would show.
    expect(patchMovesTheRow({ color: 'blue' }, { color: 'pink' })).toBe(true)
    expect(patchMovesTheRow({}, { color: 'pink' })).toBe(false)
  })

  it('survives being called with no filters at all', () => {
    expect(patchMovesTheRow({ favorite: true })).toBe(false)
  })
})
