// READING MODE and SAVE PDF on an anthology's page.
//
// Reading mode is the anthology as a document and nothing else, over the whole app: the passages in
// the page's order with the headings between them, the field switches respected, closed by its ✕ or
// Escape. Save PDF is the browser's own print (so the text stays text), with the anthology's title as
// the document's title while the print dialog is open.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, DETAIL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies/1') return { ok: true, data: DETAIL }
    if (method === 'GET' && path === '/anthologies/1/removed') return { ok: true, data: { removed: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

const entry = (itemID, position, quote, note = '') => ({
  kind: 'book', item_id: itemID, position, note, quote, quote_note: '', color: 'yellow', favorite: false,
  source: 'Walden', credit: 'Thoreau', work_id: 1,
})

beforeEach(() => {
  CALLS = []
  DETAIL = {
    anthology: { id: 1, title: 'On woods', intro: 'Two passages.', entries: 2, group_by: '', dedication: 'For R.' },
    entries: [entry(1, 1, 'I went to the woods.', 'The opening.'), entry(2, 3, 'To live deliberately.')],
    sections: [{ id: 7, position: 2, title: 'Part two', prose: 'Where it turns.' }],
  }
})
afterEach(() => vi.restoreAllMocks())

const reader = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
  return await screen.findByRole('dialog', { name: /Reading On woods/ })
}

describe('reading mode', () => {
  it('lays the document out in order: title, front matter, introduction, passages and headings', async () => {
    open()
    const r = await reader()
    const text = r.textContent
    const at = (s) => text.indexOf(s)
    expect(at('On woods')).toBeGreaterThanOrEqual(0)
    expect([at('On woods'), at('For R.'), at('Two passages.'), at('I went to the woods.'), at('Part two'), at('To live deliberately.')])
      .toEqual([...[at('On woods'), at('For R.'), at('Two passages.'), at('I went to the woods.'), at('Part two'), at('To live deliberately.')]].sort((a, b) => a - b))
    expect(within(r).getByText('Where it turns.')).toBeTruthy()
  })

  it('shows the commentary and the attribution the page shows, and not what the anthology switched off', async () => {
    DETAIL.anthology.hide_commentary = true
    DETAIL.anthology.hide_credit = true
    open()
    const r = await reader()
    expect(within(r).queryByText('The opening.')).toBeNull()
    expect(r.textContent).not.toContain('Thoreau')
    expect(r.textContent).toContain('Walden')
  })

  it('closes with Escape and with its close button, and not before', async () => {
    open()
    await reader()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Reading/ })).toBeNull())
    await reader()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Reading/ })).toBeNull())
  })
})

describe('Save PDF', () => {
  it('prints with the anthology\'s title as the document title, then puts the old title back', async () => {
    const seen = []
    vi.spyOn(window, 'print').mockImplementation(() => seen.push(document.title))
    document.title = 'Tippani'
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Save PDF' }))
    expect(seen).toEqual(['On woods'])
    expect(document.title).toBe('Tippani')
  })

  it('leaves Print as the plain print it was', async () => {
    const seen = []
    vi.spyOn(window, 'print').mockImplementation(() => seen.push(document.title))
    document.title = 'Tippani'
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Print' }))
    expect(seen).toEqual(['Tippani'])
  })
})
