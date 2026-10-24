// A book's chapter is two columns, and choosing either fills the other.
//
// THE OWNER REVERSED THE DIRECTION THIS SHIPPED WITH: "chapter number auto
// populates from chapter name now, but not vice versa. chapter name from number is
// more useful." So both directions run — and the reliability the old one-way rule
// was protecting is bought back by never overwriting anything typed.
import { describe, expect, it } from 'vitest'
import { chapterPatch } from '../../src/text.js'

const patchOf = (...args) => chapterPatch(...args).patch

// `GET /books/{id}/chapters` order: commonest first. "The Whale" is recorded nine
// times against 42; the last row is a one-off typo of it, which is exactly the
// shape that makes the tie-break matter.
const POOL = [
  { no: 42, name: 'The Whale', count: 9 },
  { no: 3, name: 'The Fall', count: 4 },
  { no: 7, name: 'the whale', count: 1 },
]

describe('the direction the owner asked for', () => {
  it('fills the name from the number', () => {
    expect(patchOf('no', '42', '', POOL)).toEqual({ chapter_no: '42', chapter: 'The Whale' })
  })
})

describe('what a reader has typed always wins', () => {
  // The failure this rule exists to prevent: you type 7, then pick a chapter name
  // to save typing, and the 7 silently becomes 42 — you would not notice until the
  // quote was filed under the wrong chapter, and nothing would record that the app
  // had done it.
  it('never overwrites a number that is already there', () => {
    expect(patchOf('name', 'The Whale', '7', POOL)).toEqual({ chapter: 'The Whale' })
  })
})

// ── the offer, and the two defects the owner found by typing ────────────────────
//
// Verbatim: "if i am at chapter 15, the chapter name is assigned at typing 1 and
// then no rewrites :) / should it not be assigned when the edit is complete (the
// typing cursor is moved)?"
//
// TWO DEFECTS IN ONE REPORT, and they compound. The rule ran on every keystroke,
// so `1` of `15` matched chapter one and filled its name; and never-clobber then
// made that permanent. The WHEN is fixed at the call site — `onCommit` on the
// combobox rather than `onChange`, tested in the DOM suite — and the DEAD END is
// fixed here: a disagreement returns an offer instead of silence.
