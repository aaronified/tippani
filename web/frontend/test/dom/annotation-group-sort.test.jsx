// The order and the grouping reach the board a reader is looking at.
//
// A PURE TEST PROVES THE ORDER, NOT THAT ANYTHING USES IT. The sort existed
// before this — for the table view alone, as clickable column headers — and the
// two card views, which is where a reader actually reads, had none and no
// grouping at all. So this drives the real screen: press the control a reader
// presses, and read the cards off the board.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const ROWS = [
  { id: 1, book_id: 1, quote: 'The whale.', chapter: 'Ten', chapter_no: 10, color: 'blue', tags: ['craft'], created_at: '2024-03-01 10:00:00' },
  { id: 2, book_id: 1, quote: 'Call me Ishmael.', chapter: 'Two', chapter_no: 2, color: 'yellow', tags: [], created_at: '2024-01-01 10:00:00' },
  { id: 3, book_id: 1, quote: 'A way I have of driving off the spleen.', color: 'yellow', tags: [], created_at: '2024-02-01 10:00:00' },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ROWS } }
    if (path === '/books/1') {
      return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')

const board = () =>
  render(<Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />)

// The quotes on the board, in the order they are drawn. Read off the cards
// rather than off any state: the order a reader sees is the claim.
const drawn = () =>
  [...document.querySelectorAll('.quote-text, blockquote, .hand-card')]
    .map((el) => el.textContent)
    .filter(Boolean)

const seen = (text) => drawn().some((s) => s.includes(text))

// The app's Select is a listbox rather than a native <select> — a trigger that
// says what is set and a portalled panel of options — so a test picks the way a
// reader does: open it, then press the row.
const pick = async (label, option) => {
  fireEvent.click(screen.getByLabelText(new RegExp(`^${label}$`, 'i')))
  const opt = await screen.findByRole('option', { name: option })
  fireEvent.click(opt)
}

// A COLOUR IS A FILING DECISION WITH SIX VALUES. The header's comment has said
// so since the row was drawn, over a control that was six toggles — and a reader
// names their own categories, so a dot on its own cannot say which one the board
// is filtered to.
describe('the category filter', () => {
  it('names the category rather than showing six dots to try', async () => {
    board()
    // Scoped to the board's own header: the row editor in the table view carries
    // the same label, and a bare query would find whichever came first.
    const trigger = await waitFor(() => {
      const el = document.querySelector('.board-head-left [aria-label="Colour category"]')
      expect(el).toBeTruthy()
      return el
    })
    expect(trigger.textContent).toMatch(/Any category/i)
    // Six switches would be six buttons; this is one.
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
  })

  it('filters the board to the category that was picked', async () => {
    board()
    const trigger = await waitFor(() => {
      const el = document.querySelector('.board-head-left [aria-label="Colour category"]')
      expect(el).toBeTruthy()
      return el
    })
    await waitFor(() => expect(seen('Call me Ishmael')).toBe(true))
    fireEvent.click(trigger)
    // The blue one, whatever the reader has named it.
    const opts = await screen.findAllByRole('option')
    expect(opts.length).toBeGreaterThan(1)
    // Every option carries its dot beside its name.
    expect(opts[1].querySelector('.cat-opt-dot')).toBeTruthy()
  })
})

describe('the board can be put in order', () => {
  it('offers a sort and a grouping beside the view, where a setting belongs', async () => {
    board()
    expect(await screen.findByLabelText(/^Sort quotes by$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Group quotes by$/i)).toBeTruthy()
    // And the direction is its own key rather than a two-value select.
    expect(screen.getByRole('button', { name: /Ascending/i })).toBeTruthy()
  })

  it('reorders the cards a reader is looking at, not only the table', async () => {
    board()
    await screen.findByLabelText(/^Sort quotes by$/i)
    // Default: the server's order, so the first card is the first row.
    await waitFor(() => expect(seen('The whale.')).toBe(true))
    const before = drawn().findIndex((s) => s.includes('Call me Ishmael'))
    const whaleBefore = drawn().findIndex((s) => s.includes('The whale.'))
    expect(whaleBefore).toBeLessThan(before)

    // By chapter: Two before Ten, which is the reading order and the reverse of
    // what the board opened with.
    await pick('Sort quotes by', 'Chapter')
    await waitFor(() => {
      const rows = drawn()
      const two = rows.findIndex((s) => s.includes('Call me Ishmael'))
      const ten = rows.findIndex((s) => s.includes('The whale.'))
      expect(two).toBeGreaterThanOrEqual(0)
      expect(two).toBeLessThan(ten)
    })
  })

  it('cuts the board into sections when a grouping is chosen', async () => {
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    expect(document.querySelectorAll('.ann-groups > section').length).toBe(0)

    await pick('Group quotes by', 'by chapter')
    await waitFor(() => {
      // Three buckets: Two, Ten, and the one quote with no chapter.
      expect(document.querySelectorAll('.ann-groups > section').length).toBe(3)
    })
    // The headings are the shelf's headings — a reader who has grouped a library
    // by author and a book by chapter has met one control, not two.
    expect(screen.getByText('Two')).toBeTruthy()
    expect(screen.getByText('Ten')).toBeTruthy()
    expect(screen.getByText('No chapter')).toBeTruthy()
    // And every quote is still on the board, in one section or another.
    for (const q of ['Call me Ishmael', 'The whale.', 'driving off the spleen']) {
      expect(seen(q), q).toBe(true)
    }
  })

  it('keeps grouping when the view changes, because it is not a view', async () => {
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    await pick('Group quotes by', 'by category')
    await waitFor(() => expect(document.querySelectorAll('.ann-groups > section').length).toBe(2))
    // The table view draws the same two sections. A control that worked in one
    // view and silently did nothing in another would be worse than no control.
    // The view toggle's options are tabs, which is what a Toggle draws.
    fireEvent.click(screen.getByRole('tab', { name: /table/i }))
    await waitFor(() => expect(document.querySelectorAll('.ann-groups > section').length).toBe(2))
  })
})
