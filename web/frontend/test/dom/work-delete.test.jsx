// DELETING A WORK FROM ITS OWN PAGE — the one destructive act on either work
// screen, and until now the only one with no test at all.
//
// WHY THIS FILE EXISTS, and it is not a good reason. Folding the two work pages
// into one WorkDetail imported `deleteWithUndo` from the wrong module. Every DOM
// test stayed green — 2,541 of them — because not one drives this path, so the
// symptom would have been a reader pressing Delete on a book, typing the phrase
// out, and getting a TypeError instead of a deletion. The production build
// caught it, which is luck about which tool runs first rather than coverage.
//
// So this asserts the whole act, both sides, end to end: the row in the ⋯ menu,
// the typed guard that will not let a mis-click through, the endpoint the DELETE
// actually goes to, and the screen closing afterwards. The endpoint is the half
// worth naming twice — a book and a film are one component now, and `workPath`
// is the only thing keeping their two tables apart.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const CALLS = []
let BOOK
let FILM
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (path === '/books/1') return { ok: true, data: BOOK }
    if (path === '/movies/7') return { ok: true, data: FILM }
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
    return { ok: true, data: { tags: [], stickers: [], people: [], books: [], movies: [], annotations: [], dialogues: [] } }
  }),
  del: vi.fn(async (path) => {
    CALLS.push(['DELETE', path])
    return { ok: true, status: 200, data: {} }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
const { default: Movies } = await import('../../src/Movies.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')

beforeEach(() => {
  CALLS.length = 0
  BOOK = { id: 1, title: 'The Dispossessed', author: 'Le Guin', status: '' }
  FILM = { id: 7, title: 'Stalker', director: 'Tarkovsky', media_type: 'movie', status: '' }
})

// The verbs are published to the shell, which these tests do not render, so the
// menu is reached through the store the shell subscribes to — the honest route,
// because it is exactly what the ⋯ draws.
const pressDelete = () => {
  const row = buildScreenActions().find((r) => r.id === 'delete')
  expect(row, 'the work page published no delete row').toBeTruthy()
  act(() => row.onClick())
}

const type = (phrase) => {
  const box = screen.getByLabelText(/type/i)
  fireEvent.change(box, { target: { value: phrase } })
}

const confirmBtn = () => screen.getByRole('button', { name: /delete it/i })

describe('deleting a book from its own page', () => {
  let closed
  const page = () => {
    closed = 0
    render(<Library openId={1} onOpen={() => {}} onClose={() => { closed += 1 }} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />)
    return screen.findByText('The Dispossessed')
  }

  it('will not go through until the phrase is typed', async () => {
    await page()
    pressDelete()
    await screen.findByLabelText(/type/i)
    // A guard that can be clicked past is not a guard. The button is there and
    // refuses, rather than the dialog closing on a mis-click.
    expect(confirmBtn().disabled).toBe(true)
    fireEvent.click(confirmBtn())
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })

  it('deletes at the books endpoint and closes the screen', async () => {
    await page()
    pressDelete()
    await screen.findByLabelText(/type/i)
    type('delete 1 book')
    expect(confirmBtn().disabled).toBe(false)
    fireEvent.click(confirmBtn())
    await waitFor(() => expect(CALLS.some(([m]) => m === 'DELETE')).toBe(true))
    // The TABLE, not just the verb. One component serves both sides and this is
    // the only thing telling them apart.
    expect(CALLS.find(([m]) => m === 'DELETE')[1]).toBe('/books/1')
    // The work is gone, so this view has nothing left to show.
    await waitFor(() => expect(closed).toBe(1))
  })
})

describe('deleting a film from its own page', () => {
  let closed
  const page = () => {
    closed = 0
    render(<Movies openId={7} onOpen={() => {}} onClose={() => { closed += 1 }} creditSeparators=",;&" onAdd={() => {}} onSearch={() => {}} dataNonce={0} />)
    return screen.findByText('Stalker')
  }

  it('deletes at the movies endpoint and closes the screen', async () => {
    await page()
    pressDelete()
    await screen.findByLabelText(/type/i)
    // A film's phrase is its own noun — "delete 1 title", not "delete 1 book" —
    // so a reader who has both open cannot confirm the wrong one by muscle
    // memory. Typing the BOOK's phrase here must not satisfy it.
    type('delete 1 book')
    expect(confirmBtn().disabled).toBe(true)
    type('delete 1 title')
    fireEvent.click(confirmBtn())
    await waitFor(() => expect(CALLS.some(([m]) => m === 'DELETE')).toBe(true))
    expect(CALLS.find(([m]) => m === 'DELETE')[1]).toBe('/movies/7')
    await waitFor(() => expect(closed).toBe(1))
  })
})
