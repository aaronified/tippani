// The timeline's ticks as doors into search.
//
// Every other number on this page clicks through to the rows behind it — a
// breakdown row, an activity day, seven of the eight superlatives. The chart that
// answers "when is my library FROM" answered it and stopped there, which made the
// decade the one fact on the page you could read and not follow.
//
// The interesting assertions here are the ones about where the door is NOT. It
// exists only where the server can answer the exact column that was clicked, and a
// control that returns a confidently wrong page is worse than no control, because
// nothing on the wrong page says so.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let STATS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/stats')) return { ok: true, data: STATS } // the page sends ?offset= for the streak
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: StatsPage } = await import('../../src/StatsPage.jsx')

const kind = (over = {}) => ({ count: 0, top: [], most_remembered: null, most_forgotten: null, ...over })

// Two decades that hold something, one empty decade between them. Short enough
// that the run is never folded into a gap (TIMELINE_GAP_MIN is six), so every
// bucket is drawn as its own column.
const TIMELINE = [
  { year: 1994, works: 2, quotes: 5 },
  { year: 2011, works: 1, quotes: 3 },
]

beforeEach(() => {
  STATS = {
    books: 3, annotations: 8, movies: 1, dialogues: 2, quotes: 8,
    tags: 0, favorites: 0, genres: 0,
    most_annotated: null, most_quoted: null, busiest_month: null,
    daily_activity: [], daily_quiz: [], daily_practice: [],
    colors: {}, top_tags: [], first_saved: null,
    timeline: TIMELINE,
    recall: { states: {}, reviewed: 0, avg_half_life: 0 },
    breakdown: {
      authors: kind(), books: kind(), series: kind(), films: kind(),
      shows: kind(), directors: kind(), actors: kind(), speakers: kind(), people: kind(),
    },
  }
})

const page = async (onSearch) => {
  render(<StatsPage onSearch={onSearch} />)
  await screen.findByText('Annotations')
  await waitFor(() => expect(screen.getByLabelText('Timeline scale')).toBeTruthy())
}

describe('a decade tick', () => {
  it('is a button that searches that decade', async () => {
    const onSearch = vi.fn()
    await page(onSearch)
    const tick = screen.getByRole('button', { name: '1990s — view in search' })
    fireEvent.click(tick)
    expect(onSearch).toHaveBeenCalledWith('1990s')
  })

  it('is not offered for a decade holding nothing', async () => {
    await page(vi.fn())
    // 2000s sits between the two, empty. It keeps its column and its width —
    // that is the chart's whole rule about time — but there is nothing to show.
    expect(screen.queryByRole('button', { name: /^2000s/ })).toBeNull()
  })

  it('is not offered when the page was given no way to search', async () => {
    render(<StatsPage />)
    await screen.findByText('Annotations')
    expect(screen.queryByRole('button', { name: /view in search/ })).toBeNull()
  })
})

describe('the other two scales offer no door', () => {
  // Years: the query box cannot carry a bare year, because "1984" is a book.
  // Centuries: "1900s" parses as a decade, so the answer would be ten years of a
  // hundred and would look complete.
  for (const [value, tick] of [['year', '1994'], ['century', '1900s']]) {
    it(`${value} draws the tick as plain text`, async () => {
      await page(vi.fn())
      fireEvent.change(screen.getByLabelText('Timeline scale'), { target: { value } })
      await waitFor(() => expect(screen.getByText(tick)).toBeTruthy())
      expect(screen.queryByRole('button', { name: /view in search/ })).toBeNull()
    })
  }

  it('and year scale stops writing decades that do not exist', async () => {
    await page(vi.fn())
    fireEvent.change(screen.getByLabelText('Timeline scale'), { target: { value: 'year' } })
    await waitFor(() => expect(screen.getByText('1994')).toBeTruthy())
    expect(screen.queryByText('1994s')).toBeNull()
  })
})

describe('the most-quoted-decade superlative', () => {
  it('opens the decade it names', async () => {
    const onSearch = vi.fn()
    await page(onSearch)
    // The tile shows the decade holding the most quotes — 1990s here, with five.
    // A SuperTile's own button is named by its title, so the exact name is the
    // decade; the tick on the chart is "1990s — view in search" and does not
    // collide with it.
    expect(screen.getByText('Most quoted decade')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '1990s' }))
    expect(onSearch).toHaveBeenCalledWith('1990s')
  })
})
