// THE WORKS STRIP IS IN RELEASE ORDER, WHICH IS WHAT IT SAYS IT IS.
//
// THE REPORT, the owner's: "the works say it is release order, and it was. but
// then i rectified a metadata problem in gardens of the moon (which released in
// 1999, not 2009 as my backup suggested). this should have automatically taken it
// to the front. but it didn't."
//
// WHAT IT WAS. `PersonCredits` ordered by role then TITLE, `castWhere` by title
// alone, and neither shape carried a year — so a strip of nine Erikson novels
// opened Deadhouse Gates, Dust of Dreams, Gardens of the Moon under a line
// promising release order. Correcting a year moved nothing because no tile had
// ever been placed by one.
//
// WHAT IS ASSERTED HERE IS THE READER'S ORDER, from the rendered strip rather
// than from the helper: a caller that sorts its own list before handing it over
// would pass a test of the helper and still leave the OTHER caller wrong, which
// is exactly the shape of defect the repo's "similar things should act similarly"
// directive exists to stop.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that a tile carries
// `year`, 0 meaning the library does not know; and that a person's strip is two
// concatenated lists (what they played, then what they made), so the order has to
// survive a join it does not control.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { AppearanceStrip } from '../../src/characterRows.jsx'

const tile = (title, year) => ({ key: title, title, year, kind: 'book', badge: null, onOpen: () => {} })

const titlesOf = (tiles) => {
  const { container } = render(<AppearanceStrip tiles={tiles} hint="the order is the release order" />)
  return [...container.querySelectorAll('.cs-tile-title')].map((n) => n.textContent)
}

describe('a works strip', () => {
  it('puts the earliest work first however the list arrives', () => {
    // The owner's own shelf, in the alphabetical order the query handed over.
    expect(titlesOf([
      tile('Deadhouse Gates', 2000),
      tile('Dust of Dreams', 2009),
      tile('Gardens of the Moon', 1999),
    ])).toEqual(['Gardens of the Moon', 'Deadhouse Gates', 'Dust of Dreams'])
  })

  it('and moves a work the moment its year is corrected', () => {
    // The report itself: one field changed, nothing else. A strip that reads its
    // order off anything but the year cannot pass both of these.
    const wrong = [tile('Deadhouse Gates', 2000), tile('Dust of Dreams', 2009), tile('Gardens of the Moon', 2009)]
    const right = wrong.map((w) => (w.title === 'Gardens of the Moon' ? { ...w, year: 1999 } : w))
    expect(titlesOf(wrong)[0]).not.toBe('Gardens of the Moon')
    expect(titlesOf(right)[0]).toBe('Gardens of the Moon')
  })

})
