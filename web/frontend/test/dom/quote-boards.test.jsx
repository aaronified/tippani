// /quotes as a two-level screen (0036).
//
// The bug this replaces was not a layout slip, so these are not layout tests.
// 1.13.0 handed the three kinds of quote to WorkListScaffold's `leading` slot,
// which is a FILTER slot — on a phone it renders inside the Filters sheet, and it
// is gated on `hasItems`, meaning the CURRENT board is non-empty. So the boards
// were invisible on a phone, and opening an empty one removed the control that
// got you there.
//
// Both of those are asserted below as things that must NOT be true again: the
// boards are on the page at every width, and an empty board is still reachable
// and still offers the way back.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let BOARDS, QUOTES

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/boards') return { ok: true, data: { boards: BOARDS, total: QUOTES.length } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: QUOTES } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: QuotesPage } = await import('../../src/Quotes.jsx')

const board = (id, name, quotes, over = {}) => ({
  id, name, quotes, description: '', color: 'yellow', image_path: '', hidden: false, pos: id, ...over,
})

beforeEach(() => {
  BOARDS = [board(1, 'Proverbs', 2), board(2, 'Speeches', 0), board(3, 'Kennedy', 1, { hidden: true })]
  QUOTES = [
    { id: 11, board_id: 1, quote: 'A stitch in time saves nine', color: 'yellow', tags: [] },
    { id: 12, board_id: 1, quote: 'Many hands make light work', color: 'yellow', tags: [] },
    { id: 13, board_id: 3, quote: 'Ask not what your country can do', color: 'blue', tags: [] },
  ]
})

const noop = () => {}

describe('the board list', () => {
  it('draws a tile per board, with its count', async () => {
    render(<QuotesPage openId={null} onOpen={noop} onClose={noop} />)
    await screen.findByText('Proverbs')
    expect(screen.getByText('2 quotes')).toBeTruthy()
    // An EMPTY board is still on the shelf. Under the old design this was the
    // trap: an empty board had no control, so it could not be reached or left.
    expect(screen.getByText('Speeches')).toBeTruthy()
    expect(screen.getByText('0 quotes')).toBeTruthy()
  })

  // Not a board: no row, no menu, nothing to rename. It exists so a collection
  // stays browsable as a whole, which is what a two-level screen otherwise takes
  // away.
  it('pins All quotes above the boards', async () => {
    render(<QuotesPage openId={null} onOpen={noop} onClose={noop} />)
    expect(await screen.findByText('All quotes')).toBeTruthy()
    expect(screen.getByText('3 quotes')).toBeTruthy()
  })

  // Hiding is explicit and never inferred from emptiness — an empty board you
  // just made must not vanish at the moment you make it.
  it('folds hidden boards away, and shows them on request', async () => {
    render(<QuotesPage openId={null} onOpen={noop} onClose={noop} />)
    await screen.findByText('Proverbs')
    expect(screen.queryByText('Kennedy')).toBeNull()
    // Speeches is empty and NOT hidden, so it is visible: the two ideas are
    // separate, which is the whole point.
    expect(screen.getByText('Speeches')).toBeTruthy()

    // Toggle renders its options as role=tab inside a tablist.
    fireEvent.click(screen.getByRole('tab', { name: /All 3/ }))
    await waitFor(() => expect(screen.getByText('Kennedy')).toBeTruthy())
  })

  it('opens the board that was clicked', async () => {
    const onOpen = vi.fn()
    render(<QuotesPage openId={null} onOpen={onOpen} onClose={noop} />)
    fireEvent.click(await screen.findByText('Proverbs'))
    expect(onOpen).toHaveBeenCalledWith(1)
  })
})

describe('a board', () => {
  it('shows only its own quotes, and names itself', async () => {
    render(<QuotesPage openId={1} onOpen={noop} onClose={noop} creditSeparators="," />)
    await screen.findByText('A stitch in time saves nine')
    expect(screen.getByText('Many hands make light work')).toBeTruthy()
    // Filed on another board, so not here.
    expect(screen.queryByText('Ask not what your country can do')).toBeNull()
  })

  it('offers the way back to the shelves', async () => {
    const onClose = vi.fn()
    render(<QuotesPage openId={1} onOpen={noop} onClose={onClose} creditSeparators="," />)
    fireEvent.click(await screen.findByRole('button', { name: /All boards/ }))
    expect(onClose).toHaveBeenCalled()
  })

  // THE TRAP, ASSERTED. An empty board used to have no control on it at all,
  // and the choice was persisted, so a reload landed you back in the same dead
  // end. The way out must exist when there is nothing on the shelf.
  it('still offers the way back when it is empty', async () => {
    const onClose = vi.fn()
    render(<QuotesPage openId={2} onOpen={noop} onClose={onClose} creditSeparators="," />)
    const back = await screen.findByRole('button', { name: /All boards/ })
    fireEvent.click(back)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows every quote under All quotes, whatever board it is on', async () => {
    render(<QuotesPage openId="all" onOpen={noop} onClose={noop} creditSeparators="," />)
    await screen.findByText('A stitch in time saves nine')
    // Including one from a HIDDEN board: hiding a board hides the tile, not the
    // quotes, which is what makes hiding safe enough to be a one-tap action.
    expect(screen.getByText('Ask not what your country can do')).toBeTruthy()
  })
})
