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
    // ...and without any list separator, the guard still holds.
    // (That sentence and this row used to be a separate it() below, the
    // deliberate converse of 'lets a semicolon or ampersand unlock short-name
    // "and" splitting'. It asserted this row's call character for character —
    // same input, same `def`, same expected array — so it was folded back into
    // the row it duplicated. The converse still reads: with a list separator,
    // three names; without one, one firm.)
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

  // One test over all 23 rows rather than one it() minted per row: the assertion
  // is identical for every case and only the data differs, so comparing the whole
  // column in a single toEqual names EVERY row that disagrees with Go instead of
  // dying on the first. The table above has not moved — it is still the Go port,
  // case for case and in the same order, and adding a case there still adds it
  // here. (Two rows are both 'Gaiman & Pratchett' and differ only in `config`;
  // as separate it() blocks they reported under identical titles.)
  it('matches the Go table case for case', () => {
    const label = (input, i) => `#${i + 1} ${JSON.stringify(input)}`
    const got = cases.map(([input, config], i) => [label(input, i), splitCredits(input, config)])
    const want = cases.map(([input, , expected], i) => [label(input, i), expected])
    expect(got).toEqual(want)
  })
})

