// Favourite, in the card's own menu (1.14.2).
//
// It was the one action the selection bar could do to forty quotes and a single
// card could not. The ♥ is drawn on the card, but only on a pointer device where
// hovering reveals the action row — so on a phone, the most common thing anybody
// does to a quote was reachable in bulk and not one at a time.
//
// These go through the registry rather than through a screen, because all three
// card kinds read from it and the point of that file is that a gesture can never
// offer something the buttons do not.

import { describe, expect, it } from 'vitest'
import { actionsFor, atOverflow, bulkActionsFor } from '../../src/actions.jsx'

const quote = { id: 1, quote: 'A stitch in time', favorite: false }
const ids = (list) => list.map((a) => a.id)

describe('favourite on a single card', () => {
  it('is offered when the screen can do it', () => {
    const acts = actionsFor('annotation', quote, { favourite: () => {} })
    expect(ids(acts)).toContain('favourite')
  })

  // A screen that cannot favourite simply does not pass the handler, which is
  // how the action stays ABSENT rather than present and dead — the same rule
  // every other entry in this registry follows.
  it('is absent when the screen cannot', () => {
    expect(ids(actionsFor('annotation', quote, {}))).not.toContain('favourite')
  })

  // In the overflow, not the row: the row is the tightest space on the card and
  // already holds the ♥ on a pointer device.
  it('lives in the overflow beside Edit and Delete', () => {
    const acts = actionsFor('annotation', quote, { favourite: () => {}, edit: () => {}, remove: () => {} })
    expect(ids(atOverflow(acts))).toEqual(['edit', 'favourite', 'delete'])
  })

  // A menu item says what pressing it DOES; the card's ♥ is a toggle and shows
  // where the quote stands. Different widget, different rule — the same pair as
  // a board's Hide/Show beside Settings' eye.
  it('says what pressing it will do, not where the quote stands', () => {
    const off = actionsFor('annotation', quote, { favourite: () => {}, favourited: false })
    const on = actionsFor('annotation', quote, { favourite: () => {}, favourited: true })
    expect(off.find((a) => a.id === 'favourite').label).toBe('Favourite')
    expect(on.find((a) => a.id === 'favourite').label).toBe('Unfavourite')
  })

  it('runs the handler on the row it was opened from', () => {
    let got = null
    const acts = actionsFor('annotation', quote, { favourite: (row) => { got = row } })
    acts.find((a) => a.id === 'favourite').run()
    expect(got).toBe(quote)
  })
})

describe('favourite over a selection', () => {
  // Already there for quotes, and asserted here so the pair cannot drift: the
  // single-card menu and the bulk bar have to agree about which kinds can be
  // favourited at all.
  it('is offered over quotes and not over works', () => {
    const ctx = { favourite: () => {} }
    expect(ids(bulkActionsFor('annotation', [1, 2], ctx))).toContain('favourite')
    expect(ids(bulkActionsFor('dialogue', [1, 2], ctx))).toContain('favourite')
    // A book's ♥ lives on its detail header, and favouriting forty books from a
    // bar is not a thing the shelf offers.
    expect(ids(bulkActionsFor('book', [1, 2], ctx))).not.toContain('favourite')
    expect(ids(bulkActionsFor('movie', [1, 2], ctx))).not.toContain('favourite')
  })
})
