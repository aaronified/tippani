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
  it('carries the number and the name when the chapter has both', () => {
    const [label] = labels([q(1, 12, 'The Extraction of the Master')])
    expect(label, 'the heading dropped the name').toContain('The Extraction of the Master')
    expect(label, 'the heading dropped the number the board is ordered by').toMatch(/\b12\b/)
  })

  it('names a numbered chapter with no name by its number', () => {
    const [label] = labels([q(1, 30, '')])
    expect(label).toMatch(/\b30\b/)
  })

  it('calls a named section with no number by its name alone', () => {
    // An Epilogue is not chapter anything.
    const [label] = labels([q(1, null, 'Epilogue')])
    expect(label).toBe('Epilogue')
  })

  it('puts the chapters in reading order, with the unnumbered after them', () => {
    const groups = groupAnnotations(
      [q(1, 12, 'Twelve'), q(2, null, 'Zebra'), q(3, 2, 'Two'), q(4, null, 'Afterword')],
      'chapter',
    )
    const order = groups.map((g) => g.label)
    expect(order.findIndex((l) => /\bTwo\b/.test(l)), 'chapter 2 does not lead chapter 12')
      .toBeLessThan(order.findIndex((l) => /Twelve/.test(l)))
    expect(order.indexOf('Afterword'), 'a numbered chapter sorts after an unnumbered section')
      .toBeGreaterThan(order.findIndex((l) => /Twelve/.test(l)))
    // Two nulls in arrival order would put the same two headings in a different
    // order on every load — the pack says so in as many words.
    expect(order.indexOf('Afterword')).toBeLessThan(order.indexOf('Zebra'))
  })

  it('is one group per chapter, however many of its quotes were given the name', () => {
    const groups = groupAnnotations([q(1, 7, ''), q(2, 7, 'The Duel'), q(3, 7, '')], 'chapter')
    expect(groups.length, 'one chapter came out as two groups').toBe(1)
    expect(groups[0].items.length).toBe(3)
    expect(groups[0].label, 'the group took the heading of whichever quote came first')
      .toContain('The Duel')
  })

  it('and a quote with neither is not filed as chapter zero', () => {
    const groups = groupAnnotations([q(1, 4, 'Four'), q(2, null, '')], 'chapter')
    expect(groups.length).toBe(2)
    const last = groups[groups.length - 1]
    expect(last.residual, 'the quotes with no chapter did not sink to the end').toBe(true)
    expect(last.items.map((x) => x.id)).toEqual([2])
  })
})
