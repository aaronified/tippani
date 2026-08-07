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
// (reviewMinStability), a card in its first week reads remembered
// (reviewNewItemDays), and a lapse beats all of it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fmtHalfLife, reviewStatus } from '../../src/ui.jsx'

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
  it('reads remembered inside the first week, before any review', () => {
    const s = reviewStatus({ reviewed: false, created_at: daysAgo(2) })
    expect(s.key).toBe('remembered')
    expect(s.tip).toBe('Remembered · added this week')
  })

  it('reads remembered on the last day of the week', () => {
    expect(reviewStatus({ reviewed: false, created_at: daysAgo(6.9) }).key).toBe('remembered')
  })

  it('falls out of grace at exactly seven days', () => {
    expect(reviewStatus({ reviewed: false, created_at: daysAgo(7) }).key).toBe('unseen')
  })

  it('is overridden by a recorded lapse, however new the quote', () => {
    const s = reviewStatus({ reviewed: true, last_result: 'forgot', created_at: daysAgo(1), last_reviewed_at: daysAgo(0) })
    expect(s.key).toBe('probably-forgotten')
  })

  // created_at is nullable in principle; utcDays returns Infinity for a missing
  // timestamp, which must NOT read as "added this week".
  it('does not grant grace to an item with no created_at', () => {
    expect(reviewStatus({ reviewed: false }).key).toBe('unseen')
  })
})

describe('unseen', () => {
  it('is anything never reviewed and out of grace', () => {
    const s = reviewStatus({ reviewed: false, created_at: OLD() })
    expect(s.key).toBe('unseen')
    expect(s.tip).toBe('Not yet reviewed')
    expect(s.filled).toBe(false)
  })
})

describe('the curve', () => {
  const seen = (over) => reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', ...over })

  it('is remembered immediately after a correct answer', () => {
    expect(seen({ stability: 30, last_reviewed_at: daysAgo(0) }).key).toBe('remembered')
  })

  // p = 2^(-4/30) = 0.912, just inside the 0.9 boundary.
  it('is remembered while p >= 0.9', () => {
    expect(seen({ stability: 30, last_reviewed_at: daysAgo(4) }).key).toBe('remembered')
  })

  // p = 2^(-5/30) = 0.891, just outside it.
  it('tips into forgetting once p drops under 0.9', () => {
    expect(seen({ stability: 30, last_reviewed_at: daysAgo(5) }).key).toBe('forgetting')
  })

  // One half-life elapsed is p = 0.5 exactly, and the comparison is >=, so this
  // is the last moment it counts as forgetting rather than lost.
  it('is still forgetting at exactly one half-life', () => {
    expect(seen({ stability: 30, last_reviewed_at: daysAgo(30) }).key).toBe('forgetting')
  })

  it('is probably-forgotten past one half-life', () => {
    expect(seen({ stability: 30, last_reviewed_at: daysAgo(31) }).key).toBe('probably-forgotten')
  })
})

describe('the half-life floor', () => {
  // The floor is load-bearing, not cosmetic: it is also what the server's
  // due-ness SQL uses (MAX(r.stability, 7)). A stored stability below 7 must be
  // treated as 7 here or the dot disagrees with whether the card is in the deck.
  it('treats a sub-floor stability as seven days', () => {
    const s = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', stability: 1, last_reviewed_at: daysAgo(3) })
    // With the floor: p = 2^(-3/7) = 0.74 -> forgetting.
    // Without it:     p = 2^(-3/1) = 0.125 -> probably-forgotten.
    expect(s.key).toBe('forgetting')
    // The key alone proves a floor EXISTS but not that it is SEVEN — 'forgetting'
    // covers the whole p in [0.5, 0.9) band, so any floor from about 3 to 19
    // gives the same answer here. The tip names the number, and the number has
    // to stay in lockstep with the server's reviewMinStability: the same
    // MAX(stability, 7) is spliced into the deck's due-ness SQL, so a drift
    // makes the dot disagree with whether the card is really due.
    expect(s.tip).toBe('Forgetting · half-life 7d')
  })

  it('treats a zero or missing stability as the floor', () => {
    const zero = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', stability: 0, last_reviewed_at: daysAgo(3) })
    const missing = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', last_reviewed_at: daysAgo(3) })
    expect(zero.tip).toBe('Forgetting · half-life 7d')
    expect(missing.tip).toBe('Forgetting · half-life 7d')
  })
})

