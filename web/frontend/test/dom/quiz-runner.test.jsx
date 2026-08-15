// QuizRunner — the shared flow behind the Daily Quiz and Practice.
//
// IT HAD NO TESTS AT ALL until this file, which is how it came to be rewritten
// by six features in a row with nothing checking the path every current reader
// is actually on. The only thing that rendered it was a smoke test that mounts
// every screen with all requests refused, so it never reached an active deck.
//
// Two card shapes now share one state machine, and the risky part of that is
// what each of them REVEALS and WHEN. A card that shows its answer before the
// reader has committed is not a quiz.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    return { ok: true, data: { ok: true, stability: 7, status: 'remembered' } }
  }),
}))

const { QuizRunner } = await import('../../src/Home.jsx')

const mcq = (over = {}) => ({
  kind: 'book', id: 1, direction: 'source', quote: 'the only way out is through',
  title: 'Persuasion', author: 'Austen', color: 'yellow',
  options: ['Persuasion', 'Emma', 'Villette'], answer: 0, ...over,
})

// A flip card is defined by having NO options — the client keys on that rather
// than on the direction string, so an unknown direction from a newer server
// degrades to the card type that always works.
const flip = (over = {}) => ({
  kind: 'book', id: 2, direction: 'flip', quote: 'a scrupulous fidelity',
  title: 'Middlemarch', author: 'Eliot', color: 'blue', options: [], answer: 0, ...over,
})

const posted = () => SENT.filter((s) => s.path === '/review/answer')

beforeEach(() => { SENT = [] })

describe('a multiple-choice card', () => {
  it('grades on the tap and posts once', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
    expect(screen.getByText('not quite')).toBeTruthy()
  })

  it('takes one answer per card, however many times it is tapped', async () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    fireEvent.click(screen.getByText('Persuasion'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    fireEvent.click(screen.getByText('Emma'))
    fireEvent.click(screen.getByText('Villette'))
    expect(posted()).toHaveLength(1)
    expect(posted()[0].body.result).toBe('got')
  })

  // The prompt side. A "source" card shows the words and asks where they came
  // from, so the attribution must not be on screen — it is the answer.
  it('does not show the attribution on a card that asks for it', () => {
    render(<QuizRunner mode="daily" cards={[mcq()]} />)
    expect(screen.getByText('the only way out is through')).toBeTruthy()
    expect(screen.queryByText('Austen')).toBeNull()
  })
})

describe('a flip card', () => {
  it('hides the answer until it is asked for', () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    expect(screen.getByText('a scrupulous fidelity')).toBeTruthy()
    expect(screen.queryByText('Middlemarch')).toBeNull()
    expect(screen.getByText('Show me')).toBeTruthy()
  })

  // Revealing is NOT answering. Posting on the reveal would turn self-grading
  // into a button you press to make the card go away.
  it('posts nothing when the answer is revealed', () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    expect(screen.getByText('Middlemarch')).toBeTruthy()
    expect(posted()).toHaveLength(0)
  })

  it('records the reader’s own verdict, and only theirs', async () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    fireEvent.click(screen.getByText('Got it'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('got')
    // ...and it reports what the reader said rather than marking their homework.
    expect(screen.getByText('recalled')).toBeTruthy()
    expect(screen.queryByText('correct')).toBeNull()
  })

  it('takes Forgot as readily as Got it', async () => {
    render(<QuizRunner mode="daily" cards={[flip()]} />)
    fireEvent.click(screen.getByText('Show me'))
    fireEvent.click(screen.getByText('Forgot'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(posted()[0].body.result).toBe('forgot')
  })

  // Skipping after the reveal would be a way to read the answer and move on
  // without ever saying whether you knew it.
  it('withdraws skip once the answer is on screen', () => {
    render(<QuizRunner mode="practice" allowSkip cards={[flip(), mcq()]} />)
    expect(screen.getByText('skip')).toBeTruthy()
    fireEvent.click(screen.getByText('Show me'))
    expect(screen.queryByText('skip')).toBeNull()
  })
})

// An older client meeting a newer server. The direction is unknown, so there is
// nothing to render it as — except the one card type that needs no options.
it('renders an unknown direction as a flip card rather than as nothing', () => {
  render(<QuizRunner mode="daily" cards={[flip({ direction: 'something-new' })]} />)
  expect(screen.getByText('Show me')).toBeTruthy()
  expect(screen.queryByText('Middlemarch')).toBeNull()
})

// ---- the leech offer -------------------------------------------------------
//
// A card forgotten five times over costs a slot in every deck and gives nothing
// back, and until now the only way to stop being asked was to delete the quote.
//
// The two rules that matter are about WHEN it appears. Never before the answer —
// the card is still asked, and the offer is what you do with the answer once it
// is in. And never automatically: nothing is suspended on the app's own
// initiative, because a card vanishing because a counter reached five is a
// decision nobody asked it to make.
describe('the leech offer', () => {
  const leechy = (over = {}) => mcq({ leech: true, lapse_count: 5, ...over })

  it('says nothing until the card has been answered', () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    expect(screen.queryByText('Set it aside')).toBeNull()
  })

  it('offers a way out once the answer is in', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    expect(screen.getByText(/forgotten 5 times/)).toBeTruthy()
  })

  it('never appears for a card that is not a leech', async () => {
    render(<QuizRunner mode="daily" cards={[mcq({ leech: false, lapse_count: 2 })]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(screen.queryByText('Set it aside')).toBeNull()
  })

  // Nothing is suspended by answering. The only thing that takes a card out of
  // the deck is the reader pressing the button that says so.
  it('takes the card out only when asked, and by the bulk route that writes the flag', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    expect(SENT.some((s) => s.path.endsWith('/bulk'))).toBe(false)

    fireEvent.click(screen.getByText('Set it aside'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/annotations/bulk')).toBe(true))
    const call = SENT.find((s) => s.path === '/annotations/bulk')
    expect(call.body).toEqual({ ids: [1], review: false })
  })

  it('lets the reader keep being asked, and stops offering for the session', async () => {
    render(<QuizRunner mode="daily" cards={[leechy()]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Keep asking')).toBeTruthy())
    fireEvent.click(screen.getByText('Keep asking'))
    expect(screen.queryByText('Set it aside')).toBeNull()
    expect(SENT.some((s) => s.path.endsWith('/bulk'))).toBe(false)
  })

  // A film line and a standalone quote are the same offer through different
  // endpoints — the schedule names its kinds book/screen/utterance and the bulk
  // routes name the rows annotation/dialogue/quote.
  it('reaches the right endpoint for a film line', async () => {
    render(<QuizRunner mode="daily" cards={[leechy({ kind: 'screen', id: 9 })]} />)
    fireEvent.click(screen.getByText('Emma'))
    await waitFor(() => expect(screen.getByText('Set it aside')).toBeTruthy())
    fireEvent.click(screen.getByText('Set it aside'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/dialogues/bulk')).toBe(true))
  })
})
