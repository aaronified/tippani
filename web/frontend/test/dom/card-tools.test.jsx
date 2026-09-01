// In-card actions — fix the typo, re-tag it, ♥ it, without leaving the card.
//
// THE ONE RULE WORTH A TEST FILE is when the panel is reachable. An edit form
// carries the quote, the title and the credit; on a "source" card that IS the
// answer, and on a cloze card it is the masked words in full. A pencil beside an
// unanswered question is a way to read the answer without answering, and nothing
// else in the app would notice.
//
// The other two are about the fold back, and both were flagged by the
// specification pass as bugs living between features rather than inside one: an
// edit must not un-mask a cloze card, and must not write into the options.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let ROW

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path.startsWith('/annotations?id=')) return { ok: true, data: { annotations: [ROW] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: { ok: true, result: 'got', stability: 7, status: 'remembered' } }
  }),
}))

const { QuizRunner } = await import('../../src/review.jsx')

const CLOZE_BLANK = '￼'

const mcq = (over = {}) => ({
  kind: 'book', id: 7, direction: 'source', quote: 'the only way out is through',
  title: 'Persuasion', author: 'Austen', color: 'yellow',
  options: ['Persuasion', 'Emma', 'Villette'], answer: 0, ...over,
})

// A cloze card's `quote` is the SERVER'S MASK. The raw words never travelled.
const cloze = (over = {}) => ({
  kind: 'book', id: 8, direction: 'cloze', color: 'blue',
  quote: `it is a truth ${CLOZE_BLANK} acknowledged`,
  title: 'Pride and Prejudice', author: 'Austen', options: [], answer: 0, ...over,
})

const openTools = () => fireEvent.click(screen.getByText('fix or tag this'))
const puts = () => SENT.filter((s) => s.method === 'PUT')

beforeEach(() => {
  SENT = []
  ROW = {
    id: 7,
    quote: 'the only way out is through',
    note: 'ch. 4',
    color: 'yellow',
    favorite: false,
    tags: ['grief'],
    board_id: 3,
    sticker_id: 11,
    sticker_x: 0.5,
    sticker_y: 0.25,
    chapter: '4',
    location: '88',
  }
})

describe('the panel is unreachable until the card is answered', () => {
  // One test over both card shapes rather than two: the render and the assertion
  // are identical per row and only the fixture differs, so the aggregate names
  // EVERY shape that leaked the panel instead of dying on the first. cleanup()
  // runs per row because RTL only unmounts between tests, not between iterations.
  it('is not offered beside an unanswered card, of either shape', () => {
    const CARDS = [
      ['multiple choice', mcq()],
      // The one that matters most: a cloze card's answer is the words themselves.
      ['cloze', cloze()],
    ]
    const offered = []
    const blank = []
    for (const [name, card] of CARDS) {
      cleanup()
      render(<QuizRunner mode="daily" cards={[card]} />)
      // THE CARD IS ON SCREEN FIRST. Everything asserted here is an absence, and
      // an absence is also what a runner that failed to mount leaves behind — so
      // a blank screen would report the cleanest possible pass.
      // Both shapes print the quote, which is the one thing every card has.
      if (screen.queryByText(/the only way out|it is a truth/) === null) blank.push(name)
      if (screen.queryByText('fix or tag this') !== null) offered.push(name)
    }
    expect(blank, 'the card did not render at all').toEqual([])
    expect(offered).toEqual([])
  })

  // WITH THE CONFIRM STEP ON there is a real interval between choosing and
  // committing, and it is the window this gate has to survive: an edit form
  // opened while the answer can still be changed would show which option is
  // right.
  it('is not offered between choosing and submitting', async () => {
    render(<QuizRunner mode="daily" submitStep cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy()
    expect(screen.queryByText('fix or tag this')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
  })

  it('arrives once the card is graded', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
  })
})

describe('saving an edit', () => {
  it('sends the whole row back, not just the fields on screen', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
    openTools()
    await waitFor(() => expect(screen.getByLabelText('Quote')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'the only way out is thruogh' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts().length).toBe(1))

    const body = puts()[0].body
    expect(puts()[0].path).toBe('/annotations/7')
    expect(body.quote).toBe('the only way out is thruogh')
    // THE FIELDS NOBODY TOUCHED. The PUT is full-state, so anything missing here
    // is a field silently blanked by an edit to the words — the sticker and its
    // placement, the board, the locator.
    expect(body.sticker_id).toBe(11)
    expect(body.sticker_x).toBe(0.5)
    expect(body.board_id).toBe(3)
    expect(body.chapter).toBe('4')
    expect(body.location).toBe('88')
  })

  it('re-tags: the box holds the whole set, so a tag can come off', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
    openTools()
    await waitFor(() => expect(screen.getByLabelText('Tags')).toBeTruthy())
    expect(screen.getByLabelText('Tags').value).toBe('grief')

    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'grief, austen' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts().length).toBe(1))
    expect(puts()[0].body.tags).toEqual(['grief', 'austen'])
  })

  it('favourites from inside the card', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
    openTools()
    await waitFor(() => expect(screen.getByRole('button', { name: /favourite/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /favourite/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts().length).toBe(1))
    expect(puts()[0].body.favorite).toBe(true)
  })
})

describe('what folds back onto the card, and what does not', () => {
  it('shows the corrected words', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
    openTools()
    await waitFor(() => expect(screen.getByLabelText('Quote')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'the only way round is through' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('the only way round is through')).toBeTruthy())
  })

  // THE FIRST CROSS-FEATURE BUG. `card.quote` on a cloze card is the server's
  // mask; the raw words never travelled to the browser. Folding an edited quote
  // in would print the answer over the question that was just asked.
  it('leaves a cloze card masked after an edit', async () => {
    ROW = { ...ROW, id: 8, quote: 'it is a truth universally acknowledged' }
    render(<QuizRunner mode="daily" cards={[cloze()]} />)
    fireEvent.change(screen.getByPlaceholderText(/type what belongs/i), { target: { value: 'universally' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())

    openTools()
    await waitFor(() => expect(screen.getByLabelText('Quote')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'it is a truth universally acknowledged, indeed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts().length).toBe(1))

    // The blank is still a blank. The masked text is what is on the card.
    expect(screen.getAllByLabelText('blank').length).toBe(1)
    expect(screen.queryByText(/it is a truth universally acknowledged, indeed/)).toBeNull()
  })

  // THE SECOND. The options were the question. An edit to the quote has no
  // business rewriting one of them — least of all on a speaker card, whose
  // answer slot holds an actor's name.
  it('never rewrites an option', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(screen.getByText('fix or tag this')).toBeTruthy())
    openTools()
    await waitFor(() => expect(screen.getByLabelText('Quote')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'something else entirely' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(puts().length).toBe(1))

    for (const opt of ['Persuasion', 'Emma', 'Villette']) {
      expect(screen.getByText(opt)).toBeTruthy()
    }
  })
})
