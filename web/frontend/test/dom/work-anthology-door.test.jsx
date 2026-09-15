// THE WORK'S DOOR, PRESSED — not just present in a list of labels.
//
// `work-card-menu.test.jsx` asserts the row exists. That is worth having and it is
// not the claim: a book cannot BE an anthology entry (`quoteOwned` accepts book,
// screen and utterance and refuses anything else), so this row has to mean
// something else, and what it means is the thing that can be wrong. It hands the
// picker a RULE — "the passages in this work" — and the owner's choice was that it
// gathers what the work has now AND offers to keep taking what is highlighted
// later. Both halves are that one string. A label test cannot see it.
//
// WHY THIS TIER AND NOT A JOURNEY. A work tile has no visible ⋯ — its menu opens on
// right-click, long-press or Shift+F10 — and the journey vocabulary is deliberately
// the words a reader has (`see`, `press`, `type`), with no gesture among them. So
// the gesture is fired here, where a test may know that much, and the assertion is
// still about what the app SENDS rather than about how it is built.
//
// WHAT THIS FILE KNOWS, DECLARED: that `api.js` carries the request function, so it
// can watch what leaves. Nothing observable could serve — the whole point is the
// shape of a request nobody can see on screen.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies') return { ok: true, data: { anthologies: [] } }
    if (method === 'POST' && path === '/anthologies') return { ok: true, data: { id: 9 } }
    return { ok: true, data: { added: 3, skipped: 0 } }
  }),
}))

const { WorkCard } = await import('../../src/works.jsx')

const BOOK = { id: 4, title: 'The Chicago Manual of Style', author: 'UCP', annotation_count: 12 }

describe("a book's own menu gathers its passages", () => {
  beforeEach(() => {
    CALLS = []
  })

  async function openTheDoor(kind = 'book', item = BOOK) {
    render(<WorkCard kind={kind} item={item} onOpen={() => {}} onChanged={() => {}} />)
    fireEvent.contextMenu(screen.getByTitle(item.title))
    fireEvent.click(screen.getByText('Add to anthology'))
    // The picker, which finds an anthology or makes one from the name typed in.
    await screen.findByLabelText('Anthology')
  }

  it('sends the work as a rule, and the passages it matches are what fill the anthology', async () => {
    await openTheDoor()
    fireEvent.change(screen.getByLabelText('Anthology'), { target: { value: 'Style notes' } })
    fireEvent.click(screen.getByLabelText('Save'))

    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && /\/fill$/.test(p))).toBe(true))

    // MADE FIRST, THEN FILLED, and it can only be that order: POST /anthologies
    // carries no rule and the fill endpoint needs an id.
    const made = CALLS.find(([m, p]) => m === 'POST' && p === '/anthologies')
    expect(made[2].title).toBe('Style notes')

    const fill = CALLS.find(([m, p]) => m === 'POST' && /\/fill$/.test(p))
    expect(fill[1]).toBe('/anthologies/9/fill')
    // THE ID AND NOT THE TITLE. Two editions and the film of the book can share a
    // name; only an id says which one was meant.
    expect(fill[2].rule).toContain('book=4')
    // AND NO SCOPE THAT THE FILL WOULD IGNORE — it runs all three kinds whatever a
    // scope says, so a rule carrying a narrower one would describe something the
    // server does not do.
    expect(fill[2].rule).toContain('scope=all')
  })

  it('does not keep taking what is highlighted later unless asked', async () => {
    await openTheDoor()
    fireEvent.change(screen.getByLabelText('Anthology'), { target: { value: 'Style notes' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && /\/fill$/.test(p))).toBe(true))
    // The default is a one-off gather: an anthology that grew because you looked at
    // it is a change that happened while you were not looking, and 0075 refused
    // that deliberately.
    expect(CALLS.find(([m, p]) => m === 'POST' && /\/fill$/.test(p))[2].auto).toBe(false)
  })

  it('keeps taking them when the reader turns it on', async () => {
    await openTheDoor()
    fireEvent.change(screen.getByLabelText('Anthology'), { target: { value: 'Style notes' } })
    fireEvent.click(screen.getByText('On'))
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && /\/fill$/.test(p))).toBe(true))
    expect(CALLS.find(([m, p]) => m === 'POST' && /\/fill$/.test(p))[2].auto).toBe(true)
  })

  it('names a film by the field a film answers to', async () => {
    await openTheDoor('movie', { id: 7, title: 'Anand', annotation_count: 3 })
    fireEvent.change(screen.getByLabelText('Anthology'), { target: { value: 'Lines' } })
    fireEvent.click(screen.getByLabelText('Save'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && /\/fill$/.test(p))).toBe(true))
    // `book=7` here would find somebody else's shelf entirely.
    expect(CALLS.find(([m, p]) => m === 'POST' && /\/fill$/.test(p))[2].rule).toContain('movie=7')
  })
})
