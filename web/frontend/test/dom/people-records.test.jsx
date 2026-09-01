// The People section of the metadata screen, keyed by RECORD.
//
// WHAT IT WAS. It listed `/people/names`: one row per printed spelling, filtered
// to one role. That answers "which names does my library print" — the right
// question for a re-verify sweep and the wrong one for a review list. Bulgakov
// spelled four ways was four rows of a quarter each; a record no work prints was
// not in the list at all; and the character list beside it, under the same
// heading, had been record-keyed since characters got a table.
//
// So the claims here are the ones that were false before and are the point of the
// change:
//
//   ONE ROW PER RECORD, with the other spellings named under it — otherwise a
//   merged list reads as if three names went missing.
//
//   THE COUNTS ARE THE RECORD'S. Works is credits plus cast appearances and
//   quotes is the two link columns, both per record.
//
//   THE NAME OPENS THE RECORD. The credits, the roles, the aliases, the merge and
//   the split were not reachable from this screen at all; the name opened the
//   enrichment modal, which edits a bio and a portrait under a (kind, name) pair.
//
//   ALL LEADS THE CHIPS. A role is DERIVED from a credit, so a record the reader
//   made by hand — or one whose last credit was deleted — belongs to no role, and
//   defaulting to Authors hid exactly the rows a review list exists to surface.
//
//   THE FACE IS THE PORTRAIT EDITOR. It was the word "· photo", which says a
//   portrait exists and shows neither it nor a way to change it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let RECORDS
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/people/records') return { ok: true, data: { people: RECORDS } }
    // The portrait call answers with the identity it resolved and the reference
    // pages that came with it — which is what makes the link save below happen at
    // all, and therefore what the assertion is about.
    if (method === 'POST' && path === '/people/portrait') {
      return { ok: true, data: { person: null, links: { imdb: 'nm0000001' } } }
    }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole } = await import('../../src/MetadataPage.jsx')

const rec = (over) => ({
  id: 1, name: 'Mikhail Bulgakov', sort_name: '', bio: '', image_path: '', born: '', died: '',
  links: '', source: '', source_id: '', kinds: ['author'], spellings: [], works: 0, quotes: 0, ...over,
})

beforeEach(() => {
  CALLS = []
  RECORDS = [
    rec({ id: 1, name: 'Mikhail Bulgakov', kinds: ['author'], spellings: ['M. Bulgakov', 'Михаил Булгаков'], works: 12, quotes: 128, image_path: 'people/mb.jpg' }),
    rec({ id: 2, name: 'Oleg Basilashvili', kinds: ['actor'], works: 3, quotes: 41 }),
    // A RECORD IN NO ROLE AT ALL, which is the row the old default hid: nothing
    // credits it, so nothing derives a role for it.
    rec({ id: 3, name: 'Somebody Nobody Credits', kinds: [], works: 0, quotes: 0 }),
  ]
})
afterEach(() => cleanup())

const mount = async () => {
  render(<PeopleConsole onFlash={() => {}} onSearch={() => {}} />)
  await screen.findByText('Mikhail Bulgakov')
}
const row = (name) => screen.getByText(name).closest('tr')

describe('one row per record', () => {
  it('names the other spellings under the canonical one', async () => {
    await mount()
    // Without this the merged list reads as if two names went missing.
    expect(within(row('Mikhail Bulgakov')).getByText(/M\. Bulgakov/)).toBeTruthy()
    expect(within(row('Mikhail Bulgakov')).getByText(/Михаил Булгаков/)).toBeTruthy()
  })

  it('prints the record’s own works and quotes, not one spelling’s share', async () => {
    await mount()
    const r = row('Mikhail Bulgakov')
    expect(within(r).getByText('12')).toBeTruthy()
    expect(within(r).getByText('128')).toBeTruthy()
  })

  it('reads /people/records and never the spelling list', async () => {
    await mount()
    expect(CALLS.some(([m, p]) => m === 'GET' && p === '/people/records')).toBe(true)
    expect(CALLS.some(([, p]) => p.startsWith('/people/names'))).toBe(false)
  })

  it('finds a record by a spelling it is not called', async () => {
    await mount()
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Михаил' } })
    await waitFor(() => expect(screen.queryByText('Oleg Basilashvili')).toBeNull())
    expect(screen.getByText('Mikhail Bulgakov')).toBeTruthy()
  })
})

describe('the role chips', () => {
  it('start on All, so a record in no role is visible', async () => {
    await mount()
    // The row the old author-first default hid. A role is derived from a credit,
    // so a record nothing credits belongs to no chip.
    expect(screen.getByText('Somebody Nobody Credits')).toBeTruthy()
  })

  it('filter to one role when asked', async () => {
    await mount()
    act(() => screen.getByText('Actors').click())
    await waitFor(() => expect(screen.queryByText('Mikhail Bulgakov')).toBeNull())
    expect(screen.getByText('Oleg Basilashvili')).toBeTruthy()
    expect(screen.queryByText('Somebody Nobody Credits')).toBeNull()
  })
})

describe('the two doors on a row', () => {
  it('opens the record panel from the name', async () => {
    await mount()
    act(() => within(row('Mikhail Bulgakov')).getByText('Mikhail Bulgakov').click())
    // The panel is pushed onto this console's own stack, so what is asserted is
    // that the record page is on screen rather than the enrichment modal.
    expect(await screen.findByText(/across the library/i)).toBeTruthy()
  })

  it('opens the portrait editor from the face', async () => {
    await mount()
    const face = within(row('Mikhail Bulgakov')).getByLabelText(/Portrait for Mikhail Bulgakov/)
    expect(face.querySelector('img')).toBeTruthy()
    // A record with no portrait still has the control — that is the row that needs
    // it — and it says so by being empty rather than by disappearing.
    expect(within(row('Oleg Basilashvili')).getByLabelText(/Portrait for Oleg/).className).toContain('is-empty')
  })
})

describe('fetching links onto a record', () => {
  it('writes them by id, never by name', async () => {
    await mount()
    act(() => within(row('Oleg Basilashvili')).getByText(/^fetch$/).closest('button').click())
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/portrait')).toBe(true))
    // PUT /people upserts by (kind, name) and lands on the lowest id where two
    // records share one — so fetching for the second of two namesakes wrote onto
    // the first. The record endpoint cannot make that mistake.
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people/id/2')).toBe(true))
    expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people')).toBe(false)
  })
})
