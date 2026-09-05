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
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

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
    // facts. The catalogue numbers are no longer among them at all — see below.
    //
    // WHO MADE IT IS NAMED ROLE BY ROLE, which is the pack's `bookRows` and the
    // correction of a real report: one row headed People reading three names told
    // the reader nothing about which of them wrote the book. A name is not a
    // credit until something says which credit it is.
    expect(at('title')).toBe(0)
    expect(at('subtitle')).toBe(1)
    expect(at('author')).toBe(2)
    expect(at('translator')).toBe(3)
    expect(at('editor')).toBe(4)
    expect(at('description')).toBe(5)
    expect(at('genres')).toBe(6)
    // The two that were buried are still above the edition's facts.
    expect(at('description')).toBeLessThan(at('publisher'))
    expect(at('year')).toBeLessThan(at('publisher'))
    expect(at('publisher')).toBeLessThan(at('pages'))
  })

  // THE IDS LEFT THE FORM, which is what these three assertions used to pin the
  // other way round — `people` above `isbn`, `description` above `asin`, `pages`
  // above `isbn`. The pack collapses a work's catalogue numbers into a strip at
  // the foot of the panel: one pill per id the record holds and one editor for
  // the lot, because an id is not a fact about the work but how one catalogue
  // happens to file it, and five of them in a row read as the record's subject.
  // "Above the numbers that buried them" is now true by their absence.
  it('keeps the catalogue numbers out of the rows', async () => {
    panel()
    await shown()
    const order = rowOrder()
    expect(order).not.toContain('isbn')
    expect(order).not.toContain('asin')
  })

  it('draws them as a strip of pills, one per id the record holds', async () => {
    panel()
    await shown()
    // ONLY THE FILLED ONES. An empty slot per catalogue tells the reader which
    // ones their book OUGHT to be in and is wrong about it — the same
    // roster-of-absences workLinks.jsx refuses. What is missing is behind Edit.
    const pills = [...document.querySelectorAll('.cs-pills .cs-pill')]
      .map((el) => el.textContent.trim())
    expect(pills).toContain('9780099470787')
    // The ASIN is unset on this record, so it has no pill.
    expect(pills.some((p) => p.startsWith('B0'))).toBe(false)
    // And the strip's own control is the editor for the lot, not a third id.
    expect(document.querySelector('.cs-pill.is-add').textContent).toMatch(/Edit/i)
  })

  it('gives an id that has a page a link, and one that has none a flat pill', async () => {
    panel()
    await shown()
    const isbn = [...document.querySelectorAll('.cs-pills .cs-pill')]
      .find((el) => el.textContent.includes('9780099470787'))
    // Google Books addresses a book by its ISBN, which is the pack's own pill.
    expect(isbn.tagName).toBe('A')
    expect(isbn.getAttribute('href')).toBe('https://books.google.com/books?vid=ISBN9780099470787')
  })

  it('writes every changed id in ONE request', async () => {
    panel()
    await shown()
    PUTS.length = 0
    fireEvent.click(document.querySelector('.cs-pill.is-add'))
    // THE TOPMOST DIALOG. The panel host is a dialog too, so `findByRole` is
    // ambiguous here — the modal this opened is the last one in the document.
    const dlg = await waitFor(() => {
      const all = [...document.querySelectorAll('[role="dialog"]')]
      const last = all[all.length - 1]
      expect(last.getAttribute('aria-modal')).toBe('true')
      return last
    })
    // The dialog offers every id this medium has, filled or not — it is the
    // place the missing ones are missing from.
    fireEvent.change(within(dlg).getByLabelText(/^asin$/i), { target: { value: 'B000FC1PWA' } })
    fireEvent.change(within(dlg).getByLabelText(/^isbn$/i), { target: { value: '9780099470794' } })
    // TWO IDS, ONE WRITE. Two rows saving themselves would have been two
    // full-state PUTs over the top of each other.
    fireEvent.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.asin).toBe('B000FC1PWA')
    expect(PUTS[0].body.isbn).toBe('9780099470794')
  })

  it('arms the dialog’s tick only once an id has actually changed', async () => {
    panel()
    await shown()
    fireEvent.click(document.querySelector('.cs-pill.is-add'))
    const dlg = await waitFor(() => {
      const all = [...document.querySelectorAll('[role="dialog"]')]
      const last = all[all.length - 1]
      expect(last.getAttribute('aria-modal')).toBe('true')
      return last
    })
    const slot = () => within(dlg).getByRole('button', { name: /save/i }).closest('.tp-tick-slot')
    expect(slot().className, 'armed with nothing typed').not.toContain('is-armed')
    // Retyping what is stored is not a change — the standing rule.
    fireEvent.change(within(dlg).getByLabelText(/^isbn$/i), { target: { value: '9780099470787' } })
    expect(slot().className, 'armed by retyping the stored value').not.toContain('is-armed')
    fireEvent.change(within(dlg).getByLabelText(/^isbn$/i), { target: { value: '9780099470794' } })
    expect(slot().className).toContain('is-armed')
    expect(within(dlg).getByText('1')).toBeTruthy()
  })

  it('prints each credit under the name of the credit it is', async () => {
    // "3 people" is a number you have to open a panel to understand, and three
    // names under one heading is barely better: the reader can see WHO but not
    // which of them did what. The pack gives each role its own row, and this is
    // the assertion that the name and its role are on the same row.
    panel()
    await shown()
    const rowFor = (field) => [...document.querySelectorAll('.inline-field')]
      .find((el) => el.querySelector(`[aria-label="Edit ${field}"]`))
    expect(rowFor('author').textContent).toContain('Mikhail Bulgakov')
    expect(rowFor('translator').textContent).toContain('Richard Pevear')
    expect(rowFor('translator').textContent).toContain('Larissa Volokhonsky')
  })

  it('draws the cast as faces on the form, and keeps the EDITABLE list behind the door', async () => {
    // THE PACK PUTS BOTH SOMEWHERE, and they are not the same thing.
    // `work-details-popup.dc.html` bills `Cast · N` and a strip of round faces
    // between the fields and the ids: a cast is recognised before it is read, and
    // a face is the only thing that tells one tile from the next when every tile
    // shares a cover. What the earlier arrangement was right to refuse is the
    // cast as TWENTY FORM ROWS — the panel drawn twice — and that is still where
    // it is not: editing a credit is behind the People door with the rest of the
    // credits.
    panel()
    await shown()
    // On the form, as a face rather than as a row.
    const tile = await waitFor(() => {
      const el = [...document.querySelectorAll('.cs-face-tile')].find((x) => x.textContent.includes('Woland'))
      expect(el, 'the cast strip draws no tile for this work’s character').toBeTruthy()
      return el
    })
    expect(tile.querySelector('.cs-face-round'), 'the tile has no face').toBeTruthy()
    expect(tile.closest('.inline-field'), 'the cast was drawn as a form field after all').toBeNull()
    // And the editing is still one press away, from the section's own head —
    // which is where the pack puts it (`head('Cast · 6', addTo('TMDB'))`) and
    // the only place it can go on a section whose whole content is a list.
    const door = [...document.querySelectorAll('.cs-section-action')]
    expect(door.length, 'the Cast head carries no way into the list').toBe(1)
    fireEvent.click(door[0])
    expect(await screen.findByText('Woland'), 'the door opened onto no cast').toBeTruthy()
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
