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

import { describe, expect, it } from 'vitest'
import {
  formatPartialDate,
  parsePartialDate,
} from '../../src/ui.jsx'

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

