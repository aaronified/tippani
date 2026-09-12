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

describe('the arrangement field offers the kind its own dimensions', () => {
  it('groups a book by chapter and never by episode', () => {
    head()
    openGroup()
    const names = rowNames()
    expect(names.some((n) => /chapter/i.test(n))).toBe(true)
    expect(names.some((n) => /episode|character|act|quest/i.test(n))).toBe(false)
  })

  it('groups a show by episode and character, and never by chapter', () => {
    head(SHOW)
    openGroup()
    const names = rowNames()
    expect(names.some((n) => /episode/i.test(n))).toBe(true)
    expect(names.some((n) => /character/i.test(n))).toBe(true)
    // THE ONE THAT MATTERS. A bar reading KINDS.book directly would pass every
    // case above and still put "by chapter" on a film board.
    expect(names.some((n) => /chapter/i.test(n))).toBe(false)
  })

  it('puts the ordering behind the same field, with the kind its own columns', async () => {
    head(SHOW)
    openGroup()
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Sort/ }))
    const names = rowNames()
    expect(names.some((n) => /^Time$/i.test(n))).toBe(true)
    expect(names.some((n) => /location/i.test(n))).toBe(false)
  })
})

describe('what the bar draws and what it leaves out', () => {
  it('offers the tag filter only when the board has tags', () => {
    const { unmount } = head()
    expect(screen.queryByLabelText(/tag/i)).toBeNull()
    unmount()
    head({ tags: [{ id: 1, name: 'craft' }] })
    expect(screen.getByLabelText(/tag/i)).toBeTruthy()
  })

  it('sorts the switched-on chips to the front of the scroller', () => {
    head({
      chips: [
        { label: 'noted', on: false, set: () => {} },
        { label: 'favourites', on: true, set: () => {} },
        { label: 'tagged', on: false, set: () => {} },
      ],
    })
    const labels = [...document.querySelectorAll('.board-head-chips button')].map((b) => b.textContent.trim())
    // A switched-on filter that has scrolled out of sight under the fade is a
    // board hiding rows for a reason nothing on screen still says.
    expect(labels[0]).toMatch(/favourites/i)
  })

  it('draws no chip scroller at all when a board has no chips to offer', () => {
    head()
    expect(document.querySelector('.board-head-chips')).toBeNull()
  })

  it('takes the capture verb from the caller, because a film captures a line', () => {
    const onCapture = vi.fn()
    head({ captureLabel: 'Capture line', onCapture })
    const btn = screen.getByRole('button', { name: /capture line/i })
    // THE ACCENT BELONGS TO THE ONE CONTROL THAT ADDS SOMETHING: the capture
    // button is the sticker button, and nothing else in the row is.
    expect(document.querySelectorAll('.board-head-verbs button').length).toBe(1)
    fireEvent.click(btn)
    expect(onCapture).toHaveBeenCalledTimes(1)
  })

  it('draws no view toggle — that lives in the screen’s ⋯ on every board', () => {
    head()
    expect(screen.queryByLabelText(/view/i)).toBeNull()
  })
})

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

  it('keeps the count the caller handed it', () => {
    render(
      <BoardStrip dims={BOOK.dims} sortDims={BOOK.sortDims} groupBy="none" onGroup={() => {}} sort={{ col: 'default', dir: 'asc' }} onSort={() => {}}>
        <span>12 quotes</span>
      </BoardStrip>,
    )
    expect(document.querySelector('.board-strip').textContent).toMatch(/12 quotes/)
  })
})
