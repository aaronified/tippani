// Which schedule a reader who has chosen nothing is actually on.
//
// THE CHANGE: adaptive used to be the opt-in and is now the default; the fixed
// ladder is the opt-in (prefs.srLadder). The sense of the stored flag inverted to
// make that possible — `srAdaptive` was a flat bool in a JSON blob, so every
// account already carried `false` whether the reader chose the ladder or never
// opened the panel, and a default like that cannot be flipped.
//
// WHY THIS IS A SCREEN TEST AND NOT A UNIT ONE. Home's explainer is the only
// place in the app that describes the rule, and it takes an `adaptive` prop. An
// inverted flag read the wrong way round there is invisible to every server test:
// the schedule would be right and the paragraph explaining it would describe the
// other rule, to every reader, for ever. That is worse than no explainer — it is
// the one piece of copy a confused reader goes to.
//
// So this presses "how these work" and reads which rule the paragraph names, for
// a reader with no preference and for one who chose the ladder.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// A plain function, not vi.fn: setup-dom.js restores all mocks between tests,
// which wipes a module-scope implementation from the second test onwards.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/review/daily')) {
      return {
        ok: true,
        data: {
          items: [], answered_today: 0, got_today: 0, forgot_today: 0, quota: 8, streak: 0,
          capacity: 2920,
          states: { remembered: 10, forgetting: 0, probably_forgotten: 0, unseen: 0, total: 10 },
        },
      }
    }
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

// daily.js coalesces GET /review/daily for five seconds at module scope, so
// without this every test after the first reads the deck the first one fetched.
beforeEach(() => forgetDailyDeck())
afterEach(() => cleanup())

const mountWith = async (preferences) => {
  render(
    <Home
      user={{ username: 'alice', preferences }}
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
  await waitFor(() => expect(screen.getByText(/how these work/i)).toBeTruthy())
  await act(async () => { fireEvent.click(screen.getByText(/how these work/i)) })
  return document.body.textContent
}

// The two paragraphs are told apart by what they say the rule DOES, not by a
// marker put there for the test: adaptive multiplies, the ladder steps.
const MULTIPLIES = /two and a half times/i
const STEPS = /climbs a fixed ladder/i

describe('the rule the explainer describes', () => {
  it('is adaptive for a reader who has chosen nothing', async () => {
    const text = await mountWith({})
    expect(text, 'a reader with no preference is being told about the ladder').not.toMatch(STEPS)
    expect(text, 'the explainer does not describe adaptive to a reader on adaptive').toMatch(MULTIPLIES)
  })

  // AND FOR ONE WHOSE STORED BLOB PREDATES THE SWITCH. A preferences object
  // carrying the old `srAdaptive: false` has no `srLadder`, so it reads as
  // "never chose" — which is the whole point of inverting the flag, and the case
  // that decides whether the release reaches anybody.
  it('and for one whose stored preferences still say srAdaptive: false', async () => {
    const text = await mountWith({ srAdaptive: false })
    expect(text, 'an account written before the switch is still on the ladder').not.toMatch(STEPS)
    expect(text).toMatch(MULTIPLIES)
  })

  it('and is the ladder for a reader who asked for it', async () => {
    const text = await mountWith({ srLadder: true })
    expect(text, 'a reader who chose the ladder is being told about adaptive').not.toMatch(MULTIPLIES)
    expect(text, 'the explainer does not describe the ladder to a reader on the ladder').toMatch(STEPS)
  })
})
