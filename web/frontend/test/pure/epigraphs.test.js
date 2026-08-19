// The line above the sign-in box.
//
// The rule this file exists to enforce is not about typography: it is that NOTHING
// HERE CAN BE CONFIDENTLY WRONG. A login screen has no session, so the pool has to
// be bundled — and a bundled pool of famous quotes is a bundled list of attributions
// written from memory. Misquoting somebody on the front door of an app that exists
// to quote people accurately is worse than saying nothing at all.
//
// So the test asserts the constraint, not the copy: no attribution, no quotation
// marks, nobody named. It is the same rule greetings.js sets for festivals, applied
// to a different kind of fact.
//
// THE POOL IS KEYS NOW, AND THE CONSTRAINT IS ABOUT WORDS, so the two halves are
// checked in the two places they live. epigraphs.js holds greeting.epigraph.1 … .10
// and the sentences are in internal/i18n/en.txt, which means:
//
//   - the SHAPE checks (a pick lands in the pool, the ends are reachable) read the
//     keys, and are the same assertions they were;
//   - the COPY checks read the file, because that is where the copy is. Reading
//     them back through t() would pass on a missing key: the resolver answers with
//     a humanised stub, and "Epigraph 4" is under 90 characters and ends in no full
//     stop that anybody wrote.
//
// AND THE TWO SIDES HAVE TO AGREE ON THE POOL'S SIZE, which is a rule this file
// could not have before. A key in the file that the pool does not list is a line
// nobody will ever be shown; an eleventh key in the pool with no line renders as a
// stub. Both are new failures the split made possible, so both are asserted.

import { describe, expect, it } from 'vitest'
import { EPIGRAPHS, pickEpigraph } from '../../src/epigraphs.js'
import { t } from '../../src/i18n.js'
import { pool, under, value } from '../locale-file.js'

// The English of every line, in pool order, straight out of en.txt.
const LINES = EPIGRAPHS.map(value)

describe('the pool', () => {
  it('has enough lines that a return visit is unlikely to repeat', () => {
    expect(EPIGRAPHS.length).toBeGreaterThanOrEqual(8)
  })

  it('is the same pool in the code and in the file', () => {
    // pool() walks greeting.epigraph.1, .2, … and stops at the first gap, because
    // the index IS the line's identity. Compared as lists, so a gap in the middle
    // and a missing line at the end read as different failures.
    expect(pool('greeting.epigraph')).toEqual(LINES)
    expect(under('greeting.epigraph').length, 'a key the pool does not list').toBe(EPIGRAPHS.length)
    expect(LINES.filter((l) => !l), 'a key in the pool with nothing written for it').toEqual([])
  })

  it('attributes nothing to anybody', () => {
    // An em-dash attribution, a "quoted" line, or a name is the shape of a claim
    // about a real person — and every one of those would be a claim made from
    // memory. These are the app's own voice, so there is nobody to misquote.
    for (const line of LINES) {
      expect(line, 'no attribution dash').not.toMatch(/—\s*\w/)
      expect(line, 'no quotation marks').not.toMatch(/["“”]/)
    }
  })

  it('is one sentence each, short enough to read without deciding to', () => {
    for (const line of LINES) {
      expect(line.length, line).toBeLessThanOrEqual(90)
      expect(line.trim(), line).toBe(line)
      expect(line, 'ends as a sentence').toMatch(/[.!?]$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(EPIGRAPHS).size).toBe(EPIGRAPHS.length)
    expect(new Set(LINES).size).toBe(LINES.length)
  })
})

describe('picking one', () => {
  it('returns a line from the pool', () => {
    expect(LINES).toContain(pickEpigraph())
  })

  it('reaches the first and the last', () => {
    // The commonest off-by-one in a random pick is a last item nobody ever sees.
    expect(pickEpigraph(() => 0)).toBe(t(EPIGRAPHS[0]))
    expect(pickEpigraph(() => 0.999999)).toBe(t(EPIGRAPHS[EPIGRAPHS.length - 1]))
  })

  it('survives a generator that returns exactly 1', () => {
    // Math.random never does, but a caller's stub might, and an undefined epigraph
    // renders as an empty line rather than an error.
    expect(LINES).toContain(pickEpigraph(() => 1))
  })

  it('returns the words, not the key', () => {
    // The one regression the migration makes possible: pickEpigraph forgetting to
    // resolve, and the login screen printing greeting.epigraph.7 under the logo.
    expect(pickEpigraph(() => 0)).not.toBe(EPIGRAPHS[0])
  })
})
