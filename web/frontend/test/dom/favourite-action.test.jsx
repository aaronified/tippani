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

  // A screen that cannot favourite simply does not pass the handler, which is
  // how the action stays ABSENT rather than present and dead — the same rule
  // every other entry in this registry follows.

  // In the overflow, not the row: the row is the tightest space on the card and
  // already holds the ♥ on a pointer device.

  // A menu item says what pressing it DOES; the card's ♥ is a toggle and shows
  // where the quote stands. Different widget, different rule — the same pair as
  // a board's Hide/Show beside Settings' eye.

  it('runs the handler on the row it was opened from', () => {
    let got = null
    const acts = actionsFor('annotation', quote, { favourite: (row) => { got = row } })
    acts.find((a) => a.id === 'favourite').run()
    expect(got).toBe(quote)
  })
})

