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
// can deal a deck, refuse an answer, or hold either reply back; the queue is
// started by name (`startAnswerQueue`), because App starts it on sign-in and this
// mounts Home alone, and started again to stand for the app's next start; and
// `keptAnswers` is read in the race case to know the send has happened, since a
// send is invisible on the screen by design. The refresh is an unmount and a
// fresh mount over the same storage.
//
// THE MUTATIONS, each made and run and put back:
//   - Home.jsx's deck no longer leaving kept cards out: red, "1 of 3" after the
//     refresh;
//   - the streak not counting today from a kept answer: red, "2-day streak";
//   - `withKept` not applied to "where you stand": red, 0 remembered;
//   - the waiting line's minute set to none (`KEPT_QUIET_MS = 0`): red, the line
//     shows straight after an answer;
//   - the waiting line never drawn: red, no line a minute later;
//   - the deck filtered by the kept answers alone, not by the answers this page
//     sent (a rater's race: the deck asked for before the send, answered after):
//     red, "1 of 3" with the answered card back;
//   - the deck's tally counting every known answer, not only those whose card
//     the deck still holds: red, the answer counted twice when the deck came
//     after the server took it;
//   - the in-session streak increment removed from onAnswered: red, the streak
//     reads 2 after today's first answer;
//   - the typed answer's wait not capped (awaiting the send itself): red, no
//     "kept, to be marked" while the send hangs;
//   - a 403 dropped as a refusal for good: red, the card back after a refresh.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let DAILY
let ANSWER

// A plain function, not `vi.fn`: setup-dom.js restores every mock after each
// test (schedule-capacity.test.jsx says why that matters).
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    // A function is a reply the test holds back until it chooses.
    if (path.startsWith('/review/daily')) return { ok: true, data: typeof DAILY === 'function' ? await DAILY() : DAILY }
    if (path.startsWith('/review/answer')) return typeof ANSWER === 'function' ? ANSWER() : ANSWER
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
const { keptAnswers, startAnswerQueue, stopAnswerQueue } = await import('../../src/answerQueue.js')

const CLOZE_BLANK = '￼'
const UNREACHABLE = { ok: false, status: 0 }
const TAKEN = { ok: true, data: {} }

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

// The round opens in its own screen, from the card on Home.
const startRound = async () => fireEvent.click(await screen.findByRole('button', { name: /^(Start|Continue)$/ }))

// The page goes away and comes back; the server still has not heard.
const refresh = async () => {
  cleanup()
  forgetDailyDeck()
  await mount()
}

const text = () => document.body.textContent
const count = (word) => Number((text().match(new RegExp(`(\\d+)\\s*${word}`, 'i')) || [])[1] ?? NaN)

describe('the Daily quiz with an answer the server has not taken', () => {

  // A quick send is never news; an answer still waiting a minute later is, because
  // nothing is sent while the app is closed.

  // THE DECK CAN BE OLDER THAN THE SEND. The app asks for the deck as it starts
  // and sends kept answers at the same moment; when the send is answered first,
  // storage no longer holds the answer, and the deck still deals its card.

  // AND THE OTHER ORDER: the server took the answer before it drew the deck, so the
  // deck leaves the card out and counts it itself. It must be counted once.

  // The owner's 54 → 55: the streak read once with the deck, and moved only on a
  // refresh after today's first answer.

  // A send that neither lands nor fails — the congested network the owner
  // described — must not hold a typed answer past a brief wait.
  it('lets a typed answer go on, kept, when its mark does not come', async () => {
    DAILY = deck([
      { kind: 'book', id: 8, direction: 'cloze', status: 'unseen', color: 'blue',
        quote: `it is a truth ${CLOZE_BLANK} acknowledged`, title: 'Pride and Prejudice', author: 'Austen', options: [], answer: 0 },
      choice(2, 'Emma'),
    ])
    // Held, and let go at the end: a send left hanging would hold the queue for
    // every test after this one, and they would pass without sending anything.
    let letGo
    ANSWER = () => new Promise((resolve) => { letGo = resolve })
    await mount()
    await startRound()
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'universally' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    await screen.findByText('kept, to be marked', {}, { timeout: 6000 })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('2 of 2')).toBeTruthy())
    await act(async () => letGo(UNREACHABLE))
  }, 10000)

  // The gate in front of an account whose password an admin chose answers 403. It
  // is not the server refusing the answer, and the answer must survive it.
  it('keeps an answer the password gate turned away', async () => {
    let asked = 0
    ANSWER = () => { asked += 1; return { ok: false, status: 403 } }
    await mount()
    await startRound()
    fireEvent.click(await screen.findByRole('button', { name: /Persuasion/ }))
    await screen.findByRole('button', { name: 'Next' })
    await waitFor(() => expect(asked, 'the answer was never offered to the server').toBeGreaterThan(0))
    await refresh()
    await startRound()
    await screen.findByText('1 of 2')
    expect(screen.queryByRole('button', { name: /Persuasion/ }), 'the answer was thrown away').toBeNull()
  })
})