describe('a reviewed card with no last_reviewed_at', () => {
  // This is a real wire shape, not a hypothetical: both list endpoints select
  // COALESCE(r.last_reviewed_at, ''), and the server explicitly contemplates a
  // review row with a NULL timestamp — a bumpSeen-only row, which its own
  // comment calls "maximally due". The client disagrees on purpose: utcDays
  // falls back to 0 elapsed, so the dot reads remembered rather than shouting.
  // Whichever way that goes it should be a decision, not an accident.
  it('reads as freshly reviewed rather than maximally overdue', () => {
    const s = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', stability: 30 })
    expect(s.key).toBe('remembered')
    expect(s.tip).toBe('Remembered · half-life 4w')
  })
})

describe('the lapse override', () => {
  // The failed recall, not the timestamp, is the honest signal — a card
  // answered wrong one second ago is not "remembered" on any reading.
  it('beats a perfect elapsed time', () => {
    const s = reviewStatus({ reviewed: true, created_at: OLD(), stability: 100, last_reviewed_at: daysAgo(0), last_result: 'forgot' })
    expect(s.key).toBe('probably-forgotten')
  })
})

describe('the tooltip', () => {
  it('names the state and the half-life while the card is holding', () => {
    const s = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', stability: 30, last_reviewed_at: daysAgo(1) })
    expect(s.tip).toBe('Remembered · half-life 4w')
  })

  it('says due now once the half-life has elapsed', () => {
    const s = reviewStatus({ reviewed: true, created_at: OLD(), last_result: 'got', stability: 30, last_reviewed_at: daysAgo(30) })
    expect(s.tip).toBe('Forgetting · due now')
  })

  // The house rule is five words maximum for a label. The dot's tooltip is a
  // label, and it is generated rather than written, so it needs enforcing.
  it('never exceeds five words', () => {
    const fixtures = [
      { reviewed: false, created_at: daysAgo(1) },
      { reviewed: false, created_at: OLD() },
      { reviewed: true, created_at: OLD(), last_result: 'got', stability: 7, last_reviewed_at: daysAgo(1) },
      { reviewed: true, created_at: OLD(), last_result: 'got', stability: 100, last_reviewed_at: daysAgo(1) },
      { reviewed: true, created_at: OLD(), last_result: 'forgot', stability: 100, last_reviewed_at: daysAgo(200) },
    ]
    for (const f of fixtures) {
      const words = reviewStatus(f).tip.split(/\s+/).filter(Boolean)
      expect(words.length, reviewStatus(f).tip).toBeLessThanOrEqual(5)
    }
  })
})

describe('parity with the server', () => {
  // recallStatus() in Go orders its branches differently: it returns
  // probably-forgotten for lastResult=="forgot" BEFORE it checks seen, whereas
  // this function checks !reviewed first and would answer "unseen".
  //
  // That combination cannot occur. Both fields come off the same LEFT JOIN —
  // `reviewed` is `r.item_id IS NOT NULL` and last_result is
  // `COALESCE(r.last_result,'')` — so no row means reviewed=false AND
  // last_result='', and a row means reviewed=true. The divergence is
  // unreachable by construction rather than handled, which is worth an
  // assertion: if the server ever starts sending a lapse without a review row,
  // this is where the two models start disagreeing.
  it('never sees a lapse on an unreviewed card', () => {
    const impossible = { reviewed: false, last_result: 'forgot', created_at: OLD() }
    expect(reviewStatus(impossible).key).toBe('unseen') // Go would say probably-forgotten
  })
})

describe('fmtHalfLife', () => {
  const cases = [
    [0.25, '6h'],
    [0.5, '12h'],
    [0.01, '1h'], // clamped: never "0h"
    [1, '1d'],
    [7, '7d'],
    [13.6, '14d'], // still days below the 14 boundary, even when it rounds to it
    [14, '2w'],
    [20, '3w'], // 20/7 = 2.86 — rounds up; floor would say 2w
    [30, '4w'],
    [59, '8w'],
    [60, '2mo'],
    [75, '3mo'], // 75/30 = 2.5 — rounds up; floor would say 2mo
    [100, '3mo'],
    [0.4, '10h'], // 0.4*24 = 9.6 — rounds up; floor would say 9h
  ]
  for (const [input, want] of cases) {
    it(`renders ${input} days as ${want}`, () => {
      expect(fmtHalfLife(input)).toBe(want)
    })
  }
})
