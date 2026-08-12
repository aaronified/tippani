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

import { describe, expect, it } from 'vitest'
import { EPIGRAPHS, pickEpigraph } from '../../src/epigraphs.js'

describe('the pool', () => {
  it('has enough lines that a return visit is unlikely to repeat', () => {
    expect(EPIGRAPHS.length).toBeGreaterThanOrEqual(8)
  })

  it('attributes nothing to anybody', () => {
    // An em-dash attribution, a "quoted" line, or a name is the shape of a claim
    // about a real person — and every one of those would be a claim made from
    // memory. These are the app's own voice, so there is nobody to misquote.
    for (const line of EPIGRAPHS) {
      expect(line, 'no attribution dash').not.toMatch(/—\s*\w/)
      expect(line, 'no quotation marks').not.toMatch(/["“”]/)
    }
  })

  it('is one sentence each, short enough to read without deciding to', () => {
    for (const line of EPIGRAPHS) {
      expect(line.length, line).toBeLessThanOrEqual(90)
      expect(line.trim(), line).toBe(line)
      expect(line, 'ends as a sentence').toMatch(/[.!?]$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(EPIGRAPHS).size).toBe(EPIGRAPHS.length)
  })
})

describe('picking one', () => {
  it('returns a line from the pool', () => {
    expect(EPIGRAPHS).toContain(pickEpigraph())
  })

  it('reaches the first and the last', () => {
    // The commonest off-by-one in a random pick is a last item nobody ever sees.
    expect(pickEpigraph(() => 0)).toBe(EPIGRAPHS[0])
    expect(pickEpigraph(() => 0.999999)).toBe(EPIGRAPHS[EPIGRAPHS.length - 1])
  })

  it('survives a generator that returns exactly 1', () => {
    // Math.random never does, but a caller's stub might, and an undefined epigraph
    // renders as an empty line rather than an error.
    expect(EPIGRAPHS).toContain(pickEpigraph(() => 1))
  })
})
