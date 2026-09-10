// A book's chapter is two columns, and choosing either fills the other.
//
// THE OWNER REVERSED THE DIRECTION THIS SHIPPED WITH: "chapter number auto
// populates from chapter name now, but not vice versa. chapter name from number is
// more useful." So both directions run — and the reliability the old one-way rule
// was protecting is bought back by never overwriting anything typed.
import { describe, expect, it } from 'vitest'
import { chapterPatch } from '../../src/text.js'

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
    expect(chapterPatch('no', '42', '', POOL)).toEqual({ chapter_no: '42', chapter: 'The Whale' })
  })

  it('reads 42, 42.0 and a padded 42 as one chapter', () => {
    // The column is a REAL (0044, so 12.5 is where an interlude goes), and a
    // string compare would offer the name for one spelling of the number and not
    // the others — which reads as the feature working intermittently.
    for (const typed of ['42', '42.0', ' 42 ']) {
      expect(chapterPatch('no', typed, '', POOL).chapter, typed).toBe('The Whale')
    }
  })

  it('says nothing about a number it has never seen', () => {
    expect(chapterPatch('no', '99', '', POOL)).toEqual({ chapter_no: '99' })
  })

  it('says nothing while the box is empty or half-typed', () => {
    // A reader clearing the box must not be handed a name, and a lone "." on the
    // way to "4.5" is not a chapter.
    expect(chapterPatch('no', '', '', POOL)).toEqual({ chapter_no: '' })
    expect(chapterPatch('no', '.', '', POOL)).toEqual({ chapter_no: '.' })
  })
})

describe('the direction that already worked', () => {
  it('fills the number from the name', () => {
    expect(chapterPatch('name', 'The Whale', '', POOL)).toEqual({ chapter: 'The Whale', chapter_no: '42' })
  })

  it('matches a name whatever case it is typed in', () => {
    expect(chapterPatch('name', 'the whale', '', POOL).chapter_no).toBe('42')
    expect(chapterPatch('name', '  The Whale  ', '', POOL).chapter_no).toBe('42')
  })

  it('prefers the spelling actually used over a one-off typo of it', () => {
    // Two rows fold to "the whale": 42 nine times, 7 once. The pool arrives
    // commonest-first, so first-match IS most-used, and a typo sinks rather than
    // sitting next to the real answer.
    expect(chapterPatch('name', 'The Whale', '', POOL).chapter_no).toBe('42')
  })

  it('says nothing about a name it has never seen', () => {
    expect(chapterPatch('name', 'A new chapter', '', POOL)).toEqual({ chapter: 'A new chapter' })
  })
})

describe('what a reader has typed always wins', () => {
  // The failure this rule exists to prevent: you type 7, then pick a chapter name
  // to save typing, and the 7 silently becomes 42 — you would not notice until the
  // quote was filed under the wrong chapter, and nothing would record that the app
  // had done it.
  it('never overwrites a number that is already there', () => {
    expect(chapterPatch('name', 'The Whale', '7', POOL)).toEqual({ chapter: 'The Whale' })
  })

  it('never overwrites a name that is already there', () => {
    expect(chapterPatch('no', '42', 'My own name for it', POOL)).toEqual({ chapter_no: '42' })
  })

  // An empty counterpart is what a fill is FOR, and whitespace is empty: a box
  // holding a stray space is a box the reader has not answered.
  it('treats a counterpart of only spaces as empty', () => {
    expect(chapterPatch('no', '42', '   ', POOL).chapter).toBe('The Whale')
    expect(chapterPatch('name', 'The Whale', '  ', POOL).chapter_no).toBe('42')
  })
})

describe('a book with nothing recorded yet', () => {
  it('still hands back what was typed, from an empty or missing pool', () => {
    // The first highlight in a book has no pool at all, and a form that threw
    // there would be a form that only works on books you have already used.
    for (const pool of [[], null, undefined]) {
      expect(chapterPatch('no', '42', '', pool)).toEqual({ chapter_no: '42' })
      expect(chapterPatch('name', 'One', '', pool)).toEqual({ chapter: 'One' })
    }
  })

  it('ignores a pool row missing the half it would donate', () => {
    // `GET /books/{id}/chapters` returns a row when EITHER column is filled, so a
    // numbered chapter with no name and a named chapter with no number are both
    // normal — and neither has anything to give.
    const half = [{ no: 5, name: '', count: 3 }, { no: 0, name: 'Untitled', count: 2 }]
    expect(chapterPatch('no', '5', '', half)).toEqual({ chapter_no: '5' })
    expect(chapterPatch('name', 'Untitled', '', half)).toEqual({ chapter: 'Untitled' })
  })
})
