import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatPartialDate, formatYear, isPartialDate, parsePartialDate, parseYearInput, reviewStatus } from '../../src/ui.jsx'

// formatYear — turning a stored year into something a person reads.
//
// The interesting cases are all at the edges: 0 is not a year, negatives are not
// countdowns, and "c." must not leak into anything that sorts. The middle of the
// range is boring and stays that way, which is the point.
describe('format year', () => {
  describe('parseYearInput', () => {
    const y = (s) => parseYearInput(s)

    it('reads back exactly what formatYear writes', () => {
      // The round trip is the contract: resting() shows formatYear's output in the
      // editor and coerce() parses it on save, so any pair that does not survive
      // this is a field that quietly changes when you open and close it.
      for (const [year, circa] of [[-380, false], [-380, true], [1954, false], [1719, true], [99, false], [-1, false]]) {
        expect(y(formatYear(year, circa))).toEqual({ year, circa })
      }
    })
  })
})

// A DATE IN HISTORY, which the app could not hold.
//
// The owner's report, verbatim: "i am unable to add 399BCE as a date now. this is
// weird. i cannot even add just 399. this was fine before. i have Seneca's quotes
// from c. 40."
//
// Three separate things were stopping it and each is checked here:
//
//   1. THE SHAPE demanded four digits and a year past 1000, so a 3-digit year was
//      rejected outright and BCE had no spelling at all.
//   2. THE COLUMN is sorted and grouped as text, so a year that varies in width
//      cannot be stored as typed — hence the padding, and hence a test for it.
//   3. THE FLAG was stored and displayed nowhere, so ticking "the date is
//      approximate" produced no visible difference anywhere in the app.
//
// AND THE WINDOW MUST SURVIVE. The 1000-3000 bound is not an oversight to be
// deleted: a read log recording that a book was finished in the year 40 is a
// typo, and catching it is what the bound is for. So every case below is stated
// twice — what a HISTORICAL field takes, and what a plain one still refuses.
describe('historical date', () => {
  // The reporter's own three dates, plus the two that motivated the born/died half.
  const REPORTED = [
    ['399', { year: 399, month: null, day: null }],
    ['399 BCE', { year: -399, month: null, day: null }],
    ['399BCE', { year: -399, month: null, day: null }],
    ['-399', { year: -399, month: null, day: null }],
    ['c. 40', { year: 40, month: null, day: null, circa: true }],
    ['4 BCE', { year: -4, month: null, day: null }],
    ['497', { year: 497, month: null, day: null }],
  ]

  describe('a historical date', () => {
    it('reads every date in the report that the app refused', () => {
      for (const [typed, want] of REPORTED) {
        const got = parsePartialDate(typed, { historical: true })
        expect(got, typed).toBeTruthy()
        expect({ year: got.year, month: got.month, day: got.day }, typed)
          .toEqual({ year: want.year, month: want.month, day: want.day })
        if (want.circa) expect(got.circa, typed).toBe(true)
      }
    })
  })

  // The flag was stored, exported and imported for a release and read by nothing.
  describe('the approximate flag', () => {
    it('reaches the reader, which for a release it did not', () => {
      expect(formatPartialDate('0040', true)).toBe('c. 40')
      expect(formatPartialDate('0040', false)).toBe('40')
      expect(formatPartialDate('-0399', true)).toBe('c. 399 BCE')
      expect(formatPartialDate('-0399', false)).toBe('399 BCE')
    })
  })
})

// The partial-date helpers (ui.jsx): the client mirror of the server's
// normalizePartialDate.
//
// They had no test at all, which is worth stating plainly because the server
// half was found to be WRONG on exactly this ground: it checked only that the
// day was between 1 and 31, so it accepted 30 February and 31 April and stored
// them. That was fixed by running the full-date case through a real calendar.
// This file pins the same rule on the client, where the check exists so a typo
// is caught before it is sent rather than bounced back as a 400.
//
// The three shapes are the point of the format. A partial date is allowed to be
// VAGUE — "1944" is an honest answer about a speech — but it is not allowed to
// be WRONG, because these sort against each other as text and a date that never
// happened would file itself neatly between two that did.
describe('partial date', () => {
  describe('isPartialDate', () => {
    // One test over all fifteen rejected inputs rather than three loops: every
    // one is the same assertion — isPartialDate is strictly false — and only the
    // string differs. The three groups keep their headings as comments, and the
    // aggregate names every input that was wrongly accepted rather than stopping
    // at the first.
    it('rejects a date that is malformed, out of range, or not on the calendar', () => {
      const bad = [
        // rejects a date the calendar does not have
        '1944-02-30', // February has never had 30 days
        '1944-04-31', // nor April 31
        '2023-02-29', // 2023 is not a leap year
        '1900-02-29', // nor 1900 — divisible by 100, not by 400
        // rejects a month outside the year
        '1944-00',
        '1944-13',
        '1944-01-00',
        '1944-01-32',
        // rejects anything that is not the shape
        '',
        '44',
        '1944-1',
        '1944-01-2',
        'not a date',
        '1944/01/23',
        '1944-01-23T00:00:00',
      ]
      const accepted = bad.filter((s) => isPartialDate(s) !== false).map((s) => JSON.stringify(s))
      expect(accepted).toEqual([])
    })
  })
})

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
describe('review status', () => {
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
})
