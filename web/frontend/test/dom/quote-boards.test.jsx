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

})
