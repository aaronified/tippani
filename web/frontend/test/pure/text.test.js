import { describe, expect, it } from 'vitest'
import { chapterLabel, chapterPatch, editDistance, quoteTexts } from '../../src/text.js'
import { groupAnnotations } from '../../src/Library.jsx'

// text.js — the string primitives shared by the People console and the search
// box's facet dropdown.
//
// editDistance had no test at all while it lived inside MetadataPage.jsx: it was
// a module-private function, so the only way to reach it was to render the whole
// Metadata screen and read the near-duplicate cards it produced. Lifting it out
// is what makes these assertions possible, and they are the point of the lift —
// a second caller is about to depend on the exact numbers.
describe('text', () => {
  describe('editDistance', () => {
    // A transposition is TWO edits under plain Levenshtein, not one
    // (Damerau-Levenshtein would say one). The dropdown's budget is written
    // against this number, so it is asserted rather than assumed.
    // The case the People console was written for, kept here so the lift is
    // provably behaviour-preserving: two transliterations of one Russian name.
    it('keeps the two Dostoyevskys one edit apart', () => {
      expect(editDistance('fyodor dostoyevsky', 'fyodor dostoevsky')).toBe(1)
    })
  })

  // WHICH FACE EACH OF THE TWO TEXTS IS SET IN.
  //
  // The faces have been in Settings since the type dials shipped and nothing but the
  // wordmark ever wore one: a Bengali quote drew in the Latin text face, on the one
  // screen whose whole subject is somebody's own words. `scriptOf` existed, was
  // tested, and had no caller in the app at all — a seam this repo counts as a defect
  // in its own right.
  //
  // THE SCRIPT BELONGS TO THE QUOTE, NOT TO THE CARD. A quote's language is stored;
  // the language of the translation beside it is not, so only the slot holding
  // `a.quote` is tagged — and under "translations first" that is the SECOND line,
  // which is the case a render site computing this for itself would get wrong.
  describe('the face a quote is set in', () => {
    const bn = { quote: 'আমার সোনার বাংলা', translation: 'My golden Bengal', language: 'Bengali' }

    it('tags the quote and leaves the translation alone', () => {
      const { bodyScript, secondScript } = quoteTexts(bn, 'both')
      expect(bodyScript).toBe('bengali')
      expect(secondScript).toBe('')
    })
  })
})

// A CHAPTER'S HEADING SAYS WHICH CHAPTER IT IS.
//
// THE SPECIFICATION, `book-detail.dc.html:2555-2569`, in the pack's own words:
//
//   Named:   "CH 12: THE EXTRACTION OF THE MASTER…"  — the number and the name.
//   Unnamed: "CHAPTER 30"                            — the word, because a bare
//            number beside a rule reads as a figure, not a heading.
//   …
//   A section with no number is not a chapter — it is a named part of the book
//   (Epilogue, Afterword), so it is called by its name alone. "Ch Epilogue" says
//   nothing true.
//
// THREE CASES, and the board had two of them: a chapter with a number AND a name
// printed the name alone. That is the commonest chapter there is, and dropping
// the number takes the one thing that puts the groups in the order they are in —
// so a board grouped by chapter came out sorted by a number it never showed, and
// the ordering read as arbitrary.
//
// AND ONE CHAPTER IS ONE GROUP. A book saved over months has some of its quotes
// carrying the chapter's name and some carrying only its number; the heading is
// the chapter's, not the first row's.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above. Nothing here asserts a
// sentence — the labels are locale strings — only that the number and the name
// are both IN the heading, and which chapter each quote lands under.
describe('chapter headings', () => {
  const q = (id, chapter_no, chapter) => ({ id, chapter_no, chapter })
  const labels = (rows) => groupAnnotations(rows, 'chapter').map((g) => g.label)

  describe('a chapter heading on a grouped board', () => {
    it('is one group per chapter, however many of its quotes were given the name', () => {
      const groups = groupAnnotations([q(1, 7, ''), q(2, 7, 'The Duel'), q(3, 7, '')], 'chapter')
      expect(groups.length, 'one chapter came out as two groups').toBe(1)
      expect(groups[0].items.length).toBe(3)
      expect(groups[0].label, 'the group took the heading of whichever quote came first')
        .toContain('The Duel')
    })
  })
})

// A chapter's number and its name, printed as one thing.
//
// 0044 split `chapter` in two. Every display site went through one of two helpers
// rather than punctuating the pair itself, and these are the rules those helpers
// keep — including the one that matters most and is easiest to break silently: the
// string chapterLabel produces has to be BYTE-IDENTICAL to the "## " heading
// export_handlers.go writes, because the importer reads that heading back. A space
// added on one side of the middle dot here and not there would round-trip every
// chapter number into a chapter name, and nothing would fail.
describe('chapter label', () => {
  describe('chapterLabel', () => {
    // THE SEPARATOR IS THE ROUND TRIP. chapterHeading in export_handlers.go writes
    // this exact string and splitChapterHeading in markdown.go cuts on it; if this
    // assertion ever needs changing, those two need changing in the same commit.
    it('joins with a space, a middle dot and a space — the shape the importer cuts on', () => {
      expect(chapterLabel({ chapter_no: 7, chapter: 'The Fall' })).toContain(' · ')
      expect(chapterLabel({ chapter_no: 7, chapter: 'The Fall' }).split(' · ')).toEqual(['7', 'The Fall'])
    })
  })

  // chapterMeta's rule moved to `locatorMeta` (attribution.js) when the page
  // number joined it — see locator-meta.test.js, which keeps these three cases
  // plus the ones a caption alone could not have.
})

// A book's chapter is two columns, and choosing either fills the other.
//
// THE OWNER REVERSED THE DIRECTION THIS SHIPPED WITH: "chapter number auto
// populates from chapter name now, but not vice versa. chapter name from number is
// more useful." So both directions run — and the reliability the old one-way rule
// was protecting is bought back by never overwriting anything typed.
describe('chapter pair', () => {
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
})
