// The duplicate card on the Metadata console: what it does, and what it stops
// doing once it has done it.
//
// TWO BEHAVIOURS, AND THEY ARE THE SAME ONE SEEN TWICE.
//
// The card used to RENAME: pick "Ursula K. Le Guin" and every book printing
// "Ursula LeGuin" was rewritten to say so. Since people became records it MERGES
// instead — the two records become one and each book goes on printing exactly
// what it printed. Which means the two spellings are both still in this list
// afterwards, still look as alike as they ever did, and a card that only knew
// about names would offer the same merge for ever. `person_id` is what tells it
// they are already one person.
//
// So: it must merge by RECORD, and it must then stop asking.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let ROWS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.startsWith('/people/names')) return { ok: true, data: { people: ROWS } }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole } = await import('../../src/MetadataPage.jsx')

// Two spellings of one author, near enough for the clusterer, each with its own
// record — the state a library is in before anybody has merged anything.
const twoRecords = () => [
  { name: 'Ursula LeGuin', person_id: 7, count: 3, saved: false, links: '', has_image: false },
  { name: 'Ursula Le Guin', person_id: 9, count: 1, saved: false, links: '', has_image: false },
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

// The radio for one spelling, found through its own label so the assertion reads
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
    // The longer spelling is the default keep, so this asks for the other one
    // deliberately — a reader's pick has to be the one that survives.
    await press(pick(box, 'Ursula LeGuin'))
    await press(screen.getByText(/Merge into/).closest('button'))

    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/merge')).toBe(true))
    const [, , body] = CALLS.find(([m, p]) => m === 'POST' && p === '/people/merge')
    expect(body).toEqual({ keep_id: 7, drop_id: 9 })
    // AND NOT A RENAME. A rename would rewrite the spelling on four books and
    // leave nothing in the bin to press.
    expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/rename')).toBe(false)
  })

  it('stops offering the merge once both spellings are one record', async () => {
    ROWS = [
      { name: 'Ursula LeGuin', person_id: 7, count: 3, saved: false, links: '', has_image: false },
      { name: 'Ursula Le Guin', person_id: 7, count: 1, saved: false, links: '', has_image: false },
    ]
    render(<PeopleConsole onFlash={() => {}} />)
    // Both rows still list — the merge did not touch what the books print.
    await screen.findByText('Ursula LeGuin')
    expect(screen.getByText('Ursula Le Guin')).toBeTruthy()
    expect(screen.queryByText(/keep which spelling/)).toBeNull()
  })

  it('falls back to a rename for a spelling the server could not resolve', async () => {
    // A library upgraded from before the identity model, or a row the resolver
    // could not place: there is no record to merge, so the old act is the only
    // one available and doing nothing would be worse.
    ROWS = [
      { name: 'Ursula LeGuin', person_id: 7, count: 3, saved: false, links: '', has_image: false },
      { name: 'Ursula Le Guin', count: 1, saved: false, links: '', has_image: false },
    ]
    await mount()
    await press(screen.getByText(/Merge into/).closest('button'))

    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/rename')).toBe(true))
    expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/merge')).toBe(false)
  })
})
