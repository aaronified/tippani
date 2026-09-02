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
  it('puts the ordering in the grouping\u2019s menu, not beside it in the header', async () => {
    board()
    const field = await screen.findByLabelText(/^Group quotes by$/i)
    // ONE FIELD, not two selects and a direction key. The header carries the
    // grouping because that is what changes what the page looks like; the
    // ordering is the row at the end of its menu.
    expect(field.getAttribute('aria-haspopup')).toBe('menu')
    expect(screen.queryByLabelText(/^Sort quotes by$/i)).toBeNull()

    openGroup()
    // The row states the current ordering without being pressed, which is the
    // whole reason it can afford to be a row rather than a control.
    const row = await screen.findByRole('menuitem', { name: /^Sort/ })
    expect(row.textContent).toMatch(/Recent/i)
    expect(row.textContent).toMatch(/Ascending/i)

    // And it swaps what the popover lists rather than opening a second one.
    fireEvent.click(row)
    expect(await screen.findByRole('menuitemradio', { name: 'Chapter' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'Descending' })).toBeTruthy()
  })

  it('sets the column and the direction in one visit to the menu', async () => {
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    openGroup()
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Sort/ }))
    // TWO QUESTIONS, ONE VISIT. A menu that shut after the column would make the
    // direction cost two more presses than the thing it belongs to.
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Length' }))
    const desc = await screen.findByRole('menuitemradio', { name: 'Descending' })
    fireEvent.click(desc)
    await waitFor(() => {
      expect(screen.getByRole('menuitemradio', { name: 'Length' }).getAttribute('aria-checked')).toBe('true')
      expect(screen.getByRole('menuitemradio', { name: 'Descending' }).getAttribute('aria-checked')).toBe('true')
    })
  })

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

  it('cuts the board into sections when a grouping is chosen', async () => {
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    expect(document.querySelectorAll('.ann-groups > section').length).toBe(0)

    await groupBy('by chapter')
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
    await groupBy('by category')
    await waitFor(() => expect(document.querySelectorAll('.ann-groups > section').length).toBe(2))
    // The table view draws the same two sections. A control that worked in one
    // view and silently did nothing in another would be worse than no control.
    //
    // THE VIEW IS IN THE SCREEN'S \u22ef NOW, which the shell draws and this test
    // does not mount — so it is pressed where it is published, which is the same
    // list the shell renders and therefore the same claim.
    screenAction(/^Table$/).onClick()
    await waitFor(() => expect(document.querySelectorAll('.ann-groups > section').length).toBe(2))
  })
})

// ── A PHONE CAN ARRANGE THE BOARD AT ALL, which it could not.
//
// The whole board-head is desktop-only and GroupSortField had exactly one call
// site inside it, so a reader on a phone could not group by chapter, change the
// sort column or flip the direction — the values sat in localStorage at whatever
// a desktop session last left them, which for a phone-only reader is permanently
// the defaults. The feature shipped and was reachable from one of two viewports.
describe('the phone’s arrangement strip', () => {
  const asPhone = () => {
    window.matchMedia = (media) => ({
      matches: true, media, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })
  }

  it('carries the arrangement and the direction, in words rather than boxes', async () => {
    asPhone()
    board()
    const trigger = await screen.findByLabelText(/^Group quotes by$/i)
    // The pack's band: "both controls lose their boxes and keep only their
    // words", so the trigger states both halves at once.
    expect(trigger.className).toContain('board-strip-trigger')
    expect(trigger.textContent.toLowerCase()).toMatch(/none/)
    expect(trigger.textContent.toLowerCase()).toMatch(/recent/)
    expect(document.querySelector('.board-strip')).toBeTruthy()
    // And no desktop head on a phone — that is what left the phone with nothing.
    expect(document.querySelector('.board-head')).toBeNull()
  })

  it('flips the direction in one tap, never in a sheet', async () => {
    asPhone()
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    const key = document.querySelector('.board-strip-dir')
    expect(key, 'no direction key on the strip').toBeTruthy()
    expect(key.getAttribute('aria-label')).toMatch(/ascending/i)
    fireEvent.click(key)
    await waitFor(() =>
      expect(document.querySelector('.board-strip-dir').getAttribute('aria-label')).toMatch(/descending/i))
    // One bit, one tap: the menu behind the trigger must not offer it a second
    // time three taps deep.
    fireEvent.click(screen.getByLabelText(/^Group quotes by$/i))
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Sort/ }))
    expect(screen.queryByRole('menuitemradio', { name: 'Descending' })).toBeNull()
  })

  it('groups the board from the phone, which is the hole this closes', async () => {
    asPhone()
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    expect(document.querySelectorAll('.ann-groups > section').length).toBe(0)
    await groupBy('by chapter')
    await waitFor(() => expect(document.querySelectorAll('.ann-groups > section').length).toBe(3))
  })

  // THE COUNT IS THIS STRIP'S NOW, and it used to be the hero's. This case read
  // "unfiltered, the strip says nothing about counts: the hero already states the
  // total" — true until the phone header stopped stating it, which is the pack's
  // own arrangement: "142 quotes" belongs in the strip and the header belongs to
  // the book. What stayed conditional is the SHAPE, so that is what this asserts.
  it('counts the board, and says how many a filter is holding back', async () => {
    asPhone()
    board()
    await screen.findByLabelText(/^Group quotes by$/i)
    const strip = () => document.querySelector('.board-strip .mono-label')
    // At rest: a plain count of what is on the board.
    await waitFor(() => expect(strip()).toBeTruthy())
    expect(strip().textContent).toMatch(/^3 quotes$/i)
    // Narrowed: how many of how many, which is the fact with nowhere else to go
    // now that the hero no longer carries either number. The chips live in the
    // phone's filter sheet, and its door is a key published to the dock — which
    // this test does not render, so the key is pressed through the store the
    // shell subscribes to.
    const key = (BAR.keys || []).find((k) => k.id === 'filter')
    expect(key, 'the board published no filter key').toBeTruthy()
    act(() => key.onClick())
    // `tagged` rather than a server facet: this file's mock answers every
    // /annotations request with the same three rows, so only a chip the BOARD
    // applies itself can actually narrow anything here. One of the three carries
    // a tag.
    fireEvent.click(await screen.findByRole('button', { name: /^tagged$/i }))
    await waitFor(() => expect(strip().textContent).toMatch(/1 of 3/i))
  })
})
