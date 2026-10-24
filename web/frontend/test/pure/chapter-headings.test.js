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

import { describe, expect, it } from 'vitest'

import { groupAnnotations } from '../../src/Library.jsx'

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
