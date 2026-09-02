// The Library board still filters after its nine useStates became one chip list.
//
// THIS IS THE REGRESSION GUARD FOR THAT COLLAPSE, and it exists because nothing
// else was one. screens-mount.test.jsx mounts the board with every request
// refused, so the filter controls render and are never touched; every other test
// of this file imports a FUNCTION out of it. A board that had stopped narrowing
// — or that had kept narrowing while the chips it publishes went empty — would
// have been green the whole way.
//
// So this drives the actual controls and reads the actual cards, and it checks
// the two halves that must not disagree: what the board SHOWS, and what it
// HANDS OVER when Search is pressed. Those being one object is the entire point
// of the refactor, and the only way to be wrong about it is for them to differ.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useScreenBarState } from '../../src/ui.jsx'

const BOOKS = [
  { id: 1, title: 'Dispossessed', author: 'Le Guin', genres: ['Science Fiction'], series: 'Hainish', status: 'reading', favorite: 1, annotation_count: 2, tagged_count: 1, noted_count: 1 },
  { id: 2, title: 'Earthsea', author: 'Le Guin', genres: ['Fantasy'], series: 'Earthsea', status: '', favorite: 0, annotation_count: 3, tagged_count: 0, noted_count: 0 },
  { id: 3, title: 'Solaris', author: 'Lem', genres: ['Science Fiction'], series: '', status: 'completed', favorite: 0, annotation_count: 0, tagged_count: 0, noted_count: 0 },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, url) => {
    if (method === 'GET' && url === '/books') return { ok: true, status: 200, data: { books: BOOKS } }
    return { ok: false, status: 500, data: null }
  }),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, data: null })),
}))

let Library
let takeSearchSeed
beforeEach(async () => {
  Library = (await import('../../src/Library.jsx')).default
  takeSearchSeed = (await import('../../src/facets.js')).takeSearchSeed
})

// What the board hands the shell's dock. Read through a probe rather than a
// getter on the store, so the test sees exactly what a subscriber sees.
let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}
const screenBarNow = () => BAR

const board = async () => {
  render(
    <>
      <Library openId={null} onOpen={() => {}} onClose={() => {}} onOpenMovie={() => {}} creditSeparators=",;&" onAdd={() => {}} dataNonce={0} />
      <Probe />
    </>,
  )
  // The list arrives on the first settled fetch.
  await screen.findByText('Dispossessed')
}

// Titles currently on the board. Cards render the title as a link/heading; this
// reads the whole board rather than a container class so a layout change does
// not quietly make the test assert nothing.
const shown = () => BOOKS.map((b) => b.title).filter((t) => screen.queryAllByText(t).length > 0)

// The chips the board would hand the search box right now.
const seeded = () => takeSearchSeed().map((c) => `${c.field}=${c.value}`)

// The chips carry their words, so this addresses them the way a reader does.
const press = (name) => fireEvent.click(screen.getByRole('button', { name }))

