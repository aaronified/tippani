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
// DECLARED EXCEPTION: this knows POST /books/lookup's and POST /movies/lookup's
// replies, PUT /books/{id} and /movies/{id}, and the save body's `sources` field;
// it mocks src/api.js's `json` and opens WorkDetails.jsx's `workDetailsPanel`,
// as the dom tier does. The journey world is offline, so nothing in it can answer
// a lookup, and the credit is not on any screen until the server has stored it —
// which is the other half's test.
//
// THE MUTATIONS, built and run and put back: applyMerge in WorkDetails.jsx putting
// nothing in `sources` turns both red; crediting only a book's fields reddens the
// film; and naming the cover's credit after its save key (`cover_url`) reddens
// the book's cover.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

let PUTS
let STORED

const CANDIDATE = {
  source: 'google', source_id: 'g1', title: 'Dune', author: 'Frank Herbert',
  published_year: 1965, isbn: '9780441013593', cover_url: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  // The merge of an ISBN search: the year and the cover came from Open Library.
  sources: { published_year: 'openlibrary', cover: 'openlibrary' },
}

const FILM_MATCH = {
  source: 'tmdb', tmdb_id: 603, title: 'Portal 2', release_year: 2011, overview: 'A test.',
  poster_url: 'https://image.tmdb.org/t/p/w342/portal.jpg', media_type: 'movie',
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (path === '/books/lookup') return { ok: true, data: { candidates: [CANDIDATE] } }
    if (path === '/movies/lookup') return { ok: true, data: { candidates: [FILM_MATCH] } }
    if (method === 'PUT') {
      PUTS.push(body)
      STORED = { ...STORED, ...body }
      return { ok: true, data: STORED }
    }
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) return { ok: true, data: STORED }
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: [], actor_role: 'none' } }
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
    cover: 'openlibrary',
  })
})

const FILM = {
  id: 10, title: 'Portal 2', director: '', description: '', media_type: 'movie', release_year: 0,
  tmdb_id: 0, tvdb_id: 0, imdb_id: '', links: '', genres: [], series: '', favorite: false, poster_path: '',
}

it('and a film taken from a match credits each field and the poster to its supplier', async () => {
  STORED = { ...FILM }
  render(<PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'movie', item: FILM, onChanged: () => {}, onDelete: null })} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Fetch metadata' }))
  fireEvent.click(await screen.findByRole('button', { name: /^Use .*Portal 2/i }))
  fireEvent.click(await screen.findByRole('button', { name: /^Take \d+ fields?$/i }))
  await waitFor(() => expect(PUTS).toHaveLength(1))
  expect(PUTS[0].sources, 'a film taken from a match names no supplier').toMatchObject({
    description: 'tmdb',
    poster: 'tmdb',
  })
})
