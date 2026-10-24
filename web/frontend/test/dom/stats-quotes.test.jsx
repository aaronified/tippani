// Standalone quotes on the Stats page.
//
// The server has been counting them since §24 shipped: they are in the totals,
// the colour breakdown, the tag leaderboard, the activity calendar, the recall
// states, and they have a breakdown kind of their own — speakers —
// computed, serialised and sent on every request. The page rendered
// neither, counted them in no tile, and left them out of its own header total.
//
// That is the same shape as the Home favourites bug: nothing fails, nothing is
// empty, a number is just quietly smaller than it should be. So these assertions
// are about the arithmetic and the vocabulary, not about whether a component
// renders — a render test passed throughout.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { t } from '../../src/i18n.js'
import { pickFrom } from './helpers/pickFrom.jsx'

let STATS
let CHARACTERS
let PEOPLE

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/stats')) return { ok: true, data: STATS } // the page sends ?offset= for the streak
    if (path.startsWith('/people')) return { ok: true, data: { people: PEOPLE } }
    if (path.startsWith('/characters')) return { ok: true, data: { characters: CHARACTERS } }
    return { ok: true, data: {} }
  }),
}))

const { default: StatsPage } = await import('../../src/StatsPage.jsx')

const kind = (over = {}) => ({ count: 0, top: [], most_remembered: null, most_forgotten: null, ...over })

beforeEach(() => {
  CHARACTERS = []
  PEOPLE = []
  STATS = {
    books: 4, annotations: 30, movies: 3, dialogues: 20, quotes: 7,
    tags: 5, favorites: 2, genres: 6,
    most_annotated: null, most_quoted: null, busiest_month: null,
    daily_activity: [], daily_quiz: [], daily_practice: [],
    colors: {}, top_tags: [], first_saved: null,
    recall: { states: {}, reviewed: 0, avg_half_life: 0 },
    breakdown: {
      books: kind({ count: 1, top: [{ name: 'Ice', cover_path: 'covers/ice.jpg', quotes: 6, remembered: 2, forgetting: 0, probably_forgotten: 0, unseen: 4 }] }),
      series: kind(), films: kind(),
      shows: kind(), directors: kind(), actors: kind(),
      speakers: kind({ count: 2, top: [{ name: 'Bose', works: 3, quotes: 5, remembered: 1, forgetting: 0, probably_forgotten: 0, unseen: 4 }] }),
      // Occasions is gone as a breakdown — an occasion is a locator, not
      // somebody you quote. `people` replaces it: every credited human in one
      // row each, whatever role they were credited in.
      people: kind({ count: 4, top: [{ name: 'Bose', works: 3, quotes: 5, remembered: 1, forgetting: 0, probably_forgotten: 0, unseen: 4 }] }),
      characters: kind({ count: 1, top: [{ name: 'Delia Surridge', works: 1, quotes: 3, remembered: 1, forgetting: 0, probably_forgotten: 0, unseen: 2 }] }),
      authors: kind({ count: 1, top: [{ name: 'Anna Kavan', works: 2, quotes: 4, remembered: 1, forgetting: 0, probably_forgotten: 0, unseen: 3 }] }),
    },
  }
})

const page = async () => {
  render(<StatsPage onSearch={() => {}} />)
  // NOT 'Books': that word is both a counts tile and a breakdown option, and a
  // query matching two things is a query that will match the wrong one.
  await screen.findByText('Annotations')
}

describe('the header total', () => {
  it('counts all three media', async () => {
    // 30 + 20 + 7. It was 50 — two of the three kinds the page is about.
    await page()
    await waitFor(() => expect(screen.getByText(/57 saved/)).toBeTruthy())
  })
})

