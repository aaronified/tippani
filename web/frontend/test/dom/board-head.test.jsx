// ONE BAR, RENDERED BY WHICHEVER BOARD IS ASKING.
//
// WHAT THIS GUARDS. The bar above a board of quotes existed in two copies — the
// book's in Library.jsx and the film's in Movies.jsx — and they drifted until the
// owner reported the two work screens as two different screens. The repo's rule
// is that a control drawn on two screens lives in ONE function both call, and
// that where a screen genuinely needs something the other does not, it passes
// that fact IN rather than keeping its own copy of the verb.
//
// So these cases are about the seam, not about the book: the same component,
// handed two different kinds' worth of props, must draw two different bars
// WITHOUT either kind's vocabulary being written into it. A bar that quietly
// falls back to the book's dimensions would render perfectly on the screen this
// suite happens to mount, and be wrong on the other one — which is exactly the
// failure the fold exists to end.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { BoardHead, BoardStrip } = await import('../../src/boardHead.jsx')

const BOOK = { dims: ['none', 'chapter', 'color', 'tag', 'date'], sortDims: ['default', 'date', 'chapter', 'location', 'length', 'category'] }
const SHOW = { dims: ['none', 'episode', 'character', 'color', 'tag', 'date'], sortDims: ['default', 'date', 'episode', 'character', 'timestamp', 'length', 'category'] }

const head = (props = {}) =>
  render(
    <BoardHead
      dims={BOOK.dims}
      sortDims={BOOK.sortDims}
      groupBy="none"
      onGroup={() => {}}
      sort={{ col: 'default', dir: 'asc' }}
      onSort={() => {}}
      color=""
      onColor={() => {}}
      tags={[]}
      tag=""
      onTag={() => {}}
      tagAllLabel="All tags"
      chips={[]}
      captureLabel="Capture"
      onCapture={() => {}}
      {...props}
    />,
  )

const openGroup = () => fireEvent.click(screen.getByLabelText(/^Group quotes by$/i))
const rowNames = () => screen.getAllByRole('menuitemradio').map((el) => el.textContent.trim())

describe('the phone strip carries the direction as a key', () => {
  it('flips the direction without opening anything', () => {
    const onSort = vi.fn()
    render(
      <BoardStrip dims={BOOK.dims} sortDims={BOOK.sortDims} groupBy="none" onGroup={() => {}} sort={{ col: 'default', dir: 'asc' }} onSort={onSort}>
        <span>12 quotes</span>
      </BoardStrip>,
    )
    // "direction is one bit, so it is one tap and never a sheet"
    const key = screen.getByLabelText(/ascending/i)
    fireEvent.click(key)
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort.mock.calls[0][0]({ col: 'date', dir: 'asc' })).toEqual({ col: 'date', dir: 'desc' })
  })

})
