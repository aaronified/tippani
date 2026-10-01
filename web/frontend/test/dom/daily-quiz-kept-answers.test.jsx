// An answer this device kept and the server has not taken is still an answer.
//
// THE OWNER'S REPORT, 1 October: "4 registered. 1 didn't. Now on page refresh,
// that will come back." The Daily quiz now keeps every answer on the device and
// sends it in the background (answerQueue.js). A refresh before the server has it
// draws the deck from a server that has not heard, so the Daily card has to leave
// the answered card out itself, count it in the tally and the streak, and move it
// in "where you stand", or the reader is asked again and the numbers go back.
//
// WHY DOM AND NOT A JOURNEY. The browser journey
// (a-quiz-answer-that-cannot-be-sent-is-kept) drives Practice, because the golden
// library has nothing due today and so no Daily card to answer. Here the server
// is a stand-in that deals a deck, and the reader answers it on the screen.
//
// DECLARED EXCEPTIONS: the network is replaced (api.js's `json`), so the server
// can deal a deck and refuse every answer; and the queue is started by name
// (`startAnswerQueue`), because App starts it on sign-in and this mounts Home
// alone. The refresh is an unmount and a fresh mount over the same storage.
//
// THE MUTATIONS, each made and run and put back:
//   - Home.jsx's deck no longer leaving kept cards out: red, "1 of 3" after the
//     refresh;
//   - the streak not counting today from a kept answer: red, "2-day streak";
//   - `withKept` not applied to "where you stand": red, 0 remembered;
//   - the waiting line's minute set to none (`KEPT_QUIET_MS = 0`): red, the line
//     shows straight after an answer;
//   - the waiting line never drawn: red, no line a minute later.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let DAILY
let ANSWER

// A plain function, not `vi.fn`: setup-dom.js restores every mock after each
// test (schedule-capacity.test.jsx says why that matters).
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/review/daily')) return { ok: true, data: DAILY }
    if (path.startsWith('/review/answer')) return ANSWER
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

const CLOZE_BLANK = '￼'
const UNREACHABLE = { ok: false, status: 0 }

const choice = (id, title) => ({
  kind: 'book', id, direction: 'source', quote: `line ${id}`, status: 'unseen',
  title, author: 'Austen', color: 'yellow',
  options: [title, 'Villette', 'Shirley'], answer: 0,
})

// Three unseen cards, a streak that ends yesterday, nothing answered today.
const deck = (items) => ({
  items,
  answered_today: 0,
  got_today: 0,
  forgot_today: 0,
  quota: 8,
  streak: 2,
  states: { remembered: 0, forgetting: 0, probably_forgotten: 0, unseen: 3, total: 3 },
})

beforeEach(() => {
  localStorage.clear()
  DAILY = deck([choice(1, 'Persuasion'), choice(2, 'Emma'), choice(3, 'Sanditon')])
  ANSWER = UNREACHABLE
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

// The page goes away and comes back; the server still has not heard.
const refresh = async () => {
  cleanup()
  forgetDailyDeck()
  await mount()
}

const text = () => document.body.textContent
const count = (word) => Number((text().match(new RegExp(`(\\d+)\\s*${word}`, 'i')) || [])[1] ?? NaN)

describe('the Daily quiz with an answer the server has not taken', () => {
  it('leaves the card out after a refresh, and counts it in the streak and where you stand', async () => {
    await mount()
    await screen.findByText('1 of 3')
    fireEvent.click(screen.getByRole('button', { name: /Persuasion/ }))
    // Moved on at once: Next is there with nothing about sending beside it.
    await screen.findByRole('button', { name: 'Next' })
    expect(text()).not.toMatch(/saving|couldn/i)

    await refresh()
    await screen.findByText('1 of 2')
    expect(screen.queryByRole('button', { name: /Persuasion/ }), 'the answered card came back').toBeNull()
    expect(text()).toMatch(/3-day streak/)
    expect(count('remembered'), 'where you stand left the kept answer out').toBe(1)
    expect(count('not yet reviewed')).toBe(2)
  })

  it('counts a kept answer in the tally once the deck is done', async () => {
    DAILY = deck([choice(1, 'Persuasion')])
    await mount()
    fireEvent.click(await screen.findByRole('button', { name: /Persuasion/ }))
    await screen.findByRole('button', { name: 'Finish' })

    await refresh()
    await screen.findByText(/all caught up/)
    expect(text()).toMatch(/1 recalled · 0 to resurface/)
  })

  // A quick send is never news; an answer still waiting a minute later is, because
  // nothing is sent while the app is closed.
  it('says how many answers are waiting only once the oldest has waited a minute', async () => {
    await mount()
    fireEvent.click(await screen.findByRole('button', { name: /Persuasion/ }))
    await screen.findByRole('button', { name: 'Next' })
    expect(text()).not.toMatch(/waiting to be sent/)

    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 61000)
    await refresh()
    await screen.findByText('1 answer waiting to be sent')
  })

  it('marks a typed answer it could not check as kept, and lets the reader move on', async () => {
    DAILY = deck([
      { kind: 'book', id: 8, direction: 'cloze', status: 'unseen', color: 'blue',
        quote: `it is a truth ${CLOZE_BLANK} acknowledged`, title: 'Pride and Prejudice', author: 'Austen', options: [], answer: 0 },
      choice(2, 'Emma'),
    ])
    await mount()
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'universally' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    await screen.findByText('kept, to be marked')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('2 of 2')).toBeTruthy())
  })
})
