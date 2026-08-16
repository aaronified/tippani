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

import { describe, expect, it } from 'vitest'
import { formatPartialDate, isPartialDate, todayPartial } from '../../src/ui.jsx'

describe('isPartialDate', () => {
  it('accepts the three shapes', () => {
    for (const good of ['1944', '1944-01', '1944-01-23', '2024-02-29']) {
      expect(isPartialDate(good), good).toBe(true)
    }
  })

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

  it('rejects a year outside the bounds it claims', () => {
    expect(isPartialDate('0999')).toBe(false)
    expect(isPartialDate('3001')).toBe(false)
    expect(isPartialDate('1000')).toBe(true)
    expect(isPartialDate('3000')).toBe(true)
  })
})

describe('formatPartialDate', () => {
  // The precision SHOWS, which is the whole reason for keeping a partial date
  // rather than padding it to a day nobody recorded.
  it('renders each shape at its own precision', () => {
    expect(formatPartialDate('1944')).toBe('1944')
    expect(formatPartialDate('1944-03')).toBe('Mar 1944')
    expect(formatPartialDate('1944-03-04')).toBe('4 Mar 1944')
  })

  it('renders nothing for nothing', () => {
    expect(formatPartialDate('')).toBe('')
    expect(formatPartialDate(null)).toBe('')
    expect(formatPartialDate(undefined)).toBe('')
  })

  // A leading zero in the day is dropped, because "04 Mar" reads as a form
  // field and "4 Mar" reads as a date.
  it('does not pad the day', () => {
    expect(formatPartialDate('1944-03-04')).toBe('4 Mar 1944')
    expect(formatPartialDate('1944-12-25')).toBe('25 Dec 1944')
  })

  // Every month index has to land on the right name — an off-by-one here is
  // invisible in January and wrong for the other eleven.
  it('names all twelve months', () => {
    const want = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    want.forEach((name, i) => {
      const mm = String(i + 1).padStart(2, '0')
      expect(formatPartialDate(`1944-${mm}`), mm).toBe(`${name} 1944`)
    })
  })
})

describe('todayPartial', () => {
  it('is a full date the validator accepts', () => {
    expect(isPartialDate(todayPartial())).toBe(true)
    expect(todayPartial()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // It builds the string from LOCAL parts rather than toISOString, which would
  // hand back yesterday's date for anyone west of UTC after their evening.
  it('agrees with the local calendar, not UTC', () => {
    const n = new Date()
    const p = (x) => String(x).padStart(2, '0')
    expect(todayPartial()).toBe(`${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`)
  })
})
