// A BOOK'S OL AND GOOGLE IDS, on the owner's instruction: "ol id: add them back".
//
// THEY WERE THE TWO THE STRIP LEFT OUT, and the note in `WorkDetails.jsx` said
// why: the columns existed and nothing wrote them, so a spec here would have
// drawn a field whose save went nowhere. The server half landed with this file —
// GET /books/:id returns both, and PUT writes each from a nil-able pointer.
//
// WHAT IS SILENT WHEN WRONG, which is what these cases are for. The strip only
// draws an id the record HOLDS, so a spec whose value never arrives renders as an
// absence rather than as an error — exactly what the old state looked like. And
// `fullState` is the trap: PUT re-states the record, so a book id carried in it as
// `|| ''` clears the column on every save of any other field IF the GET does not
// return it. That pairing is the one thing worth a test, because both halves look
// fine alone.

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workDetailsPanel, fullState } from '../../src/WorkDetails.jsx'
import { PanelHarness, resetPanelHistory } from '../panel-harness.jsx'

let CALLS = []
let STORED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path === '/genres') return { ok: true, data: { genres: [] } }
    if (path === '/books/lookup') return { ok: true, data: { candidates: [] } }
    if (method === 'PUT') STORED = { ...STORED, ...(body || {}) }
    return { ok: true, data: STORED }
  }),
}))

const BOOK = {
  id: 1,
  title: 'The Master and Margarita',
  author: 'Mikhail Bulgakov',
  openlibrary_id: '/works/OL82563W',
  google_id: '',
  genres: [],
}

const puts = () => CALLS.filter(([m, p]) => m === 'PUT' && p === '/books/1')

async function open(item = BOOK) {
  const r = render(
    <PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item, onChanged: () => {}, onDelete: null })} />,
  )
  await waitFor(() => expect(document.querySelector('.tp-panel')).toBeTruthy())
  return r
}

const openIds = async (user) => {
  await user.click(document.querySelector('.cs-pill.is-add'))
  return waitFor(() => {
    const all = [...document.querySelectorAll('[role="dialog"]')]
    const last = all[all.length - 1]
    expect(last.getAttribute('aria-modal')).toBe('true')
    return last
  })
}

beforeEach(() => {
  CALLS = []
  STORED = { ...BOOK }
  resetPanelHistory()
})

describe("a book's OL and Google ids", () => {
  it('offers an editor for each, filled or not', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    expect(within(dlg).getByLabelText(/^open library id$/i)).toBeTruthy()
    expect(within(dlg).getByLabelText(/^google books id$/i)).toBeTruthy()
  })

  it('draws the held id as a link to its page', async () => {
    await open()
    // An OL key is already a path, so the pill follows it as it stands rather
    // than dropping a number into a template.
    const link = screen.getByRole('link', { name: /OL82563W/ })
    expect(link.getAttribute('href')).toBe('https://openlibrary.org/works/OL82563W')
  })

  it('takes a bare key and still lands on the work', async () => {
    await open({ ...BOOK, openlibrary_id: 'OL82563W' })
    expect(screen.getByRole('link', { name: /OL82563W/ }).getAttribute('href'))
      .toBe('https://openlibrary.org/works/OL82563W')
  })

  it('sends a typed Google volume id as the string it is', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^google books id$/i), 'ftPPDwAAQBAJ')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    expect(puts()[0][2].google_id).toBe('ftPPDwAAQBAJ')
  })

  it('carries the untouched id through a save of something else', async () => {
    const user = userEvent.setup()
    await open()
    const dlg = await openIds(user)
    await user.type(within(dlg).getByLabelText(/^google books id$/i), 'vol1')
    await user.click(within(dlg).getByRole('button', { name: /save/i }))
    await waitFor(() => expect(puts()).toHaveLength(1))
    // THE ONE THAT MATTERS. PUT is full-state, so the OL id nobody touched has to
    // ride along — and it can only do that because the GET returns it.
    expect(puts()[0][2].openlibrary_id).toBe('/works/OL82563W')
  })

  it('fullState carries both, so no save can clear one by omission', () => {
    const body = fullState('book', BOOK)
    expect(body).toHaveProperty('openlibrary_id', '/works/OL82563W')
    expect(body).toHaveProperty('google_id', '')
  })
})
