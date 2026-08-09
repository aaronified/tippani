// Standalone quotes on the Stats page.
//
// The server has been counting them since §24 shipped: they are in the totals,
// the colour breakdown, the tag leaderboard, the activity calendar, the recall
// states, and they have two whole breakdown kinds of their own — speakers and
// occasions — computed, serialised and sent on every request. The page rendered
// neither, counted them in no tile, and left them out of its own header total.
//
// That is the same shape as the Home favourites bug: nothing fails, nothing is
// empty, a number is just quietly smaller than it should be. So these assertions
// are about the arithmetic and the vocabulary, not about whether a component
// renders — a render test passed throughout.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'

let STATS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/stats') return { ok: true, data: STATS }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: StatsPage } = await import('../../src/StatsPage.jsx')

const kind = (over = {}) => ({ count: 0, top: [], most_remembered: null, most_forgotten: null, ...over })

beforeEach(() => {
  STATS = {
    books: 4, annotations: 30, movies: 3, dialogues: 20, quotes: 7,
    tags: 5, favorites: 2, genres: 6,
    most_annotated: null, most_quoted: null, busiest_month: null,
    daily_activity: [], daily_quiz: [], daily_practice: [],
    colors: {}, top_tags: [], first_saved: null,
    recall: { states: {}, reviewed: 0, avg_half_life: 0 },
    breakdown: {
      authors: kind(), books: kind(), series: kind(), films: kind(),
      shows: kind(), directors: kind(), actors: kind(),
      speakers: kind({ count: 2, top: [{ name: 'Bose', works: 3, quotes: 5, remembered: 1, forgetting: 0, probably_forgotten: 0, unseen: 4 }] }),
      occasions: kind({ count: 3 }),
    },
  }
})

const page = async () => {
  render(<StatsPage onSearch={() => {}} />)
  // NOT 'Books': that word is both a counts tile and a breakdown option, and a
  // query matching two things is a query that will match the wrong one.
  await screen.findByText('Annotations')
}

// A StatTile is a number over a MonoLabel inside one box, so the tile is the
// label's parent and the number is the other child.
const tileFor = (label) => screen.getByText(label).closest('div')

describe('the counts row', () => {
  it('has a tile for standalone quotes', async () => {
    await page()
    expect(within(tileFor('Quotes')).getByText('7')).toBeTruthy()
  })

  it('does not call book highlights "Quotes"', async () => {
    // There is a nav tab named Quotes, and it means the standalone kind. A tile
    // named after a screen must not count a different thing from the screen.
    await page()
    expect(screen.getByText('Annotations')).toBeTruthy()
    expect(within(tileFor('Quotes')).queryByText('30'), 'the Quotes tile is showing annotations').toBeNull()
    expect(within(tileFor('Annotations')).getByText('30')).toBeTruthy()
  })
})

describe('the header total', () => {
  it('counts all three media', async () => {
    // 30 + 20 + 7. It was 50 — two of the three kinds the page is about.
    await page()
    await waitFor(() => expect(screen.getByText(/57 saved/)).toBeTruthy())
  })
})

describe('the breakdown dropdown', () => {
  it('offers the kinds the server actually sends', async () => {
    // The failure was an absence in a <select>: two kinds arriving on every
    // response with nothing to display them.
    await page()
    const select = screen.getByLabelText('Breakdown kind')
    const offered = within(select).getAllByRole('option').map((o) => o.value)
    for (const k of Object.keys(STATS.breakdown)) {
      expect(offered, `the server sends ${k}`).toContain(k)
    }
  })
})

describe('the superlatives', () => {
  it('name a most-quoted speaker beside the book and the film', async () => {
    // A standalone quote has no work to be the most-quoted thing, so the
    // speaker is the closest it has to one — taken from the breakdown already
    // on the page rather than a new query.
    await page()
    expect(screen.getByText('Most quoted speaker')).toBeTruthy()
    expect(screen.getByText('Bose')).toBeTruthy()
  })

  it('stays quiet when there is no speaker yet', async () => {
    // An empty library must not render a superlative about nobody.
    STATS.breakdown.speakers = kind()
    await page()
    expect(screen.getByText('Most quoted speaker')).toBeTruthy()
    expect(screen.queryByText('Bose')).toBeNull()
  })
})
