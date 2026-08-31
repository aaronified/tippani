// An opened board is a DETAIL page, and on a phone it has to look like one.
//
// WHAT WAS WRONG. /quotes drew its way back as a button in a <div> above the
// scaffold, with a comment saying WorkListScaffold had no back slot. On a
// desktop that is fine — a book's detail page does the same. On a phone it is an
// entire row spent on one back arrow, with the board's name, its count and its
// filters in the row beneath it, while a book's page has always put all four
// into a single bar. Two rows where a work spends one, on the device with the
// least room.
//
// The fix is the missing slot rather than a stylesheet tweak, so this asserts
// the STRUCTURE: one bar, carrying all of it, and no second way back.
//
// WHAT CHANGED SINCE. The bar the board borrowed — MobileDetailBar, a whole
// second top bar drawn inside the page — is gone. The phone's shell bar is a
// header on every screen now, and the verbs went down to the dock, so a board
// PUBLISHES its name, its description and its filters instead of drawing them.
// The guarantee is unchanged and is what these still assert: one row spent, not
// two, and exactly one way back.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useCrumbTitle, useScreenBarState } from '../../src/ui.jsx'

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

// theme.js captures matchMedia at module scope, so the viewport is set before
// the component renders rather than inside it.
const asPhone = (matches) => {
  window.matchMedia = (media) => ({
    matches, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

beforeEach(() => {
  BOARDS = [{
    id: 1, name: 'Proverbs', quotes: 2, description: 'Handed down', color: 'green',
    image_path: '', hidden: false, pos: 1, kind: 'proverb', languages: ['Bengali'],
  }]
  QUOTES = [
    { id: 11, board_id: 1, quote: 'A stitch in time saves nine', language: 'Bengali', color: 'yellow', tags: [] },
    { id: 12, board_id: 1, quote: 'Many hands make light work', language: 'Hindi', color: 'yellow', tags: [] },
  ]
})

const noop = () => {}
// On a phone the board's NAME is no longer in the page at all — it is published
// to the shell's header — so the load signal has to be something the page itself
// still draws. On a desktop the PageHeader keeps the name, and the assertion
// below relies on that difference being real.
const openBoard = async (mobile) => {
  asPhone(mobile)
  render(<QuotesPage openId={1} onOpen={noop} onClose={noop} />)
  await screen.findByText(mobile ? /A stitch in time/ : 'Proverbs')
}

describe('an opened board on a phone', () => {
  it('publishes its name, its description and its filters rather than drawing a bar', async () => {
    // Read through the same store the shell subscribes to, so this asserts what
    // the header and the dock will actually be handed — not a DOM shape that
    // could be right while the publication is empty.
    let seen = null
    const Probe = () => {
      seen = { crumb: useCrumbTitle(), bar: useScreenBarState() }
      return null
    }
    asPhone(true)
    render(<><QuotesPage openId={1} onOpen={noop} onClose={noop} /><Probe /></>)
    await screen.findByText(/A stitch in time/)

    await waitFor(() => expect(seen.crumb).toBe('Proverbs'))
    expect(seen.bar.sub).toContain('Handed down')
    // Filters is one of the two seats the screen owns; Back, Search and ＋ are
    // the dock's own and are not a screen's to declare.
    expect(seen.bar.keys.map((k) => k.id)).toContain('filter')
  })

  it('draws no in-page bar of its own, and no second way back', async () => {
    await openBoard(true)
    // The bar it used to borrow no longer exists anywhere in the app.
    expect(document.querySelector('.mobile-detail-bar')).toBeNull()
    // And the row that predated it has not come back in its place.
    expect(screen.queryByText('All boards')).toBeNull()
    // Back belongs to the dock, which the shell draws — so the page itself has
    // none. Two would be the partial-fix failure this file was written for.
    expect(document.querySelectorAll('[aria-label="Back"]').length).toBe(0)
  })
})

describe('an opened board on a desktop', () => {
  // Unchanged, and deliberately so: a work's detail page draws its own way back
  // above the header there too, with room to spare.
  it('keeps the named button above the header', async () => {
    await openBoard(false)
    await waitFor(() => expect(screen.getByText('All boards')).toBeTruthy())
    expect(document.querySelector('.mobile-detail-bar')).toBeNull()
  })
})
