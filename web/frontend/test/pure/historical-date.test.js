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
  isPartialDate,
  parsePartialDate,
  partialDateInputValue,
  partialDateValue,
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

  // The bound is the difference between the two kinds of field, so it is asserted
  // as a difference and not as two separate facts: the SAME string, accepted by
  // one and refused by the other.
  it('is the only kind of field that takes them — a plain one still refuses', () => {
    for (const [typed] of REPORTED) {
      expect(isPartialDate(typed, { historical: true }), typed).toBe(true)
      expect(isPartialDate(typed), typed).toBe(false)
    }
  })

  it('keeps the calendar and the era honest', () => {
    for (const bad of [
      '0',            // there is no year zero on either side of the era
      '0000',
      '3001',         // out the far end, both eras
      '3001 BCE',
      '399-02-30',    // February has never had 30 days, BCE included
      '-399-02-30',
      '399-13',       // nor a thirteenth month
      '12345',        // five digits is not a year in this notation
      '399 BC AD',    // one era, not two
      'sometime in the 90s',
    ]) {
      expect(parsePartialDate(bad, { historical: true }), bad).toBe(null)
    }
  })
})

// WHY THE PADDING EXISTS, stated as a test rather than as a comment: the column
// is compared as text in two places and read as substr(occasion_date, 1, 5) by
// the stats timeline, and all three need the year to be a fixed width.
describe('the stored value', () => {
  it('pads the year to four digits and signs a BCE one', () => {
    const rows = [
      ['399', '0399'],
      ['399 BCE', '-0399'],
      ['c. 40', '0040'],
      ['4 BCE', '-0004'],
      ['1890-03-04', '1890-03-04'],
      ['399-03', '0399-03'],
    ]
    for (const [typed, stored] of rows) {
      expect(partialDateValue(parsePartialDate(typed, { historical: true })), typed).toBe(stored)
    }
  })

  it('leaves a date that was already stored exactly as it was', () => {
    // Nothing in the library needs rewriting, because every value the old
    // validator allowed was already four digits.
    for (const already of ['1944', '1944-01', '1944-01-23']) {
      expect(partialDateValue(parsePartialDate(already, { historical: true })), already).toBe(already)
    }
  })

  it('round-trips through the editor without losing the era', () => {
    // The trap yearInputValue was written to close, one field over: seeding an
    // input from the DISPLAY form loses the era, because the display form is
    // translated and no parser here reads a Bengali era word.
    for (const stored of ['-0399', '0040', '1890-03-04', '-0004-07']) {
      const typed = partialDateInputValue(stored)
      expect(partialDateValue(parsePartialDate(typed, { historical: true })), stored).toBe(stored)
    }
  })

  it('shows the reader their own spelling, not the column', () => {
    expect(partialDateInputValue('-0399')).toBe('399 BCE')
    expect(partialDateInputValue('0040')).toBe('40')
    expect(partialDateInputValue('1890-03')).toBe('1890-03')
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

  it('never prints the column at a reader', () => {
    // '-0399', '0399' and '0040' are how the year is STORED. A reader who sees
    // the padding or the minus sign is being shown the column.
    expect(formatPartialDate('-0399')).toBe('399 BCE')
    expect(formatPartialDate('0399')).toBe('399')
    expect(formatPartialDate('0040')).toBe('40')
  })

  it('keeps the era on a date that also has a month and a day', () => {
    expect(formatPartialDate('-0399-03')).toBe('Mar 399 BCE')
    expect(formatPartialDate('-0399-03-04')).toBe('4 Mar 399 BCE')
  })
})

// TWO CONTROLS FOR ONE COLUMN MUST BEHAVE THE SAME, which is a repo directive and
// not a preference: "similar things should act similarly". A person's birth is
// editable in two places — the person form, and the single-field picker on the
// identity screen — and only the form was normalising it, so the same date typed
// in the other place was stored as typed and read back by nothing.
//
// This is a PURE test of the shared step rather than a render of both screens:
// the defect is not what either draws, it is that one of them skipped a call.
describe('a birth date, wherever it is typed', () => {
  const asStored = (typed) => partialDateValue(parsePartialDate(typed, { historical: true }))

  it('reaches the column in one shape', () => {
    for (const typed of ['4 BCE', '-4', '497', 'c. 40']) {
      const stored = asStored(typed)
      expect(stored, typed).toMatch(/^-?\d{4}(-\d{2}){0,2}$/)
      // And back out again, so the second editor shows what the first meant.
      expect(asStored(partialDateInputValue(stored)), typed).toBe(stored)
    }
  })
})

// A COLUMN THAT MAY HOLD FREE TEXT, because for a release it did: the identity
// screen's single-field picker wrote a person's born and died with no date
// validation at all. A formatter that returns '' for what it cannot read would
// print "not recorded" over a value sitting in the row, so both readers of that
// column fall back to the raw words — and this is what says so.
describe('a value the parser cannot read', () => {
  it('formats as nothing, so a caller can fall back rather than guess', () => {
    for (const junk of ['sometime in the 90s', 'the war years', '??']) {
      expect(formatPartialDate(junk), junk).toBe('')
      expect(parsePartialDate(junk, { historical: true }), junk).toBe(null)
    }
  })

  it('is not turned into a date by the leading digits', () => {
    // slice(0, 4) used to make "1990s or so" into "1990" — a date the reader
    // never entered, indistinguishable from one they did.
    expect(parsePartialDate('1990s or so', { historical: true })).toBe(null)
    expect(parsePartialDate('1944 and after', { historical: true })).toBe(null)
  })
})

// The JS Date trap under daysInMonth: `new Date(y, …)` maps 0-99 onto 1900-1999,
// so a leap-day check on the year 40 is really asking about 1940. It happens to
// agree, and the reasoning is in the parser's comment — this is the check that
// would catch someone widening the range past where the reasoning holds.
describe('the leap day in a small year', () => {
  it('agrees with the proleptic calendar for every year the field takes', () => {
    const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    for (let y = 1; y <= 3000; y++) {
      const stored = String(y).padStart(4, '0') + '-02-29'
      const got = parsePartialDate(stored, { historical: true }) !== null
      expect(got, `${y} leap=${leap(y)}`).toBe(leap(y))
    }
  })
})
