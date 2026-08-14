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
import { fireEvent, render, screen, within } from '@testing-library/react'
import { WishlistFolder } from '../../src/works.jsx'

const cover = (n) => ({ id: n, title: `Book ${n}`, cover_path: `c${n}.jpg`, annotation_count: 0 })

const covers = (c) => [...c.querySelectorAll('.wish-cell img')]
const cells = (c) => [...c.querySelectorAll('.wish-cell')]

describe('what the folder shows', () => {
  it('collages the first four, in the board’s own order', () => {
    const { container } = render(
      <WishlistFolder items={[1, 2, 3, 4, 5, 6].map(cover)} onOpen={() => {}} />,
    )
    const srcs = covers(container).map((i) => i.getAttribute('src'))
    expect(srcs).toHaveLength(4)
    // The board's order, not a sample: what the folder shows is what opening it
    // shows first, and a folder whose face was four other books would read as a
    // different pile from the one it opens.
    expect(srcs.map((s) => s.match(/c(\d)\.jpg/)[1])).toEqual(['1', '2', '3', '4'])
  })

  it('counts every one of them, not the four on its face', () => {
    render(<WishlistFolder items={[1, 2, 3, 4, 5, 6].map(cover)} onOpen={() => {}} />)
    expect(screen.getByText('6 books')).toBeTruthy()
  })

  it('says “book” in the singular for one', () => {
    render(<WishlistFolder items={[cover(1)]} onOpen={() => {}} />)
    expect(screen.getByText('1 book')).toBeTruthy()
  })

  it('fills the box with however many covers there are', () => {
    // A 2×2 grid holding one cover and three blanks reads as a broken image
    // rather than as a wishlist with one thing on it, so the layout adapts.
    for (const [n, spans] of [
      [1, ['span 2 / span 2']],
      [2, ['span 2 / span 1', 'span 2 / span 1']],
      [3, ['span 2 / span 1', 'span 1 / span 1', 'span 1 / span 1']],
    ]) {
      const { container, unmount } = render(
        <WishlistFolder items={Array.from({ length: n }, (_, i) => cover(i + 1))} onOpen={() => {}} />,
      )
      expect(cells(container)).toHaveLength(n)
      expect(cells(container).map((c) => c.style.gridArea)).toEqual(spans)
      unmount()
    }
  })

  it('leaves a cover-less book an empty cell rather than a placeholder', () => {
    // The "COVER" placeholder carries its own word, and four of them inside one
    // tile is the word printed four times at quarter size.
    const { container } = render(
      <WishlistFolder items={[cover(1), { id: 2, title: 'No cover' }]} onOpen={() => {}} />,
    )
    expect(cells(container)).toHaveLength(2)
    expect(covers(container)).toHaveLength(1)
  })

  it('names itself on the tile, over the collage', () => {
    const { container } = render(<WishlistFolder items={[cover(1)]} onOpen={() => {}} />)
    expect(within(container).getAllByText('Wishlist').length).toBeGreaterThan(0)
    expect(container.querySelector('.wish-folder-tag').textContent).toBe('Wishlist')
  })

  it('is not selectable, because it is not a row', () => {
    // A tick on it would have to mean "select the twelve behind it", which is a
    // different act from every other tick on the board and one the bar has no way
    // to report a count for.
    const { container } = render(<WishlistFolder items={[cover(1), cover(2)]} onOpen={() => {}} />)
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()
    expect(container.querySelector('.work-tile')).toBeNull()
  })

  it('opens on a plain click, with no gesture to learn', () => {
    let opened = 0
    render(<WishlistFolder items={[cover(1)]} onOpen={() => (opened += 1)} />)
    fireEvent.click(screen.getByTitle(/nothing from yet/))
    expect(opened).toBe(1)
  })

  it('speaks the film side’s word when it is given films', () => {
    render(<WishlistFolder kind="movie" items={[cover(1), cover(2)]} onOpen={() => {}} />)
    expect(screen.getByText('2 titles')).toBeTruthy()
  })
})
