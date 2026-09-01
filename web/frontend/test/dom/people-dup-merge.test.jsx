// The duplicate card on the Metadata console: what it offers, and what it has
// stopped needing to.
//
// THE HISTORY IS THE TEST. The card used to RENAME: pick "Ursula K. Le Guin" and
// every book printing "Ursula LeGuin" was rewritten to say so. When people became
// records it started MERGING instead — the two records become one and each book
// goes on printing exactly what it printed — which meant both spellings were still
// in the list afterwards, still looked as alike as they ever did, and a card that
// only knew about names would have offered the same merge for ever. `person_id`
// was the guard that stopped it.
//
// THAT GUARD IS GONE BECAUSE THE LIST IS. This console is keyed by record now, so
// two spellings of one person are ONE row with the other spelling named under it,
// and there is nothing for a card to cluster. The "stop asking after a merge"
// behaviour is a property of the data rather than a filter — which is why it is
// still asserted here, on the shape that now produces it.
//
// AND THE RENAME FALLBACK IS GONE TOO. It existed for a spelling the server could
// not resolve to a record, which a record-keyed list cannot contain: every row IS
// a record. A rename would rewrite a name across the library where a merge folds
// two records and leaves every cover alone, so keeping a path to it here would be
// keeping a path to the more destructive of two acts, for a case that can no
// longer arise.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let ROWS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/people/records') return { ok: true, data: { people: ROWS } }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole } = await import('../../src/MetadataPage.jsx')

const rec = (over) => ({
  id: 1, name: '', sort_name: '', bio: '', image_path: '', born: '', died: '',
  links: '', source: '', source_id: '', kinds: ['author'], spellings: [], works: 0, quotes: 0, ...over,
})

// Two records, near enough for the clusterer to pair — the state a library is in
// before anybody has merged anything, and the state an import leaves behind.
const twoRecords = () => [
  rec({ id: 7, name: 'Ursula LeGuin', works: 3 }),
  rec({ id: 9, name: 'Ursula Le Guin', works: 1 }),
]

beforeEach(() => {
  CALLS = []
  ROWS = twoRecords()
})
afterEach(() => cleanup())

// The card, not the section heading above it — "Possible duplicates (1)" and
// "Possible duplicate — keep which spelling?" both match the loose word.
const card = async () => {
  const head = await screen.findByText(/keep which spelling/)
  return head.parentElement
}

const mount = async () => {
  render(<PeopleConsole onFlash={() => {}} />)
  return card()
}

// The radio for one record, found through its own label so the assertion reads
// like the choice a reader makes.
const pick = (box, name) =>
  within(box).getAllByText(name).map((el) => el.closest('label')).find(Boolean).querySelector('input')

const press = async (el) => {
  await act(async () => {
    el.click()
  })
}

describe('the duplicate card', () => {
  it('merges the two records and leaves every work printing what it printed', async () => {
    const box = await mount()
    // The record carrying more of the library is the default keep, so this asks
    // for the other one deliberately — a reader's pick has to be the one that
    // survives.
    await press(pick(box, 'Ursula Le Guin'))
    await press(screen.getByText(/Merge into/).closest('button'))

    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/merge')).toBe(true))
    const [, , body] = CALLS.find(([m, p]) => m === 'POST' && p === '/people/merge')
    expect(body).toEqual({ keep_id: 9, drop_id: 7 })
    // AND NEVER A RENAME. A rename would rewrite the spelling on three books and
    // leave nothing in the bin to press.
    expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/rename')).toBe(false)
  })

  it('keeps the record holding more of the library, unless told otherwise', async () => {
    // The default is accepted as offered most of the time, so it has to be the
    // one that loses nothing: folding the record with three books into the one
    // with one is a merge that survives either way, but the reader reading the
    // button wants to see the name they think of as theirs.
    await mount()
    expect(screen.getByText(/Merge into “Ursula LeGuin”/)).toBeTruthy()
  })

  it('says how much hangs off each, because the names cannot say it', async () => {
    const box = await mount()
    expect(within(box).getByText(/3 works/)).toBeTruthy()
    expect(within(box).getByText(/1 work\b/)).toBeTruthy()
  })

  it('has nothing to ask once the two spellings are one record', async () => {
    // What a merge leaves behind: one row, with the folded spelling named under
    // it. The card cannot re-offer a merge it has already made, because there is
    // no second row to cluster with.
    ROWS = [rec({ id: 7, name: 'Ursula LeGuin', spellings: ['Ursula Le Guin'], works: 4 })]
    render(<PeopleConsole onFlash={() => {}} />)
    await screen.findByText('Ursula LeGuin')
    // Both spellings are still readable — the merge did not touch what the books
    // print, which is the promise the confirm makes.
    expect(screen.getByText(/Ursula Le Guin/)).toBeTruthy()
    expect(screen.queryByText(/keep which spelling/)).toBeNull()
  })
})
