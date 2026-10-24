// Details in the order a reader looks things up, and four fields behind a sheet.
//
// WHAT THE OLD ORDER COST. The list was sorted by which editor a field happened
// to open — the plain rows, then the token input, then the textarea — which is
// implementation order with the reader's name on it. People and Description, the
// two things most often wanted, sat under ISBN and ASIN; the cast sat above the
// form entirely, so a film opened with twenty cast rows between its cover and its
// first field.
//
// READ OFF THE SCREEN. A spec table is easy to assert about and proves nothing
// about what renders — the order these tests check is the order of the labels in
// the document.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS
// A SERVER THAT REMEMBERS. The read-back is the whole mechanism under test, so a
// mock that always answered with the seed would hide a body that never refreshed.
let STORED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      STORED = { ...STORED, ...body }
      return { ok: true, data: STORED }
    }
    // THE PANEL READS ITS RECORD BACK ON MOUNT (useWorkRecord). A mock that did
    // not answer this would leave every case running against the seed, which is
    // the exact staleness the read was added to end.
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) {
      return { ok: true, data: STORED }
    }
    if (method === 'GET' && path.endsWith('/cast')) {
      return { ok: true, data: { cast: [{ id: 1, character: 'Woland', actor: '' }], actor_role: 'none' } }
    }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    // The language rows are comboboxes and lead with the library's own languages,
    // so a mock with no vocabulary would test the ninety-one and not the offer.
    if (path === '/search/vocabulary') return { ok: true, data: { languages: ['Bengali'] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const BOOK = {
  id: 7, title: 'The Master and Margarita', author: 'Mikhail Bulgakov',
  translator: 'Richard Pevear, Larissa Volokhonsky', editor: '',
  // AN ISBN THE STRIP CAN DRAW. It used to be empty here, which was fine while
  // every id was a row; the pills are drawn only for the ids a record HOLDS, so a
  // fixture with none of them tests the empty strip and nothing else.
  isbn: '9780099470787', asin: '', description: 'A novel of Moscow, the devil, and a manuscript.',
  published_year: 1967, published_circa: false,
  language: 'English', orig_language: 'Russian',
  subtitle: '', publisher: 'Penguin Classics', pages: 503,
  genres: ['Satire', 'Magical realism'], series: '', series_index: 0, favorite: false,
  cast: [{ id: 1, character: 'Woland', actor: '' }],
}

beforeEach(() => {
  PUTS = []
  STORED = { ...BOOK }
  resetPanelHistory()
})

const panel = () =>
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })}
    />,
  )
const shown = () => waitFor(() => expect(screen.getByRole('button', { name: /^Edit title$/i })).toBeTruthy())


// ---- the record a panel body is looking at ---------------------------------
//
// A PANEL'S PROPS ARE FROZEN WHEN IT IS PUSHED. `render: () => <WorkDetails
// item={…}/>` closes over the record as it stood at that moment and the stack
// entry is immutable, so the page re-rendering with a newer one does not reach
// it. The stack also renders only its TOP entry, so opening a sheet UNMOUNTS the
// body underneath and walking back mounts a fresh one from the same frozen prop.
// Together those two facts meant: save the title, watch the row snap back to what
// it used to say, and have every later save restate the record as it stood when
// Details was opened. The body reads the work back on mount now.
describe('what the panel is looking at', () => {
  it('shows the value it just saved rather than the one it opened with', async () => {
    panel()
    await shown()
    fireEvent.click(screen.getByRole('button', { name: /^Edit title$/i }))
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: 'A New Title' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save title$/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(await screen.findByText('A New Title')).toBeTruthy()
  })

  it('writes full state from what it read, not from what it was handed', async () => {
    panel()
    await shown()
    // Two saves in a row. The second must carry the FIRST one's result — a body
    // writing from its frozen prop would restate the old title over the new one.
    fireEvent.click(screen.getByRole('button', { name: /^Edit title$/i }))
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: 'A New Title' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save title$/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: /^Edit publisher$/i }))
    fireEvent.change(screen.getByLabelText(/^Publisher$/i), { target: { value: 'Vintage' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save publisher$/i }))
    await waitFor(() => expect(PUTS.length).toBe(2))
    expect(PUTS[1].body.title).toBe('A New Title')
    expect(PUTS[1].body.publisher).toBe('Vintage')
  })


})

