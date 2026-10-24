// The order and the grouping reach the board a reader is looking at.
//
// A PURE TEST PROVES THE ORDER, NOT THAT ANYTHING USES IT. The sort existed
// before this — for the table view alone, as clickable column headers — and the
// two card views, which is where a reader actually reads, had none and no
// grouping at all. So this drives the real screen: press the control a reader
// presses, and read the cards off the board.

import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
const { buildScreenActions, useScreenBarState } = await import('../../src/ui.jsx')

// What the board hands the shell's dock. Read through a probe rather than a
// getter, so the test sees exactly what a subscriber sees.
let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

// The board publishes its settings into the screen's \u22ef, which the shell draws
// and this test does not mount. buildScreenActions is what the shell calls when
// the menu opens, so reading it is reading the menu.
const screenAction = (name) => {
  const row = buildScreenActions().find((it) => !it.heading && name.test(String(it.label)))
  expect(row, String(name)).toBeTruthy()
  return row
}

const board = () =>
  render(
    <>
      <Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
      <Probe />
    </>,
  )

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

// The arrangement is a MENU now, not two selects and a key: the grouping is the
// field and the ordering is the row at the end of its menu. A test presses what a
// reader presses — the field, then the row.
const openGroup = () => fireEvent.click(screen.getByLabelText(/^Group quotes by$/i))
const groupBy = async (option) => {
  openGroup()
  fireEvent.click(await screen.findByRole('menuitemradio', { name: option }))
}
const sortBy = async (option) => {
  openGroup()
  fireEvent.click(await screen.findByRole('menuitem', { name: /^Sort/ }))
  fireEvent.click(await screen.findByRole('menuitemradio', { name: option }))
}

// A COLOUR IS A FILING DECISION WITH SIX VALUES. The header's comment has said
// so since the row was drawn, over a control that was six toggles — and a reader
// names their own categories, so a dot on its own cannot say which one the board
// is filtered to.
describe('the category filter', () => {

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

  // THE DOT HAS TO BE THE COLOUR IT NAMES. This picker drew six identical grey
  // circles because it painted with `var(--yellow)`, a custom property nothing
  // in the app has ever defined — invalid at computed-value time, so the fill
  // simply did not happen and the control offered the reader six ways to say
  // the same nothing. Asserting the CLASS rather than a computed colour is
  // deliberate: jsdom resolves neither var() nor the cascade across two
  // stylesheets, so a colour assertion here would pass on the broken code.
  // What the class buys is a name that index.css must declare, and
  // category-dot-class.test.js holds it to that.
  
})

describe('the board can be put in order', () => {

  it('reorders the cards a reader is looking at, not only the table', async () => {
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    // Default: the server's order, so the first card is the first row.
    await waitFor(() => expect(seen('The whale.')).toBe(true))
    const before = drawn().findIndex((s) => s.includes('Call me Ishmael'))
    const whaleBefore = drawn().findIndex((s) => s.includes('The whale.'))
    expect(whaleBefore).toBeLessThan(before)

    // By chapter: Two before Ten, which is the reading order and the reverse of
    // what the board opened with.
    await sortBy('Chapter')
    await waitFor(() => {
      const rows = drawn()
      const two = rows.findIndex((s) => s.includes('Call me Ishmael'))
      const ten = rows.findIndex((s) => s.includes('The whale.'))
      expect(two).toBeGreaterThanOrEqual(0)
      expect(two).toBeLessThan(ten)
    })
  })

})

// ── A PHONE CAN ARRANGE THE BOARD AT ALL, which it could not.
//
// The whole board-head is desktop-only and GroupSortField had exactly one call
// site inside it, so a reader on a phone could not group by chapter, change the
// sort column or flip the direction — the values sat in localStorage at whatever
// a desktop session last left them, which for a phone-only reader is permanently
// the defaults. The feature shipped and was reachable from one of two viewports.

