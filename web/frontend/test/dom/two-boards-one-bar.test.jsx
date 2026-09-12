// A BOOK'S WORK SCREEN AND A FILM'S DRAW THE SAME BAR.
//
// THE REPORT THIS ANSWERS, in the owner's words: "The book work screen and the
// movie/show/game work screens look very different (the group/filter/capture
// bar)." They were: the book's was a .board-head with an arrangement field, a
// named category filter, a scroller of three chips and one accented verb; the
// film's was a bare flex row with no grouping at all, six unlabelled colour dots,
// a single hand-rolled <button> carrying its heart as a text character, a view
// toggle wearing the accent, and a ghost capture button.
//
// WHY IT IS ONE FILE RUN TWICE rather than two suites. The defect is not in
// either screen — each was coherent on its own — it is in the DIFFERENCE, and a
// difference is only visible to a test that mounts both and compares. Every case
// below runs against a book and against a film, and the last one asserts the two
// answers are equal rather than asserting either is right.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the shared bar is boardHead.jsx, the
// dimensions come from workKinds.js per kind, and the view lives in the screen's
// ⋯ (read through buildScreenActions, which is what the shell calls) rather than
// in the bar.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const ANNOTATIONS = [
  { id: 11, book_id: 1, quote: 'Call me Ishmael.', chapter: 'One', chapter_no: 1, color: 'yellow', tags: ['craft'], created_at: '2024-01-01 10:00:00' },
]
const DIALOGUES = [
  { id: 21, movie_id: 1, quote: 'Round up the usual suspects.', character: 'Renault', timestamp: '01:32', color: 'yellow', tags: ['craft'], created_at: '2024-01-01 10:00:00' },
]
const TAGS = [{ id: 1, name: 'craft' }]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ANNOTATIONS } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: DIALOGUES } }
    if (path === '/books/1') return { ok: true, data: { id: 1, title: 'Moby-Dick', author: 'Herman Melville', genres: '' } }
    if (path === '/movies/1') return { ok: true, data: { id: 1, title: 'Casablanca', media_type: 'movie' } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: TAGS } }
    return { ok: true, data: { tags: TAGS, stickers: [], people: [], items: [], annotations: [], dialogues: [], cast: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
const { default: Movies } = await import('../../src/Movies.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')

const realMatchMedia = window.matchMedia
// The breakpoint the whole shell swaps on. `matches` answers every query the same
// way, which is what the other mobile tests do.
const setViewport = (mobile) => {
  window.matchMedia = (media) => ({
    matches: mobile, media, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  })
}

afterEach(() => { cleanup(); localStorage.clear(); window.matchMedia = realMatchMedia })

// Each board, with the dimension only IT has and the one only the other has —
// the pair is what proves the field is reading the kind rather than a constant.
const BOARDS = [
  ['a book’s quotes', () => (
    <Library openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
  ), 'Call me Ishmael.', /chapter/i, /character/i],
  ['a film’s lines', () => (
    <Movies openId={1} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />
  ), 'Round up the usual suspects.', /character/i, /chapter/i],
]

const mount = async (screenOf, line) => {
  render(screenOf())
  await screen.findByText(new RegExp(line.slice(0, 14)))
  return waitFor(() => {
    const head = document.querySelector('.board-head')
    expect(head, 'the board draws no shared head at all').toBeTruthy()
    return head
  })
}

// What the bar offers, as a set of names rather than a count — a count would be
// satisfied by two bars with the same number of different controls.
const barControls = () => ({
  arrangement: !!screen.queryByLabelText(/^Group quotes by$/i),
  category: !!document.querySelector('.board-head [aria-label="Colour category"]'),
  chips: [...document.querySelectorAll('.board-head-chips [aria-pressed]')].length,
  verbs: document.querySelectorAll('.board-head-verbs button').length,
  // A view toggle in the bar is the thing the pack moved OUT of it.
  viewToggle: !!document.querySelector('.board-head .tp-toggle-thumb'),
  // Six bare dots is what the category filter replaced.
  bareSwatches: document.querySelectorAll('.board-head .color-dot-btn').length,
})

describe.each(BOARDS)('the bar above %s', (_what, screenOf, line, mine, theirs) => {
  it('is the shared .board-head, with the arrangement field and the named category', async () => {
    await mount(screenOf, line)
    const bar = barControls()
    expect(bar.arrangement, 'no grouping control').toBe(true)
    expect(bar.category, 'no named category filter').toBe(true)
    expect(bar.bareSwatches, 'the bar still offers six dots to try').toBe(0)
  })

  it('draws three chips that announce their state, and one accented verb', async () => {
    await mount(screenOf, line)
    const bar = barControls()
    // THREE, NOT ONE. The film board offered favourites alone.
    expect(bar.chips).toBe(3)
    expect(bar.verbs).toBe(1)
    expect(bar.viewToggle, 'the view is back in the bar').toBe(false)
  })

  it('offers the kind its own dimensions and nothing another kind’s', async () => {
    await mount(screenOf, line)
    fireEvent.click(screen.getByLabelText(/^Group quotes by$/i))
    const rows = screen.getAllByRole('menuitemradio').map((el) => el.textContent.trim())
    // The shared ones, which is why the control can be shared at all.
    expect(rows.some((r) => /^none$/i.test(r))).toBe(true)
    expect(rows.some((r) => /colour|category/i.test(r))).toBe(true)
    expect(rows.some((r) => /tag/i.test(r))).toBe(true)
    // And the pair that is not shared. A field reading one kind's list through a
    // module constant — which is what it did — passes the three above and fails
    // exactly here.
    expect(rows.some((r) => mine.test(r)), `no row for ${mine}`).toBe(true)
    expect(rows.some((r) => theirs.test(r)), `offers the other kind's ${theirs}`).toBe(false)
  })

  it('offers the column count in the ⋯ too, on the one view that has columns', async () => {
    await mount(screenOf, line)
    const rows = buildScreenActions().filter((r) => !r.heading)
    // Auto plus one to five. The board opens in tiles, which is the view a column
    // count is a property OF.
    const cols = rows.filter((r) => /^(Auto|[1-5] columns?)$/i.test(String(r.label)))
    expect(cols.length, 'no Columns section in the ⋯').toBe(6)
    expect(cols.filter((r) => r.checked).length, 'no column choice is marked').toBe(1)
    // AND AUTO IS A REAL ANSWER, not the absence of one. It used to write nothing
    // and leave the stylesheet's 880px prose cap in place — which meant the board
    // still stopped at two columns for every reader who never opens ⋯, and the
    // reported bug was only fixed for the ones who did. `none` lifts the cap and
    // lets the ladder read the width the page actually has.
    const board = document.querySelector('[style*="--board-measure"]')
    expect(board, 'the board takes no measure at all').toBeTruthy()
    expect(board.style.getPropertyValue('--board-measure')).toBe('none')
  })

  it('widens the board to a measure the chosen count can actually reach', async () => {
    await mount(screenOf, line)
    const three = buildScreenActions().find((r) => !r.heading && /^3 columns$/i.test(String(r.label)))
    expect(three, 'no 3-column row').toBeTruthy()
    await act(async () => { three.onClick() })
    // The stream caps every child at 880px unless the child says otherwise, and
    // 880 is under the ladder's 1200 rung — so without this the picker would be a
    // control that changes nothing.
    const widened = await waitFor(() => {
      const el = document.querySelector('[style*="--board-measure"]')
      expect(el, 'the board did not take a measure').toBeTruthy()
      return el
    })
    expect(widened.style.getPropertyValue('--board-measure')).toBe('1200px')
  })

  it('puts the view in the screen’s ⋯, where the other board’s lives', async () => {
    await mount(screenOf, line)
    const rows = buildScreenActions()
    const views = rows.filter((r) => !r.heading && /^(tiles|list|table)$/i.test(String(r.label)))
    expect(views.length, 'the ⋯ offers no view rows').toBe(3)
    expect(views.some((r) => r.checked), 'no view is marked as the one you are in').toBe(true)
  })
})

describe('and the two bars are the same bar', () => {
  it('offers the same controls on a book and on a film', async () => {
    const [, bookScreen, bookLine] = BOARDS[0]
    const [, filmScreen, filmLine] = BOARDS[1]  // eslint-disable-line no-unused-vars
    await mount(bookScreen, bookLine)
    const book = barControls()
    cleanup()
    await mount(filmScreen, filmLine)
    const film = barControls()
    // THE WHOLE POINT. Either screen alone could pass every case above while
    // still being a different screen from the other one.
    expect(film).toEqual(book)
  })
})

// THE PHONE IS WHERE THE REPORT CAME FROM, and the desk cases above cannot see
// it: jsdom answers every media query as a desk, so a strip that never rendered
// would pass every one of them. The phone's band is a different component from
// the desk's bar — the pack keeps it to a count, an arrangement trigger and a
// direction key — so it gets its own case rather than being folded into
// barControls.
describe.each(BOARDS)('the phone band above %s', (_what, screenOf, line) => {
  it('is the shared strip, with the arrangement and the direction key', async () => {
    setViewport(true)
    render(screenOf())
    await screen.findByText(new RegExp(line.slice(0, 14)))
    const strip = await waitFor(() => {
      const el = document.querySelector('.board-strip')
      expect(el, 'the phone draws no arrangement strip').toBeTruthy()
      return el
    })
    // Sorting and grouping were reachable from ONE of the two viewports on the
    // book board until the strip was written, and from NEITHER on the film's.
    expect(strip.querySelector('.board-strip-trigger'), 'no arrangement trigger').toBeTruthy()
    expect(strip.querySelector('.board-strip-dir'), 'no direction key').toBeTruthy()
    // And the desk's bar is not also drawn: two arrangements on one screen.
    expect(document.querySelector('.board-head')).toBeNull()
  })
})
