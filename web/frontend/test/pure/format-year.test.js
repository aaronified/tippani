// formatYear — turning a stored year into something a person reads.
//
// The interesting cases are all at the edges: 0 is not a year, negatives are not
// countdowns, and "c." must not leak into anything that sorts. The middle of the
// range is boring and stays that way, which is the point.

import { describe, expect, it } from 'vitest'
import { formatYear, parseYearInput } from '../../src/ui.jsx'

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
