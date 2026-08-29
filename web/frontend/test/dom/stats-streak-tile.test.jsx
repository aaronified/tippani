// The longest-streak tile on Stats → Memory.
//
// Two numbers, and which is the headline is the whole point. The drawer and the
// Home card already show the CURRENT streak; what neither can say is whether it
// is any good, because a run that has ended is invisible to that figure by
// construction. So here the record is the big number and today's run is the line
// under it — and a tile that showed them the other way round would be a third
// copy of something the reader already has in two places.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

let STATS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/stats')) return { ok: true, data: STATS }
    return { ok: true, data: {} }
  }),
}))

const { default: StatsPage } = await import('../../src/StatsPage.jsx')

const base = (recall) => ({
  books: 1, annotations: 3, movies: 0, dialogues: 0, quotes: 0, tags: 0, favorites: 0,
  recall: { states: { total: 3, remembered: 1, forgetting: 1, probably_forgotten: 1, unseen: 0 }, reviewed: 3, avg_half_life: 4, ...recall },
})

beforeEach(() => { STATS = base({ streak: 2, longest_streak: 9 }) })

const memoryCard = async () => {
  render(<StatsPage />)
  const head = await screen.findByText('Memory')
  return head.closest('div').parentElement
}

describe('the memory streak tile', () => {
  it('prints the record big and the current run under it', async () => {
    const card = await memoryCard()
    const tile = within(card).getByText('9d').closest('div').parentElement
    expect(within(tile).getByText('longest streak')).toBeTruthy()
    // The distinguishing assertion: 2 is present, and it is NOT the headline.
    expect(within(tile).getByText('2 now')).toBeTruthy()
    expect(within(card).queryByText('2d')).toBeNull()
  })

  it('says nothing at all before the Daily Quiz has been played', async () => {
    // A tile reading 0 with "0 now" under it is a worse way of saying the quiz
    // has never been opened than an absent tile.
    STATS = base({ streak: 0, longest_streak: 0 })
    const card = await memoryCard()
    expect(within(card).queryByText('longest streak')).toBeNull()
  })

  it('still shows the record on a day the run has already broken', async () => {
    STATS = base({ streak: 0, longest_streak: 12 })
    const card = await memoryCard()
    expect(within(card).getByText('12d')).toBeTruthy()
    expect(within(card).getByText('0 now')).toBeTruthy()
  })
})
