// Deleting a tag, through the whole path — the question and the request.
//
// WHY THIS FILE DID NOT EXIST BEFORE. `deleteTag` opened with the browser's own
// `confirm()`, and jsdom has none: it warns and returns undefined, so the guard
// was always taken and the DELETE below it was unreachable from a test. The
// screen has had tests; this one line of it never ran. Now that the question is
// the app's own dialog, the rest of the function is ordinary code and this is
// the first test to reach it.
//
// The reassurance is asserted with it, because the two messages are the point of
// the dialog: a tag on nothing says one thing, a tag on eleven quotes says
// another, and the wrong one on the wrong tag is exactly the mistake a
// confirmation exists to prevent.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let TAGS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path === '/tags') return { ok: true, data: { tags: TAGS } }
    if (method === 'GET' && path === '/stickers') return { ok: true, data: { stickers: [] } }
    if (method === 'DELETE' && path.startsWith('/tags/')) {
      TAGS = TAGS.filter((t) => `/tags/${t.id}` !== path)
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: TagsPage } = await import('../../src/TagsPage.jsx')

beforeEach(() => {
  CALLS = []
  TAGS = [
    { id: 1, name: 'memory', color: 'yellow', style: 'flat', annotations: 7, dialogues: 4 },
    { id: 2, name: 'unused', color: 'blue', style: 'flat', annotations: 0, dialogues: 0 },
  ]
})
afterEach(() => cleanup())

// The card's own verb, by its own text: the chip beside it already carries the
// tag's name and its count, so a page-wide query would find the wrong node.
const cardFor = async (name) => (await screen.findByText(new RegExp(`^${name} ·|^${name}$`))).closest('.hand-card')

const pressIn = async (card, label) => {
  await act(async () => {
    ;[...card.querySelectorAll('button')].find((b) => b.textContent.trim() === label).click()
  })
}

describe('deleting a tag', () => {
  it('asks before it deletes, and says how much is attached', async () => {
    render(<TagsPage />)
    const card = await cardFor('memory')
    await pressIn(card, 'delete')

    // Eleven uses across two kinds of quote — the count is the reason the reader
    // is being asked at all. Read INSIDE the dialog: the chip on the card behind
    // it says "memory · 11" too, and a page-wide match would pass with an empty
    // dialog on screen.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/11/)).toBeTruthy()
    // AND NOTHING HAS GONE YET. The dialog is a question, not a receipt.
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })

  it('deletes once the question is answered yes', async () => {
    render(<TagsPage />)
    const card = await cardFor('memory')
    await pressIn(card, 'delete')
    await act(async () => {
      screen.getByText('Confirm').closest('button').click()
    })
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/tags/1')).toBe(true))
  })

  it('deletes nothing when the question is answered no', async () => {
    render(<TagsPage />)
    const card = await cardFor('memory')
    await pressIn(card, 'delete')
    await act(async () => {
      screen.getByText('Cancel').closest('button').click()
    })
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
    expect(await cardFor('memory')).toBeTruthy()
  })

  // A TAG ON NOTHING GETS THE OTHER SENTENCE. Reassurance about eleven quotes
  // that do not exist is worse than no reassurance at all.
  it('asks the shorter question about a tag nothing uses', async () => {
    render(<TagsPage />)
    const card = await cardFor('unused')
    await pressIn(card, 'delete')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText(/11/)).toBeNull()
    // Just the question, with no clause about quotes that do not exist.
    expect(within(dialog).getByText(/Delete tag "unused"\?/)).toBeTruthy()
  })
})