// The Reset control lives ONLY in the phone's filter sheet — the desktop row
// has none — so reaching it means being on a phone and opening the sheet.
const asPhone = () => {
  window.matchMedia = (media) => ({
    matches: true, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

describe('the board narrows', () => {
  it('shows everything unfiltered', async () => {
    await board()
    expect(shown()).toEqual(['Dispossessed', 'Earthsea', 'Solaris'])
    expect(seeded()).toEqual([])
  })

  it('narrows on the favourites chip, and says so to the search box', async () => {
    await board()
    press('♥ favourites')
    expect(shown()).toEqual(['Dispossessed'])
    expect(seeded()).toEqual(['favourite=yes'])
  })

  it('un-narrows when the chip is pressed again', async () => {
    await board()
    press('♥ favourites')
    press('♥ favourites')
    expect(shown()).toEqual(['Dispossessed', 'Earthsea', 'Solaris'])
    expect(seeded()).toEqual([])
  })

  // The wishlist is derived — a book with nothing saved out of it IS the
  // wishlist — and the board's three-way control has to map onto the server's
  // two-way flag without losing the middle state.
  it('narrows to the wishlist, and to its complement', async () => {
    await board()
    press('wishlist')
    expect(shown()).toEqual(['Solaris'])
    expect(seeded()).toEqual(['wishlist=yes'])

    press('annotated')
    expect(shown()).toEqual(['Dispossessed', 'Earthsea'])
    expect(seeded()).toEqual(['wishlist=no'])
  })

  it('stacks two filters', async () => {
    await board()
    press('♥ favourites')
    press('annotated')
    expect(shown()).toEqual(['Dispossessed'])
    expect(seeded()).toEqual(['favourite=yes', 'wishlist=no'])
  })
})

describe('the board-only filters', () => {
  // These narrow the board and are NOT handed over, because the server has no
  // facet that means the same thing: a board's "tagged" is a property of the
  // BOOK (it has a tagged highlight), and `tag:` is a property of the quote.
  // Sending one as the other would empty the books section and the search would
  // come back with nothing.
  it('narrow the board but are not seeded', async () => {
    await board()
    press('tagged')
    expect(shown()).toEqual(['Dispossessed'])
    expect(seeded()).toEqual([])

    press('has notes')
    expect(shown()).toEqual(['Dispossessed'])
    expect(seeded()).toEqual([])
  })

  it('still travel alongside one that is seeded', async () => {
    await board()
    press('tagged')
    press('♥ favourites')
    expect(shown()).toEqual(['Dispossessed'])
    expect(seeded()).toEqual(['favourite=yes'])
  })
})

// The dock is the shell's, and these tests render the board alone — so the key
// is reached through the store the shell subscribes to rather than through a
// second render of the whole frame.
function openFiltersFromTheDock() {
  const key = (screenBarNow().keys || []).find((k) => k.id === 'filter')
  expect(key, 'the board published no filter key').toBeTruthy()
  act(() => key.onClick())
}

describe('reset', () => {
  // onReset used to enumerate nine setters by hand, which is a list that goes
  // stale the moment a tenth filter is added — and one that already had to
  // remember to LEAVE OUT the wishlist-folding preference. It is now emptying
  // one list, so the only way to forget a filter is to not have added it.
  it('clears every filter at once, including the board-only ones', async () => {
    asPhone()
    await board()
    // On a phone the chips live INSIDE the sheet — the desktop filter row is
    // not rendered at all — so this drives the sheet's own copies of them, which
    // is the half of "two editors of one state" the desktop tests above do not
    // reach.
    //
    // AND THE KEY THAT OPENS IT IS NO LONGER ON THE PAGE. The phone's verbs are
    // published to the dock, which the shell draws, so the board itself has no
    // Filters button to press — the test reaches the published key instead. That
    // is the honest route: it is exactly what a thumb hits.
    openFiltersFromTheDock()
    press('♥ favourites')
    press('tagged')
    press('annotated')
    expect(shown()).toEqual(['Dispossessed'])

    // The footer's reset is a bordered, worded button now rather than a 34px
    // glyph key: it is the one control on this sheet that throws work away and
    // it was the quietest thing on it.
    press('Reset filters')
    expect(shown()).toEqual(['Dispossessed', 'Earthsea', 'Solaris'])
    expect(seeded()).toEqual([])
  })
})

// ── ONE SHEET, ONE VISIT. The order used to have a sheet of its own and a dock
// key of its own, beside a Filters key opening a sheet that looked identical.
describe('the phone\u2019s two doors', () => {
  it('puts the order in the filter sheet rather than a second one', async () => {
    asPhone()
    await board()
    expect(screen.queryByLabelText(/^Sort$/i)).toBeNull()
    openFiltersFromTheDock()
    // Last section in the sheet: everything above it narrows the board and can
    // change the count the footer states, and this one only rearranges.
    const sheet = document.querySelector('.mobile-sheet, [class*="sheet"]')
    expect(sheet).toBeTruthy()
    expect(screen.getByLabelText(/^Sort$/i)).toBeTruthy()
  })

  it('gives the seat the sort vacated to the way out', async () => {
    asPhone()
    await board()
    const ids = (screenBarNow().keys || []).map((k) => k.id)
    // Two seats, and neither is a second door to the sheet the first one opens.
    //
    // THE SECOND WAS EXPORT AND IS NOW THE BOARDS KEY. Both of Export's claims to
    // it had gone: the sort moved into the filter sheet, which is what freed the
    // seat, and Export is in this screen's own ⋯ , so it was the one verb here
    // that already had somewhere else to be. What a reader on a board wants from
    // a thumb is the OTHER boards — the rail is a desktop control and the drawer
    // is at the top of the screen.
    //
    // `nav` is what the SCREEN publishes; the shell swaps it for its own boards
    // key, because only the shell knows which sections are switched on. Asserted
    // as published, since that is the contract this screen owns.
    expect(ids).toEqual(['filter', 'nav'])
  })

  it('stops repeating the page in the \u22ef', async () => {
    asPhone()
    await board()
    const { buildScreenActions } = await import('../../src/ui.jsx')
    const labels = buildScreenActions().map((r) => r.heading || r.label).join(' | ')
    // The chips and the sort select are already reachable twice — on the page at
    // desktop widths, behind the Filter key on a phone. A third door is a menu a
    // reader stops reading because most of it is a copy of what is on screen.
    expect(labels).not.toMatch(/show only/i)
    expect(labels).not.toMatch(/recently added/i)
  })
})
