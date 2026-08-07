// Credit splitting — the JS half of a two-language algorithm.
//
// people.jsx says it plainly: "parseCreditSeps / splitCredits mirror
// internal/metadata/credits.go — keep the two in LOCKSTEP; the Go table in
// credits_test.go is the source of truth." Until now that instruction had no
// enforcement on this side, so the JS could drift and the only symptom would be
// a group-by heading disagreeing with the People console about how many people
// wrote a book.
//
// The first table below is TestSplitCredits from
// internal/metadata/credits_test.go, ported case for case and in the same
// order. When you add a case there, add it here. The one intentional
// difference: Go's SplitCredits returns nil for empty input, JS returns [].

import { describe, expect, it } from 'vitest'
import { DEFAULT_CREDIT_SEPS, parseCreditSeps, splitCredits } from '../../src/people.jsx'

const def = DEFAULT_CREDIT_SEPS
const seps = (o) => ({ comma: false, semicolon: false, amp: false, and: false, ...o })

describe('splitCredits — ported from internal/metadata/credits_test.go', () => {
  const cases = [
    // The roadmap separators.
    ['Gaiman & Pratchett', def, ['Gaiman', 'Pratchett']],
    ['Neil Gaiman and Terry Pratchett', def, ['Neil Gaiman', 'Terry Pratchett']],
    ['Smith, Jones and Lee', def, ['Smith', 'Jones', 'Lee']],
    // Oxford comma: the ", and " compound separator must not leave a junk
    // "and Lee" component.
    ['Smith, Jones, and Lee', def, ['Smith', 'Jones', 'Lee']],
    ['Neil Gaiman, and Terry Pratchett', def, ['Neil Gaiman', 'Terry Pratchett']],
    ['A; B', def, ['A', 'B']],
    ['A , B ;C& D', def, ['A', 'B', 'C', 'D']],
    // Guards: a single name containing "and" is never shattered.
    ['Daniels and Sons', def, ['Daniels and Sons']],
    ['William and Mary', def, ['William and Mary']],
    // Suffixes re-attach to the previous component.
    ['Martin Luther King, Jr.', def, ['Martin Luther King, Jr.']],
    ['Sammy Davis, Jr. and Frank Sinatra', def, ['Sammy Davis, Jr.', 'Frank Sinatra']],
    ["O'Reilly Media, Inc.", def, ["O'Reilly Media, Inc."]],
    // "et al" is dropped — but only once a separator has put it on its own.
    ['John Smith et al.', def, ['John Smith et al.']],
    ['John Smith, et al.', def, ['John Smith']],
    // Dedupe (first spelling wins) + whitespace hygiene.
    ['A, a', def, ['A']],
    ['  Ursula K. Le Guin  ', def, ['Ursula K. Le Guin']],
    ['', def, []],
    ['   ', def, []],
    // Separator configuration: comma off keeps "Last, First" whole...
    ['Tolkien, J.R.R.', seps({ amp: true, and: true }), ['Tolkien, J.R.R.']],
    // ...while & still splits.
    ['Gaiman & Pratchett', seps({ amp: true }), ['Gaiman', 'Pratchett']],
    // "and" disabled leaves full names joined by and alone.
    ['Neil Gaiman and Terry Pratchett', seps({ comma: true, semicolon: true, amp: true }), ['Neil Gaiman and Terry Pratchett']],
    // Everything disabled = verbatim single component.
    ['Gaiman & Pratchett', seps({}), ['Gaiman & Pratchett']],
    // Degenerate input is capped at 8 components.
    ['a1,b2,c3,d4,e5,f6,g7,h8,i9,j10', def, ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']],
  ]

  for (const [input, config, want] of cases) {
    it(`splits ${JSON.stringify(input)} into ${JSON.stringify(want)}`, () => {
      expect(splitCredits(input, config)).toEqual(want)
    })
  }

  // Not in the Go table because Go has no undefined: the JS signature defaults
  // the config, and every call site that omits it relies on that.
  it('defaults to every separator when given no config', () => {
    expect(splitCredits('Gaiman & Pratchett')).toEqual(['Gaiman', 'Pratchett'])
  })

  it('is Unicode-aware about whitespace, matching Go strings.Fields', () => {
    // Non-breaking space between the names — \s covers it in JS, unicode.IsSpace
    // covers it in Go. A credit pasted from a web page routinely contains one.
    // CAREFUL: the gaps in the two strings below are literal U+00A0 bytes, not
    // spaces, and they are invisible here. A whitespace tidy that "fixes" them
    // deletes the point of the test without changing what it looks like.
    expect(splitCredits('Neil Gaiman & Terry Pratchett')).toEqual(['Neil Gaiman', 'Terry Pratchett'])
    expect(splitCredits(' Ursula K. Le Guin ')).toEqual(['Ursula K. Le Guin'])
  })
})

describe('parseCreditSeps', () => {
  it('falls back to every separator when unset', () => {
    expect(parseCreditSeps('')).toEqual(def)
    expect(parseCreditSeps(null)).toEqual(def)
    expect(parseCreditSeps(undefined)).toEqual(def)
    expect(parseCreditSeps('   ')).toEqual(def)
  })

  it('reads "none" as splitting off entirely', () => {
    expect(parseCreditSeps('none')).toEqual(seps({}))
    expect(parseCreditSeps('NONE')).toEqual(seps({}))
  })

  it('reads a token list', () => {
    expect(parseCreditSeps('comma,amp')).toEqual(seps({ comma: true, amp: true }))
    expect(parseCreditSeps(' semicolon , and ')).toEqual(seps({ semicolon: true, and: true }))
  })

  // The distinction that matters: a list of tokens none of which are known is
  // indistinguishable from unset, and must NOT read as "everything off" —
  // that would silently stop splitting for anyone with a stale preference.
  it('falls back rather than disabling when no token is recognised', () => {
    expect(parseCreditSeps('pipe,slash')).toEqual(def)
  })

  it('keeps the recognised tokens when only some are known', () => {
    expect(parseCreditSeps('comma,pipe')).toEqual(seps({ comma: true }))
  })

  // The documented reason comma is switchable at all: a library that stores
  // authors as "Last, First" must be able to stop the split.
  it('round-trips into splitCredits for the "Last, First" library', () => {
    const config = parseCreditSeps('semicolon,amp,and')
    expect(splitCredits('Tolkien, J.R.R.', config)).toEqual(['Tolkien, J.R.R.'])
  })
})
