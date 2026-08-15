// Board kinds and the starter offer (0037).
//
// THE GAP THIS CLOSES. 0036 seeds boards from quotes the reader already had —
// deliberately, so nobody opens the app to three empty shelves — but a reader
// with no standalone quotes gets no boards at all and, after 1.14.0, no way to
// ask for the three the rest of the app talks about. It was reported as "I still
// cannot access the seeded boards". Nothing was broken; the offer was never
// built.
//
// The tests below are about the two rules that would each fail in silence: a
// starter FILLS THE FORM rather than creating a board behind your back, and the
// kind survives a PUT that nobody typed.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let BOARDS, SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path === '/boards' && method === 'GET') return { ok: true, data: { boards: BOARDS, total: 0 } }
    return { ok: true, data: {} }
  }),
}))

const { BoardList } = await import('../../src/boards.jsx')
const { groupOptionsFor } = await import('../../src/Quotes.jsx')

const board = (id, name, over = {}) => ({
  id, name, quotes: 0, description: '', color: 'yellow', image_path: '',
  hidden: false, pos: id, kind: 'plain', languages: [], ...over,
})

beforeEach(() => {
  SENT = []
  BOARDS = []
})

const noop = () => {}
// By role, not by text: the empty state names "New board" in its own copy, so a
// text query matches the prose as well as the button.
const openNewBoard = async () => {
  fireEvent.click(screen.getByRole('button', { name: /New board/ }))
  await screen.findByText('start from')
}

describe('the starter offer', () => {
  it('names all three on the add-board form', async () => {
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    await openNewBoard()
    for (const name of ['Proverbs', 'Speeches', 'Others']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy()
    }
  })

  // It fills the form in and STOPS. Creating on the press would take the name
  // away from the reader — and a second board called Proverbs is a 409, so
  // being handed an editable field beats being handed an error.
  it('fills the form rather than creating a board', async () => {
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    await openNewBoard()
    fireEvent.click(screen.getByRole('button', { name: /^Proverbs/ }))

    const name = screen.getByDisplayValue('Proverbs')
    expect(name).toBeTruthy()
    expect(SENT.some((s) => s.method === 'POST')).toBe(false)

    // And the reader can take it somewhere else entirely before creating.
    fireEvent.change(name, { target: { value: 'Grandmother' } })
    expect(screen.getByDisplayValue('Grandmother')).toBeTruthy()
  })

  // The proverb starter is the only one that asks a second question, because it
  // is the only kind whose extra fields mean anything.
  it('asks a proverb board for its languages, and only a proverb board', async () => {
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    await openNewBoard()

    expect(screen.queryByText('languages')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Proverbs/ }))
    await screen.findByText('languages')

    fireEvent.click(screen.getByRole('button', { name: 'Bengali' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => expect(SENT.some((s) => s.method === 'POST')).toBe(true))
    const post = SENT.find((s) => s.method === 'POST')
    expect(post.body.kind).toBe('proverb')
    expect(post.body.languages).toEqual(['Bengali', 'Hindi'])
  })

  // Not a closed list: a reader's proverbs are not limited to the three
  // languages this app happens to ship starters for.
  it('takes a language it has never heard of', async () => {
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    await openNewBoard()
    fireEvent.click(screen.getByRole('button', { name: /^Proverbs/ }))
    await screen.findByText('languages')

    fireEvent.change(screen.getByPlaceholderText('Tamil, Yoruba…'), { target: { value: 'Tamil' } })
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => expect(SENT.some((s) => s.method === 'POST')).toBe(true))
    expect(SENT.find((s) => s.method === 'POST').body.languages).toEqual(['Tamil'])
  })

  // A lone text input inside a <form> submits on Enter, which here would create
  // the board on the keystroke meant to fill a field in.
  it('does not create the board when Enter adds a language', async () => {
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    await openNewBoard()
    fireEvent.click(screen.getByRole('button', { name: /^Proverbs/ }))
    await screen.findByText('languages')

    const box = screen.getByPlaceholderText('Tamil, Yoruba…')
    fireEvent.change(box, { target: { value: 'Tamil' } })
    fireEvent.keyDown(box, { key: 'Enter' })

    expect(SENT.some((s) => s.method === 'POST')).toBe(false)
    expect(screen.getByRole('button', { name: 'Tamil' })).toBeTruthy()
  })

  // Editing a board is not the moment to be offered a row of chips that would
  // silently rewrite its name and colour.
  it('is offered on a new board only', async () => {
    BOARDS = [board(1, 'Kennedy')]
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)
    fireEvent.click(screen.getByLabelText(/more/i))
    fireEvent.click(await screen.findByText('Edit'))
    await screen.findByDisplayValue('Kennedy')
    expect(screen.queryByText('start from')).toBeNull()
  })
})

describe('a board keeps what it holds', () => {
  // THE TRAP, for the fourth time: 0034's translator, 0035's category, 0036's
  // board_id, and now the kind. Hiding is the one PUT that sends every field
  // without the reader having typed any of them, so it is the one that goes
  // lossy the moment a column is added beside it.
  it('hiding a proverb board does not make it a plain one', async () => {
    BOARDS = [board(1, 'Proverbs', { kind: 'proverb', languages: ['Bengali'] })]
    render(<BoardList boards={BOARDS} total={0} reload={noop} onOpen={noop} />)

    fireEvent.click(screen.getByLabelText(/more/i))
    fireEvent.click(await screen.findByText('Hide'))

    await waitFor(() => expect(SENT.some((s) => s.method === 'PUT')).toBe(true))
    const put = SENT.find((s) => s.method === 'PUT')
    expect(put.body.hidden).toBe(true)
    expect(put.body.kind).toBe('proverb')
    expect(put.body.languages).toEqual(['Bengali'])
  })
})

describe('the per-language sections', () => {
  // Language is the field that carries a proverb. On a board of speeches it is
  // empty on every row, so the grouping would be one section called "No
  // language" holding the whole board.
  it('are offered on a proverb board and nowhere else', () => {
    const has = (b) => groupOptionsFor(b).some(([v]) => v === 'language')
    expect(has({ kind: 'proverb' })).toBe(true)
    expect(has({ kind: 'plain' })).toBe(false)
    // All quotes is not a board at all, so there is nothing to read a kind off.
    expect(has(null)).toBe(false)
  })
})
