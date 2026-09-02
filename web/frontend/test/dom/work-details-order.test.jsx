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
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const BOOK = {
  id: 7, title: 'The Master and Margarita', author: 'Mikhail Bulgakov',
  translator: 'Richard Pevear, Larissa Volokhonsky', editor: '',
  isbn: '', asin: '', description: 'A novel of Moscow, the devil, and a manuscript.',
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

// The pencils, in document order, named by the field they open.
const rowOrder = () =>
  [...document.querySelectorAll('.inline-field .field-icon-btn[aria-label^="Edit "]')]
    .map((b) => b.getAttribute('aria-label').replace(/^Edit /, ''))

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

  // WALKING BACK IS A REMOUNT. The stack renders only its top entry, so opening
  // a sheet destroys the form under it and closing the sheet builds a new one
  // from the SAME frozen prop — the record as it stood when Details was opened.
  // Without the read-back on mount, a description saved in its own sheet would
  // be on the server and absent from the row that opened it.
  it('shows a sheet\'s save on the row underneath after walking back', async () => {
    panel()
    await shown()
    fireEvent.click(screen.getByRole('button', { name: /^Edit description$/i }))
    const box = await waitFor(() => {
      const el = document.querySelector('.tp-panel textarea')
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.change(box, { target: { value: 'Rewritten in its own sheet.' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS.length).toBe(1))
    // Back on the form…
    await shown()
    expect(await screen.findByText('Rewritten in its own sheet.')).toBeTruthy()
  })

  it('and a sheet writes from its own read too', async () => {
    panel()
    await shown()
    fireEvent.click(screen.getByRole('button', { name: /^Edit title$/i }))
    fireEvent.change(screen.getByLabelText(/^Title$/i), { target: { value: 'A New Title' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save title$/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: /^Edit description$/i }))
    const box = await waitFor(() => {
      const el = document.querySelector('.tp-panel textarea')
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.change(box, { target: { value: 'Rewritten.' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS.length).toBe(2))
    // The sheet unmounted the form under it; its full state still has to be the
    // record as it now stands.
    expect(PUTS[1].body.title).toBe('A New Title')
    expect(PUTS[1].body.description).toBe('Rewritten.')
  })
})

describe('the Details form', () => {
  it('lists its fields in relevance order, not editor order', async () => {
    panel()
    await shown()
    const order = rowOrder()
    const at = (name) => order.indexOf(name)
    // Identity, then who made it, then what it is about, then the edition's
    // facts, then the catalogue numbers.
    expect(at('title')).toBe(0)
    expect(at('subtitle')).toBe(1)
    expect(at('people')).toBe(2)
    expect(at('description')).toBe(3)
    expect(at('genres')).toBe(4)
    // The two that were buried are now above the numbers that buried them.
    expect(at('people')).toBeLessThan(at('isbn'))
    expect(at('description')).toBeLessThan(at('asin'))
    expect(at('year')).toBeLessThan(at('publisher'))
    expect(at('publisher')).toBeLessThan(at('pages'))
    expect(at('pages')).toBeLessThan(at('isbn'))
  })

  it('prints the people behind the door rather than a count of them', async () => {
    panel()
    await shown()
    // THE NAMES. "3 people" is a number you have to open the panel to
    // understand; the cast is a count because twenty names at rest would be the
    // panel drawn twice.
    const row = [...document.querySelectorAll('.inline-field')]
      .find((el) => el.querySelector('[aria-label="Edit people"]'))
    expect(row.textContent).toContain('Mikhail Bulgakov')
    expect(row.textContent).toContain('Richard Pevear')
    expect(row.textContent).toContain('Larissa Volokhonsky')
    expect(row.textContent).toContain('1 character')
  })

  it('keeps the cast out of the form and behind that door', async () => {
    panel()
    await shown()
    // Not on the form…
    expect(screen.queryByText('Woland')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Edit people$/i }))
    // …and there when the door is opened, with the credits beside it.
    expect(await screen.findByText('Woland')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Edit author$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Edit translator$/i })).toBeTruthy()
  })

  it('opens description on its own surface and saves it there', async () => {
    panel()
    await shown()
    // At rest the row prints the description itself — the door says what is
    // behind it.
    const row = [...document.querySelectorAll('.inline-field')]
      .find((el) => el.querySelector('[aria-label="Edit description"]'))
    expect(row.textContent).toContain('A novel of Moscow')
    // A ROW WOULD HAVE OPENED AN EDITOR IN PLACE. This opens a panel: the field
    // list is gone from the screen while the sheet is up.
    fireEvent.click(screen.getByRole('button', { name: /^Edit description$/i }))
    // The panel is named after the field too, so the box is asked for by tag.
    const box = await waitFor(() => {
      const el = document.querySelector('.tp-panel textarea')
      expect(el).toBeTruthy()
      return el
    })
    expect(screen.queryByRole('button', { name: /^Edit title$/i })).toBeNull()
    // Twelve rows, not four: a blurb is read while it is being corrected.
    expect(Number(box.getAttribute('rows'))).toBeGreaterThanOrEqual(10)

    fireEvent.change(box, { target: { value: 'Rewritten.' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.description).toBe('Rewritten.')
    // Full-state, like every other write here.
    expect(PUTS[0].body.title).toBe(BOOK.title)
    expect(PUTS[0].body.pages).toBe(503)
  })

  it('opens genres on their own surface, with the token editor', async () => {
    panel()
    await shown()
    const row = [...document.querySelectorAll('.inline-field')]
      .find((el) => el.querySelector('[aria-label="Edit genres"]'))
    expect(row.textContent).toContain('Satire · Magical realism')
    fireEvent.click(screen.getByRole('button', { name: /^Edit genres$/i }))
    expect(await waitFor(() => {
      const el = document.querySelector('.tp-panel .token-input, .tp-panel input')
      expect(el).toBeTruthy()
      return el
    })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Edit title$/i })).toBeNull()
  })
})
