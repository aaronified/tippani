// Applying a metadata match must not throw away what the match is silent about.
//
// PUT /books/:id is full-state, and this body used to be a hand-written list of
// what a candidate can IMPROVE — title, author, isbn, description, year, genres,
// series. Everything it did not mention was cleared: the translator, the editor,
// the circa flag and both languages, on a screen whose whole purpose is to make a
// record MORE complete.
//
// THE TRANSLATOR IS THE ONE THAT COULD NOT BE UNDONE. store.SetCredits deletes
// every work_person row for a role before re-inserting from the names it is
// given, and an absent translator is zero names — so the link went, and
// `credit_as` went with it. That column is how one work prints a name differently
// from the person's own record, so retyping the translator afterwards gives a
// fresh link with no per-work spelling. The deliberate one is gone.
//
// work-put-shape.test.js pins the SHAPE of the body from the source. This drives
// the real component and reads what actually goes on the wire.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let DETAIL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (method === 'GET' && path === '/books/7') return { ok: true, data: DETAIL }
    if (path === '/books/lookup') {
      return {
        ok: true,
        data: {
          candidates: [{
            title: 'Moby-Dick', author: 'Herman Melville', isbn13: '9780000000000',
            published_year: 1851, source: 'openlibrary', source_id: 'OL1M',
          }],
        },
      }
    }
    return { ok: true, data: {} }
  }),
  DEMO: false,
}))

const { BookRow } = await import('../../src/MetadataPage.jsx')

// A book whose every full-state field is filled with something recognisable, so
// a dropped one shows up as a missing key rather than as an empty string that
// might always have been empty.
const FILLED = {
  id: 7,
  title: 'Moby Dick',
  author: 'Melville',
  translator: 'Anna Tomasovna',
  editor: 'Ed Editor',
  isbn: '9781111111111',
  asin: 'B00ASIN',
  description: 'a whale',
  published_year: 1851,
  published_circa: true,
  language: 'English',
  orig_language: 'English',
  genres: ['Adventure'],
  series: 'Whales',
  series_index: 2,
  favorite: true,
}

// The console's picker does not search on open — it offers "Browse other
// matches…" first, exactly as a reader meets it — so the test presses that and
// then the match it finds.
async function pickTheMatch() {
  fireEvent.click(screen.getByText(/Browse other matches/i))
  // Two controls carry the same name — the cover and the row — because either is
  // the same act. The first is the one a reader's eye lands on.
  const use = await waitFor(() => {
    const all = screen.getAllByLabelText(/Use Moby-Dick/i)
    expect(all.length, 'the candidate never appeared').toBeGreaterThan(0)
    return all[0]
  })
  fireEvent.click(use)
}

beforeEach(() => {
  SENT = []
  DETAIL = { ...FILLED }
  cleanup()
})

function mount() {
  render(
    <BookRow
      book={{ id: 7, title: 'Moby Dick', annotation_count: 3 }}
      checked={false}
      onCheck={() => {}}
      open
      onToggleLookup={() => {}}
      onDone={() => {}}
    />,
  )
}

describe('applying a match', () => {
  it('keeps every field the candidate says nothing about', async () => {
    mount()
    await pickTheMatch()

    const put = await waitFor(() => {
      const p = SENT.find((s) => s.method === 'PUT' && s.path === '/books/7')
      expect(p, 'the match was never applied').toBeTruthy()
      return p
    })

    // The credit that could not be recovered, first.
    expect(put.body.translator, 'the translator was cleared — and credit_as with it').toBe('Anna Tomasovna')
    expect(put.body.editor).toBe('Ed Editor')
    // Storable since 0047 and never sent until this repair.
    expect(put.body.language).toBe('English')
    expect(put.body.orig_language).toBe('English')
    // "c. 1851" must not quietly become "1851".
    expect(put.body.published_circa).toBe(true)
    expect(put.body.asin).toBe('B00ASIN')
    expect(put.body.favorite).toBe(true)
  })

  it('still lets the candidate improve what it does carry', async () => {
    // The other half of the same rule: a body that kept everything and applied
    // nothing would pass the assertions above and defeat the screen.
    mount()
    await pickTheMatch()
    const put = await waitFor(() => {
      const p = SENT.find((s) => s.method === 'PUT' && s.path === '/books/7')
      expect(p).toBeTruthy()
      return p
    })
    expect(put.body.title, 'the candidate did not win where it should').toBe('Moby-Dick')
    expect(put.body.author).toBe('Herman Melville')
    expect(put.body.isbn).toBe('9780000000000')
    expect(put.body.source).toBe('openlibrary')
    expect(put.body.source_id).toBe('OL1M')
  })
})
