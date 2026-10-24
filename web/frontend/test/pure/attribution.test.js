// The kind's own line on a quote card, and the report that caused it.
//
// "Quote cards need better formatting (e.g. letter to carl seelig)." The Einstein
// letter drew "Albert Einstein · Letter to Carl Seelig · 11 March 1952 · Zurich ·
// Letter · English" — the word "Letter" twice, against this repo's directive that
// a row says a thing once, and under that: four fields the form collected and the
// card never drew.
//
// EVERY SHAPE HERE IS THE OWNER'S OWN WORDING, and several are their CORRECTION of
// a first proposal, so each case quotes the instruction it implements. A test that
// asserted my reading rather than theirs would pass while being wrong.
import { describe, expect, it } from 'vitest'
import { attribution, attributionParts } from '../../src/attribution.js'

describe('a letter', () => {
  // The phrase the reader was typing into Occasion by hand, because the recipient
  // box appeared nowhere on the card.
  it('is addressed to somebody', () => {
    expect(attribution({ kind: 'letter', recipient: 'Carl Seelig' })).toBe('Letter to Carl Seelig')
  })
})

// `attributionOf` WAS TESTED HERE AND IS GONE WITH IT. These were its only
// references anywhere — the function had no production caller at all — and the
// owner ruled it deleted rather than left as a seam whose comment promised more
// than it could do. The reasoning is in attribution.js where the function stood;
// the case is not restored here, because a test for a function nobody calls is
// the same dead surface one layer up.

// ── what the phrase did NOT speak for ──────────────────────────────────────────
//
// THE ORIGINAL REPORT WAS A DUPLICATE — "Letter" twice — and the cure is not
// deleting a field but knowing which fields the phrase has already spoken for. So
// the strip beside the line carries the rest, and nothing appears in both.
describe('the strip beside the line', () => {
  const rest = (u, o) => attributionParts(u, o).rest

  // A speech's phrase IS its occasion and place, so neither may appear again.
  it('and drops a speech’s occasion and place, because the phrase is both', () => {
    const u = { kind: 'speech', occasion: 'Nobel banquet', place: 'Stockholm' }
    expect(attribution(u)).toBe('Nobel banquet, Stockholm')
    expect(rest(u, { date: '1921' })).toEqual(['1921'])
  })
})
