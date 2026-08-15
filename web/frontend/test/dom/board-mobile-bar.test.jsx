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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

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
const openBoard = async (mobile) => {
  asPhone(mobile)
  render(<QuotesPage openId={1} onOpen={noop} onClose={noop} />)
  await screen.findByText('Proverbs')
}

describe('an opened board on a phone', () => {
  it('carries its name, its count and its filters in ONE bar with the back arrow', async () => {
    await openBoard(true)
    const bar = document.querySelector('.mobile-detail-bar')
    expect(bar, 'the board did not draw a work-detail bar').toBeTruthy()

    // Everything the work page's bar carries, in the same bar.
    expect(bar.querySelector('[aria-label="Back"]')).toBeTruthy()
    expect(bar.textContent).toContain('Proverbs')
    expect(bar.textContent).toContain('Handed down')
    expect(bar.querySelector('[aria-label="Filters"]')).toBeTruthy()
  })

  // The scaffold draws the arrow now, so the page must not draw a second one —
  // which is exactly what a partial fix would leave behind.
  it('does not also keep the old back row', async () => {
    await openBoard(true)
    expect(screen.queryByText('All boards')).toBeNull()
    expect(document.querySelectorAll('[aria-label="Back"]').length).toBe(1)
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
