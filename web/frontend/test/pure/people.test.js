import { describe, expect, it } from 'vitest'
import { DEFAULT_CREDIT_SEPS, linkLine, parseCreditSeps, parseLinks, splitCredits } from '../../src/people.jsx'
import { remapLabels } from '../../src/MetadataPage.jsx'

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
describe('credits', () => {
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
})

// Which speaker labels the remap screen offers.
//
// A line spoken by two characters is stored as one string — "V, Evey" — and the
// screen offered that whole string as a single remappable row. Mapping an ensemble
// onto one cast member is not a thing, and the server would not have matched it
// anyway: it compared the whole stored label, so the mapping answered 200 having
// changed nothing. Both halves were the same bug.
//
// This is the client half, extracted from the fetch it used to be buried inside so
// that the rule can actually be checked.
describe('remap labels', () => {
  const seps = DEFAULT_CREDIT_SEPS
  const lines = (...chars) => chars.map((character) => ({ character }))
  const names = (out) => out.map((l) => l.name)

  describe('the remappable speaker labels', () => {
    it('counts LINES, so the number matches what a mapping will touch', () => {
      const out = remapLabels(lines('V', 'V, Evey', 'Evey', 'Finch'), seps)
      const by = Object.fromEntries(out.map((l) => [l.name, l.count]))
      expect(by).toEqual({ V: 2, Evey: 2, Finch: 1 })
    })

    it('splits on the comma, the semicolon and the ampersand', () => {
      const out = remapLabels(lines('V & Evey', 'Finch; Dominic'), seps)
      expect(names(out)).toEqual(['Dominic', 'Evey', 'Finch', 'V'])
    })
  })
})

// A LINK MAY CARRY A NAME, AND NAMING ONE MAY NOT COST ANOTHER.
//
// THE OWNER'S CHOICE, from the shapes they were offered for the ＋ on a record's
// Links: "'Add a link' takes a URL with an optional label."
//
// THE CONSTRAINT THAT DECIDES THE DESIGN. A record's links are ONE free-text
// field of newline-separated addresses, and the SAME field on a work, a person
// and a character. So a name per link either becomes a second thing stored beside
// each URL — a new column, a parallel list, a migration for everything already
// there, and a third meaning for a field two other screens read — or it goes in
// the field, in a way that reads every line already there exactly as it always
// did.
//
// WHY A PIPE AND NOT A SPACE. A space already means something here: this field
// has always whitespace-split, so `a.com b.com` on one line is TWO links and
// always was. Reading the second half as a name would quietly rename somebody's
// link. `|` has never been legal in an address and has never been written into
// this field, so a line carrying one is unambiguously new.
//
// WHAT THIS ASKS. That every stored field still reads the way it read before;
// that a name survives being written back through the one writer — that is where
// a name would be lost, and it would be lost silently and for good; and that a
// link with no name is unchanged in every particular, because that is every link
// in every library today.
//
// THE OTHER REWRITE MOVED TO THE SERVER IN 3.1.0. A metadata fetch folds the
// links it found into the stored field, and that fold was `mergeLinks` here until
// the People fetch became one request (`POST /people/id/{id}/fetch`) and a job
// that loops the same Go function. Its two cases — a fetch leaves the reader's
// names alone, and an unnamed link stays unnamed — went with it, verbatim, to
// `TestMergeLinksKeepsTheReadersNames` (internal/httpapi/merge_test.go),
// beside the Go fold that replaced one splitting on whitespace, which shredded
// every name. rules/link-fold-keeps-names.test.js goes red if the server folds
// without that test, so the two cases cannot be lost again.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that `parseLinks`
// answers `{ known, extra, labels }` — providers by slug, the rest in order, and
// the names by URL.
describe('link names', () => {
  const MINE = 'https://example.org/essays'

  describe('writing one back', () => {
    it('round-trips through the one writer', () => {
      expect(parseLinks(linkLine(MINE, 'Their essays')).labels[MINE]).toBe('Their essays')
    })
  })
})
