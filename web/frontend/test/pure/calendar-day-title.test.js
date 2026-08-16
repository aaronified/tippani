// What a day on the activity calendar says when you hover it.
//
// The Saves stream counts things you kept, and the count is the whole fact. The
// two review streams count ANSWERS, where the count alone is the less
// interesting half — the dot is shaded by volume, so a day of twelve answers all
// wrong is painted exactly like a day of twelve all right. Those days report the
// ratio as well.
//
// The case that has to be got right is the ABSENT one. The server sends a row
// only for a day with answers on it, and DELETE /review/practice removes those
// rows outright — so after a practice reset every day is a day with no row. A
// missing row must read as "nothing happened", never as "0% correct", which is a
// claim about a session that did not take place.

import { describe, expect, it } from 'vitest'
import { dayTitle } from '../../src/StatsPage.jsx'

const DAY = '11 Aug 2026'

describe('dayTitle · saves', () => {
  // One test over all three rows rather than three it()s: every case is the same
  // call — dayTitle(DAY, row, 'saved', false) — with a different row, so a single
  // comparison of the whole column names every case that broke instead of dying
  // on the first. The old it() titles survive as row names.
  //
  // Kept SEPARATE from the quiz & practice block below on purpose: the fourth
  // argument is the stream flag, and it is the branch dayTitle forks on. Folding
  // the two describes together would fold together the two behaviours this file
  // exists to hold apart.
  it('says the count and the stream noun, and never accuracy', () => {
    const rows = [
      { name: 'is the count and the stream noun', row: { count: 3 }, want: '11 Aug 2026: 3 saved' },
      {
        name: 'says zero rather than going quiet, and never mentions accuracy',
        row: { count: 0 },
        want: '11 Aug 2026: 0 saved',
      },
      // This row proves the saves branch never reaches the ratio code.
      {
        name: 'ignores a `got` that has no business being there',
        row: { count: 4, got: 2 },
        want: '11 Aug 2026: 4 saved',
      },
    ]
    const got = rows.map((r) => [r.name, dayTitle(DAY, r.row, 'saved', false)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))
  })
})

describe('dayTitle · quiz & practice', () => {
  // One test over all eight rows rather than seven it()s: every case is the same
  // call — dayTitle(DAY, row, noun, true) — differing only in the row, the noun
  // and the expected string, so a single comparison of the whole column names
  // every case that broke rather than stopping at the first. The old it() titles
  // survive as row names and every rationale comment rides on its own row.
  //
  // Eight rows for seven old tests: 'says "no answers" for a quiet day' made two
  // textually different calls ({count: 0} and {count: 0, got: undefined}) and
  // both are kept. They behave alike only because of dayTitle's early return,
  // and that early return is exactly what could change.
  it('reports answers, accuracy and quiet days', () => {
    const rows = [
      {
        name: 'reports answers and accuracy',
        row: { count: 8, got: 6 },
        noun: 'reviewed',
        want: '11 Aug 2026: 8 answers · 75% correct',
      },
      {
        name: 'singularises one answer',
        row: { count: 1, got: 1 },
        noun: 'practised',
        want: '11 Aug 2026: 1 answer · 100% correct',
      },
      // Distinct from a day with no row at all, which is the next test.
      {
        name: 'says 0% for a day you got nothing right — that is a real day',
        row: { count: 5, got: 0 },
        noun: 'reviewed',
        want: '11 Aug 2026: 5 answers · 0% correct',
      },
      // The whole point: a reset practice history is nothing but quiet days, and
      // none of them may be described as a session you did badly at.
      {
        name: 'says "no answers" for a quiet day, not "0% correct"',
        row: { count: 0 },
        noun: 'practised',
        want: '11 Aug 2026: no answers',
      },
      {
        name: 'says "no answers" for a quiet day, not "0% correct" (an explicit undefined `got`)',
        row: { count: 0, got: undefined },
        noun: 'practised',
        want: '11 Aug 2026: no answers',
      },
      // An older server, or any payload where the ratio is not knowable. Reporting
      // the half that is known beats inventing the half that is not.
      {
        name: 'falls back to the tally alone when a row carries no `got`',
        row: { count: 6 },
        noun: 'reviewed',
        want: '11 Aug 2026: 6 answers',
      },
      {
        name: 'rounds the percentage rather than trailing decimals into a tooltip',
        row: { count: 3, got: 2 },
        noun: 'reviewed',
        want: '11 Aug 2026: 3 answers · 67% correct',
      },
      {
        name: 'never reports more than 100%',
        row: { count: 4, got: 4 },
        noun: 'reviewed',
        want: '11 Aug 2026: 4 answers · 100% correct',
      },
    ]
    const got = rows.map((r) => [r.name, dayTitle(DAY, r.row, r.noun, true)])
    expect(got).toEqual(rows.map((r) => [r.name, r.want]))
  })
})
