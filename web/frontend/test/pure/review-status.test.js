// reviewStatus — the forgetting curve, client side.
//
// This is the highest-value single function in the frontend to pin down. It has
// five branches, it decides the colour of the dot on every quote card in the
// app, and every one of its failure modes is silent: a wrong dot is still a
// dot. It also mirrors recallStatus() in internal/httpapi/review_handlers.go,
// so it is a second implementation of a model that already exists in Go.
//
// The model: p = 2^(-elapsed / half-life). Remembered at p >= 0.9, forgetting
// down to 0.5, probably-forgotten below. Half-life is floored at 7 days
// (reviewMinStability), a quote never asked reads unseen whatever its age, one
// answered inside its first week (reviewNewItemDays) reads remembered, and a
// lapse beats all of it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {  reviewStatus } from '../../src/ui.jsx'

const NOW = new Date('2026-08-07T12:00:00Z')

// The stored format is SQLite's "YYYY-MM-DD HH:MM:SS", always UTC. utcDays
// parses exactly that shape, so the fixtures have to use it rather than ISO.
function daysAgo(n) {
  return new Date(NOW.getTime() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')
}

// An item old enough to be out of the grace week, so a case can exercise the
// curve rather than the "added this week" shortcut.
const OLD = () => daysAgo(400)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('the new-item grace week', () => {
  it('is overridden by a recorded lapse, however new the quote', () => {
    const s = reviewStatus({ reviewed: true, last_result: 'forgot', created_at: daysAgo(1), last_reviewed_at: daysAgo(0) })
    expect(s.key).toBe('probably-forgotten')
  })
})

describe('the curve', () => {
  const seen = (over) => reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', ...over })

  // One test over all five points rather than five separate it()s: every case
  // is the same seen() call with the same stability, differing only in the days
  // elapsed and the expected key. Each row is labelled with the it() it
  // replaces, and the aggregate names EVERY boundary that moved at once instead
  // of dying on the first — which matters here, because the four corners below
  // (0.9 from both sides, 0.5 from both sides) are meant to be read together.
  const curve = [
    [0, 'remembered', 'is remembered immediately after a correct answer'],
    // p = 2^(-4/30) = 0.912, just inside the 0.9 boundary.
    [4, 'remembered', 'is remembered while p >= 0.9'],
    // p = 2^(-5/30) = 0.891, just outside it.
    [5, 'forgetting', 'tips into forgetting once p drops under 0.9'],
    // One half-life elapsed is p = 0.5 exactly, and the comparison is >=, so this
    // is the last moment it counts as forgetting rather than lost.
    [30, 'forgetting', 'is still forgetting at exactly one half-life'],
    [31, 'probably-forgotten', 'is probably-forgotten past one half-life'],
  ]

  it('falls remembered → forgetting → probably-forgotten as p decays', () => {
    const got = curve.map(([days, , name]) => [
      days,
      seen({ stability: 30, last_reviewed_at: daysAgo(days) }).key,
      name,
    ])
    expect(got).toEqual(curve)
  })
})

