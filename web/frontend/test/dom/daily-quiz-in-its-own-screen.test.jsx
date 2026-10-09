// The Daily quiz is a launcher on Home, and the round runs in a screen of its own.
//
// THE OWNER, 9 October: "the review / quiz should happen in a popup (a dedicated
// screen in phone) so that the user doesnt need to scroll up and down too much."
// So Home's card says how many are due and opens the round; what is held here is
// what a reader does with that: open it, answer, close it part-way, come back to
// the card they had reached, and close it on the last answer and be done.
// Whether the screen fills a phone is layout, and the journey
// a-round-takes-the-phone-screen holds that.
//
// DECLARED EXCEPTION: the network is replaced (api.js's `json`) so the server can
// deal a deck; it knows /review/daily and the deck's fields, as
// daily-quiz-kept-answers.test.jsx does, and that file says why the queue is
// started by name.
//
// THE MUTATIONS, each made and run and put back:
//   - the round reopened at its first card (`startIndex={0}`): red, "1 of 3"
//     after Continue;
//   - an answer not counted toward where the round reopens (`setGiven` removed
//     from onAnswered): red, the answered card asked again;
//   - a round closed on its last answer left open (`close` no longer setting
//     done): red, no "all caught up";
//   - the round drawn on Home again rather than in its own screen (the
//     FormModal unwrapped): red, an option on Home before Start.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

let DAILY

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/review/daily')) return { ok: true, data: DAILY }
    if (path.startsWith('/review/answer')) return { ok: true, data: {} }
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
    if (path.startsWith('/movies')) return { ok: true, data: { movies: [] } }
    if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
    return { ok: true, data: {} }
  },
}))

const { default: Home } = await import('../../src/Home.jsx')
const { forgetDailyDeck } = await import('../../src/daily.js')
const { startAnswerQueue, stopAnswerQueue } = await import('../../src/answerQueue.js')

const choice = (id, title) => ({
  kind: 'book', id, direction: 'source', quote: `line ${id}`, status: 'unseen',
  title, author: 'Austen', color: 'yellow',
  options: [title, 'Villette', 'Shirley'], answer: 0,
})

const deck = (items) => ({
  items, answered_today: 0, got_today: 0, forgot_today: 0, quota: 8, streak: 0,
  states: { remembered: 0, forgetting: 0, probably_forgotten: 0, unseen: items.length, total: items.length },
})

beforeEach(() => {
  localStorage.clear()
  DAILY = deck([choice(1, 'Persuasion'), choice(2, 'Emma'), choice(3, 'Sanditon')])
  forgetDailyDeck()
  startAnswerQueue(7)
})
afterEach(() => {
  stopAnswerQueue()
  cleanup()
  localStorage.clear()
})

const mount = async () => {
  render(
    <Home
      user={{ id: 7, username: 'alice', preferences: {} }}
      stats={{}}
      onOpenBook={() => {}}
      onOpenMovie={() => {}}
      onGoLibrary={() => {}}
      onGoMovies={() => {}}
      onGoQuotes={() => {}}
      onPending={() => {}}
      onReviewImport={() => {}}
    />,
  )
  await act(async () => {})
}

const round = () => screen.getByRole('dialog', { name: 'Daily quiz' })
const closeRound = () => fireEvent.click(within(round()).getByRole('button', { name: 'Close' }))

describe('the Daily quiz in its own screen', () => {
  it('waits on Home, saying how many are due, until it is opened', async () => {
    await mount()
    await screen.findByText('3 cards due today')
    expect(screen.queryByRole('button', { name: /Persuasion/ }), 'the round is on Home before Start').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(within(round()).getByText('1 of 3')).toBeTruthy()
  })

  it('reopens past a card answered before it was closed, and never asks it twice', async () => {
    await mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(within(round()).getByRole('button', { name: /Persuasion/ }))
    await within(round()).findByRole('button', { name: 'Next' })
    closeRound()

    expect(screen.queryByRole('dialog')).toBeNull()
    await screen.findByText('2 cards due today')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(within(round()).getByText('2 of 3')).toBeTruthy()
    expect(within(round()).queryByRole('button', { name: /Persuasion/ })).toBeNull()
  })

  it('is done when closed on its last answer, before Finish', async () => {
    DAILY = deck([choice(1, 'Persuasion')])
    await mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(within(round()).getByRole('button', { name: /Persuasion/ }))
    await within(round()).findByRole('button', { name: 'Finish' })
    closeRound()
    await screen.findByText(/all caught up/)
    expect(screen.queryByRole('button', { name: /^(Start|Continue)$/ })).toBeNull()
  })
})
