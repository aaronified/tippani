// formatYear — turning a stored year into something a person reads.
//
// The interesting cases are all at the edges: 0 is not a year, negatives are not
// countdowns, and "c." must not leak into anything that sorts. The middle of the
// range is boring and stays that way, which is the point.

import { describe, expect, it } from 'vitest'
import { formatYear, parseYearInput } from '../../src/ui.jsx'

describe('formatYear', () => {
  it('writes a BCE year as a positive number and a word', () => {
    // -380 rendered literally reads as a countdown or a mistake. The sign is
    // storage; "BCE" is the reading.
    expect(formatYear(-380)).toBe('380 BCE')
    expect(formatYear(-1)).toBe('1 BCE')
    expect(formatYear(-2100)).toBe('2100 BCE')
  })

  it('leaves CE unmarked', () => {
    // "1954 CE" on a novel is pedantry. The era is worth naming only when it is
    // the unusual one.
    expect(formatYear(1954)).toBe('1954')
    expect(formatYear(99)).toBe('99')
  })

  it('treats 0 as no year at all', () => {
    // 0 has meant "not recorded" since the column existed, and there is no year
    // 0 in the era anyway. Rendering it as "0" would invent a book from the
    // boundary for every book with a blank year.
    expect(formatYear(0)).toBe('')
    expect(formatYear(null)).toBe('')
    expect(formatYear(undefined)).toBe('')
    expect(formatYear('')).toBe('')
  })

  it('prefixes an estimate without changing the year', () => {
    expect(formatYear(-380, true)).toBe('c. 380 BCE')
    expect(formatYear(1719, true)).toBe('c. 1719')
    // circa on a missing year is still nothing — "c. " alone says nothing at all.
    expect(formatYear(0, true)).toBe('')
  })

  it('accepts the string a form hands back', () => {
    // Year inputs are text, and a form that has not parsed yet passes a string.
    expect(formatYear('-380')).toBe('380 BCE')
    expect(formatYear('1954')).toBe('1954')
  })

  it('never returns something that would sort as a year', () => {
    // The guard on circa being display-only: whatever this produces is for
    // reading, and the callers sort on the raw number. If a caller ever sorts on
    // this output, "c. 380 BCE" and "1954" would order alphabetically.
    expect(formatYear(-380, true)).not.toMatch(/^-?\d+$/)
  })
})

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

  it('reads the forms people type', () => {
    expect(y('380 BCE')).toEqual({ year: -380, circa: false })
    expect(y('380 BC')).toEqual({ year: -380, circa: false })
    expect(y('380 b.c.')).toEqual({ year: -380, circa: false })
    expect(y('-380')).toEqual({ year: -380, circa: false })
    expect(y('1954')).toEqual({ year: 1954, circa: false })
    expect(y('1954 CE')).toEqual({ year: 1954, circa: false })
    expect(y('1954 AD')).toEqual({ year: 1954, circa: false })
  })

  it('lets the era word win over a leading minus', () => {
    // "-380 BCE" is someone being doubly explicit, not asking for 380 CE. Double
    // negation here would put a book 760 years from where they meant.
    expect(y('-380 BCE')).toEqual({ year: -380, circa: false })
  })

  it('takes circa off the front of the same string', () => {
    expect(y('c. 380 BCE')).toEqual({ year: -380, circa: true })
    expect(y('circa 380 BCE')).toEqual({ year: -380, circa: true })
    expect(y('ca. 1500')).toEqual({ year: 1500, circa: true })
  })

  it('does not mistake a bare CE for circa', () => {
    // "c" opens circa and "ce" closes a year; both start with the same letter,
    // and they sit at opposite ends of the string for exactly that reason.
    expect(y('CE')).toEqual({ year: 0, circa: false })
    expect(y('1954 ce')).toEqual({ year: 1954, circa: false })
  })

  it('answers 0 for anything it cannot read', () => {
    // 0 is what this field has always meant by "no year". Guessing would put a
    // book on the timeline at a date nobody entered.
    for (const bad of ['', '   ', 'nineteen fifty four', 'abcd', '19.5', '0']) {
      expect(y(bad)).toEqual({ year: 0, circa: false })
    }
  })
})
