// A reader takes a looked-up match onto a book they already have, and the save
// says which supplier each taken field came from.
//
// THE OWNER'S REPORT: "I have added new books and movies since then and have used
// the looked up results. They too do not show the provider glyphs or increase the
// number." Taking a match was an edit like any other, and the server recorded
// every changed field as the reader's. The server's half — credit what `sources`
// names, and only what the save changed — is
// TestTakingAMatchOnABookCreditsTheSupplierAndKeepsWhatYouTyped
// in internal/httpapi/taken_match_source_test.go; this is the app's half, which
// that test cannot see because it posts `sources` itself.
//
// DECLARED EXCEPTION: this knows POST /books/lookup's reply, PUT /books/{id} and
// the save body's `sources` field. The journey world is offline, so nothing in
// it can answer a lookup, and the credit is not on any screen until the server
// has stored it — which is the other half's test.
//
// THE MUTATION, built and run and put back: applyMerge in WorkDetails.jsx putting
// nothing in `sources` turns this red.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

let PUTS
let STORED

const CANDIDATE = {
  source: 'google', source_id: 'g1', title: 'Dune', author: 'Frank Herbert',
  published_year: 1965, isbn: '9780441013593',
  // The merge of an ISBN search: the year came from Open Library.
  sources: { published_year: 'openlibrary' },
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (path === '/books/lookup') return { ok: true, data: { candidates: [CANDIDATE] } }
    if (method === 'PUT') {
      PUTS.push(body)
      STORED = { ...STORED, ...body }
      return { ok: true, data: STORED }
    }
    if (method === 'GET' && /^\/books\/\d+$/.test(path)) return { ok: true, data: STORED }
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const BOOK = {
  id: 9, title: 'Dune', author: '', translator: '', editor: '', isbn: '9780441013593', asin: '',
  description: '', published_year: 0, published_circa: false, language: '', orig_language: '',
  subtitle: '', publisher: '', pages: 0, links: '', genres: [], series: '', series_index: 0, favorite: false,
}

beforeEach(() => {
  PUTS = []
  STORED = { ...BOOK }
  resetPanelHistory()
})

it('credits each field taken from a match to the supplier that gave it', async () => {
  render(<PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Fetch metadata' }))
  fireEvent.click(await screen.findByRole('button', { name: /^Use .*Dune/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^Take \d+ fields?$/i }))
  await waitFor(() => expect(PUTS).toHaveLength(1))
  expect(PUTS[0].author).toBe('Frank Herbert')
  expect(PUTS[0].sources, 'the save names no supplier, so the server records the reader').toMatchObject({
    author: 'google',
    published_year: 'openlibrary',
  })
})
