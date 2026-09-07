// A library can outgrow its schedule, and Home now says so.
//
// THE FACT: a card comes back once per half-life, so a library of N owes
// N/ceiling reviews a day and the largest one a daily quota can keep current is
// quota x ceiling. Past that the deck runs permanently behind. Nothing breaks —
// it still leads with whatever is closest to being forgotten — but the far end of
// a growing library stops being reached, and no screen mentioned it.
//
// WHAT THIS ASSERTS, AND WHY IT IS NOT A SOURCE SCAN. The three ways this could
// be wrong are all invisible to a grep: the note could draw for everybody
// (`capacity` read as 0), it could never draw (the field lost between the fetch
// and the row), or it could draw once and vanish on the first answer (the second
// response overwriting a known capacity with an absent one). So Home is handed a
// server, the row is read off the screen, and the answer is pressed.
//
// IT READS THE SENTENCE'S OWN NUMBERS rather than its wording: the library total
// and the capacity have to be the ones the server sent, because a note that says
// the right thing about the wrong pair of numbers is the failure a copy check
// cannot see.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let DAILY
let ANSWER

// A PLAIN FUNCTION, NOT `vi.fn`, AND THAT IS LOAD-BEARING HERE.
//
// setup-dom.js runs `vi.restoreAllMocks()` in a global afterEach. That resets a
// `vi.fn(impl)` created at module scope — the implementation is gone — so from
// the SECOND test onwards `json` returned undefined, Home read `r.ok` off it and
// fell into its error branch with no status row at all. Every test but the first
// then failed by waiting eight seconds for an element that could not exist, which
// reads exactly like a component that never renders.
//
// A plain function has nothing to restore. Nothing below counts calls, so there
// is no reason to want a spy.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/review/daily')) return { ok: true, data: DAILY }
    if (path.startsWith('/review/answer')) return { ok: true, data: ANSWER }
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

const statesOf = (total) => ({ remembered: total, forgetting: 0, probably_forgotten: 0, unseen: 0, total })

// A deck with nothing due, so the card settles into its "done" branch and the
// status row is what is on screen. The counts are the point, not the cards —
// except in the two cases that grade one, which pass `items: [card()]`.
const deck = (total, capacity) => ({
  items: [],
  answered_today: 0,
  got_today: 0,
  forgot_today: 0,
  quota: 8,
  streak: 0,
  states: statesOf(total),
  ...(capacity === undefined ? {} : { capacity }),
})

// One multiple-choice card, the cheapest question that can actually be answered:
// tapping "Emma" is a wrong pick, which grades and posts.
const card = () => ({
  kind: 'book', id: 1, direction: 'source', quote: 'the only way out is through',
  title: 'Persuasion', author: 'Austen', color: 'yellow',
  options: ['Persuasion', 'Emma', 'Villette'], answer: 0,
})

beforeEach(() => {
  DAILY = deck(10, 2920)
  ANSWER = null
  // THE DECK IS COALESCED FOR FIVE SECONDS AT MODULE SCOPE (daily.js), so five
  // tests in one file are well inside one window: without this, tests two to
  // five each read the deck the FIRST one fetched. That is not a flaw in the
  // coalescer — two callers on one page load sharing one request is what it is
  // for — it is module-level state outliving a render, which setup-dom.js says
  // is the caring test's to reset.
  //
  // It cost an hour: the symptom was one test waiting the full eight seconds for
  // a note that could not appear, and three others finding a note left by a
  // sibling, which between them read like a component that both never renders
  // and renders when it should not.
  forgetDailyDeck()
})
afterEach(() => cleanup())

const mount = async () => {
  render(
    <Home
      user={{ username: 'alice', preferences: {} }}
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

const note = () => document.querySelector('[data-outgrown]')

describe('when the library outgrows the schedule', () => {
  it('says nothing at all while the schedule can keep up', async () => {
    DAILY = deck(2920, 2920)
    await mount()
    await waitFor(() => expect(screen.getByText(/where you stand/i)).toBeTruthy())
    expect(note(), 'a library exactly AT capacity is inside it, and must not be told otherwise').toBeNull()
  })

  it('and says so, with both numbers, once it cannot', async () => {
    DAILY = deck(4000, 2920)
    await mount()
    await waitFor(() => expect(note()).toBeTruthy())
    const text = note().textContent
    expect(text, 'the note does not carry the library size the server sent').toContain('4000')
    expect(text, 'the note does not carry the capacity the server sent').toContain('2920')
  })

  // THE FAILURE THIS EXISTS FOR, and it is driven THROUGH THE CARD rather than
  // by calling the endpoint. Home's status row is fed by the daily deck first and
  // by every answer after that, through one callback — so the note a reader has
  // just read can disappear under their hand on the first grade. Posting to
  // /review/answer from the test would exercise the mock and not the wiring: it
  // passes with the callback disconnected, which is the one thing worth checking.
  //
  // So the deck carries a real card, an option is tapped, and the row is read
  // again afterwards.
  it('and keeps saying so after a card is graded', async () => {
    DAILY = { ...deck(4000, 2920), items: [card()] }
    ANSWER = { ok: true, stability: 30, status: 'remembered', capacity: 2920, states: statesOf(4000) }
    await mount()
    await waitFor(() => expect(note()).toBeTruthy())
    await act(async () => { fireEvent.click(screen.getByText('Emma')) })
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeTruthy())
    expect(note(), 'the note went away on the first graded card').toBeTruthy()
  })

  // AND SURVIVES A RESPONSE THAT LEAVES IT OUT, which is what the isFinite guard
  // in Home's takeStates is for. Every review response sends the capacity today
  // and a Go guard says so; this is about the day one stops. Overwriting a known
  // capacity with an absent one would blank the note mid-session, and a note that
  // blinks out reads as a bug in the note rather than a missing field.
  it('and survives an answer that leaves the capacity out', async () => {
    DAILY = { ...deck(4000, 2920), items: [card()] }
    ANSWER = { ok: true, stability: 30, status: 'remembered', states: statesOf(4000) }
    await mount()
    await waitFor(() => expect(note()).toBeTruthy())
    await act(async () => { fireEvent.click(screen.getByText('Emma')) })
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeTruthy())
    expect(note(), 'a response without the capacity cleared one the screen already knew').toBeTruthy()
  })

  // A capacity nobody sent is not a capacity of nothing. Before the guard in
  // overCapacity, `total > undefined` was false and `total > 0` was true — so the
  // two plausible spellings of "missing" gave opposite screens, and one of them
  // told every reader with a single quote that they had outgrown the schedule.
  it('and never says so when the server sent no capacity', async () => {
    DAILY = deck(4000, undefined)
    await mount()
    await waitFor(() => expect(screen.getByText(/where you stand/i)).toBeTruthy())
    expect(note(), 'a missing capacity must read as "unknown", never as zero').toBeNull()
  })

  it('and never says so to a reader with an empty library', async () => {
    DAILY = deck(0, 2920)
    await mount()
    await act(async () => {})
    expect(note()).toBeNull()
  })
})
