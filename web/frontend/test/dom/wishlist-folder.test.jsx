// The wishlist, folded into one tile.
//
// A library that keeps quotes accumulates books it has nothing from yet — a shelf
// photographed at a friend's house, an import that brought the titles and not the
// highlights, everything bought and not started. They are the wishlist, and the
// wishlist is DERIVED: a work with zero quotes is on it, there is no column, and it
// clears itself the moment you add a quote (PLAN §"The wishlist is derived from the
// annotation count").
//
// So the thing worth asserting is not that the folder exists. It is that the folder
// is a DOOR rather than a place: it holds exactly what the chip beside it selects,
// opening it is that chip, and nothing about it is stored. A folder with its own
// membership would be a second source of truth for something already computable —
// which is the reason the wishlist has no column in the first place.

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WishlistFolder } from '../../src/works.jsx'

const cover = (n) => ({ id: n, title: `Book ${n}`, cover_path: `c${n}.jpg`, annotation_count: 0 })


describe('what the folder shows', () => {

  // One test over all three captions rather than three: each case is the same
  // render-and-read-the-caption and only the items and the kind differ, so the
  // collected list names every caption that came out wrong instead of throwing
  // on the first. Each row keeps the name of the it() it used to be, and this is
  // the shape the sibling test below already uses.

  it('opens on a plain click, with no gesture to learn', () => {
    let opened = 0
    render(<WishlistFolder items={[cover(1)]} onOpen={() => (opened += 1)} />)
    fireEvent.click(screen.getByTitle(/nothing from yet/))
    expect(opened).toBe(1)
  })
})
