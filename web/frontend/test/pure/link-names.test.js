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
// `TestMergeLinksKeepsTheReadersNames` (internal/httpapi/merge_links_test.go),
// beside the Go fold that replaced one splitting on whitespace, which shredded
// every name. rules/link-fold-keeps-names.test.js goes red if the server folds
// without that test, so the two cases cannot be lost again.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that `parseLinks`
// answers `{ known, extra, labels }` — providers by slug, the rest in order, and
// the names by URL.

import { describe, expect, it } from 'vitest'

import { linkLine, parseLinks } from '../../src/people.jsx'

const MINE = 'https://example.org/essays'

describe('writing one back', () => {
  it('round-trips through the one writer', () => {
    expect(parseLinks(linkLine(MINE, 'Their essays')).labels[MINE]).toBe('Their essays')
  })
})

