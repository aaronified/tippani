// A book's chapter is two columns, and choosing either fills the other.
//
// THE OWNER REVERSED THE DIRECTION THIS SHIPPED WITH: "chapter number auto
// populates from chapter name now, but not vice versa. chapter name from number is
// more useful." So both directions run — and the reliability the old one-way rule
// was protecting is bought back by never overwriting anything typed.
import { describe, expect, it } from 'vitest'
import { chapterPatch } from '../../src/text.js'

// `chapterPatch` returns { patch, offer } since the owner found the dead end that
// never-clobber creates on its own. `patch` is what these cases were always about;
// `offer` gets its own describe block at the foot of the file.
const patchOf = (...args) => chapterPatch(...args).patch
const offerOf = (...args) => chapterPatch(...args).offer

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

  it('reads 42, 42.0 and a padded 42 as one chapter', () => {
    // The column is a REAL (0044, so 12.5 is where an interlude goes), and a
    // string compare would offer the name for one spelling of the number and not
    // the others — which reads as the feature working intermittently.
    for (const typed of ['42', '42.0', ' 42 ']) {
      expect(patchOf('no', typed, '', POOL).chapter, typed).toBe('The Whale')
    }
  })

  it('says nothing about a number it has never seen', () => {
    expect(patchOf('no', '99', '', POOL)).toEqual({ chapter_no: '99' })
  })

  it('says nothing while the box is empty or half-typed', () => {
    // A reader clearing the box must not be handed a name, and a lone "." on the
    // way to "4.5" is not a chapter.
    expect(patchOf('no', '', '', POOL)).toEqual({ chapter_no: '' })
    expect(patchOf('no', '.', '', POOL)).toEqual({ chapter_no: '.' })
  })
})

describe('the direction that already worked', () => {
  it('fills the number from the name', () => {
    expect(patchOf('name', 'The Whale', '', POOL)).toEqual({ chapter: 'The Whale', chapter_no: '42' })
  })

  it('matches a name whatever case it is typed in', () => {
    expect(patchOf('name', 'the whale', '', POOL).chapter_no).toBe('42')
    expect(patchOf('name', '  The Whale  ', '', POOL).chapter_no).toBe('42')
  })

  it('prefers the spelling actually used over a one-off typo of it', () => {
    // Two rows fold to "the whale": 42 nine times, 7 once. The pool arrives
    // commonest-first, so first-match IS most-used, and a typo sinks rather than
    // sitting next to the real answer.
    expect(patchOf('name', 'The Whale', '', POOL).chapter_no).toBe('42')
  })

  it('says nothing about a name it has never seen', () => {
    expect(patchOf('name', 'A new chapter', '', POOL)).toEqual({ chapter: 'A new chapter' })
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

  it('never overwrites a name that is already there', () => {
    expect(patchOf('no', '42', 'My own name for it', POOL)).toEqual({ chapter_no: '42' })
  })

  // An empty counterpart is what a fill is FOR, and whitespace is empty: a box
  // holding a stray space is a box the reader has not answered.
  it('treats a counterpart of only spaces as empty', () => {
    expect(patchOf('no', '42', '   ', POOL).chapter).toBe('The Whale')
    expect(patchOf('name', 'The Whale', '  ', POOL).chapter_no).toBe('42')
  })
})

describe('a book with nothing recorded yet', () => {
  it('still hands back what was typed, from an empty or missing pool', () => {
    // The first highlight in a book has no pool at all, and a form that threw
    // there would be a form that only works on books you have already used.
    for (const pool of [[], null, undefined]) {
      expect(patchOf('no', '42', '', pool)).toEqual({ chapter_no: '42' })
      expect(patchOf('name', 'One', '', pool)).toEqual({ chapter: 'One' })
    }
  })

  it('ignores a pool row missing the half it would donate', () => {
    // `GET /books/{id}/chapters` returns a row when EITHER column is filled, so a
    // numbered chapter with no name and a named chapter with no number are both
    // normal — and neither has anything to give.
    const half = [{ no: 5, name: '', count: 3 }, { no: 0, name: 'Untitled', count: 2 }]
    expect(patchOf('no', '5', '', half)).toEqual({ chapter_no: '5' })
    expect(patchOf('name', 'Untitled', '', half)).toEqual({ chapter: 'Untitled' })
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
describe('what it offers when the pool disagrees', () => {
  it('offers the number when a name lands on a book that already has one', () => {
    // The reader typed 7 themselves. It is not touched.
    expect(patchOf('name', 'The Whale', '7', POOL)).toEqual({ chapter: 'The Whale' })
    expect(offerOf('name', 'The Whale', '7', POOL)).toEqual({ field: 'chapter_no', value: '42' })
  })

  it('offers the name when a number lands on a chapter that already has one', () => {
    expect(patchOf('no', '42', 'My own name for it', POOL)).toEqual({ chapter_no: '42' })
    expect(offerOf('no', '42', 'My own name for it', POOL)).toEqual({ field: 'chapter', value: 'The Whale' })
  })

  // SILENCE IS THE RIGHT FEEDBACK FOR "ALREADY RIGHT". A chip that changes nothing
  // teaches the reader to stop reading chips.
  it('says nothing when the counterpart already agrees', () => {
    expect(offerOf('no', '42', 'The Whale', POOL)).toBeNull()
    expect(offerOf('name', 'The Whale', '42', POOL)).toBeNull()
  })

  // 42 and "42.0" are one chapter. Comparing as strings would offer a chip that
  // replaces a number with the same number spelled differently.
  it('and compares numbers as numbers before deciding they disagree', () => {
    expect(offerOf('name', 'The Whale', '42.0', POOL)).toBeNull()
    expect(offerOf('name', 'The Whale', ' 42 ', POOL)).toBeNull()
  })

  // Case and surrounding space are not a disagreement either.
  it('and folds case on the name before deciding', () => {
    expect(offerOf('no', '42', 'the whale', POOL)).toBeNull()
    expect(offerOf('no', '42', '  The Whale  ', POOL)).toBeNull()
  })

  // A fill and an offer answer the same question, so exactly one of them happens.
  it('never fills and offers at once', () => {
    for (const [which, typed, current] of [
      ['no', '42', ''], ['no', '42', 'Something else'], ['no', '99', ''],
      ['name', 'The Whale', ''], ['name', 'The Whale', '7'], ['name', 'Nothing', ''],
    ]) {
      const { patch, offer } = chapterPatch(which, typed, current, POOL)
      const filled = which === 'no' ? patch.chapter !== undefined : patch.chapter_no !== undefined
      expect(filled && offer !== null, `${which} "${typed}" over "${current}"`).toBe(false)
    }
  })

  // Nothing in the pool means nothing to offer — the box is free text and stays so.
  it('offers nothing for a value the pool has never seen', () => {
    expect(offerOf('no', '99', 'A name', POOL)).toBeNull()
    expect(offerOf('name', 'A chapter nobody recorded', '7', POOL)).toBeNull()
  })

  // THE OWNER'S EXACT SEQUENCE, as the pure rule sees it. Committing "15" with the
  // name box EMPTY is the whole point of the timing fix: the pairing is asked once,
  // about the number they actually meant.
  it('answers about 15 rather than about 1, once the edit is complete', () => {
    const pool = [
      { no: 1, name: 'Loomings', count: 9 },
      { no: 15, name: 'Chowder', count: 4 },
    ]
    // What the old per-keystroke rule did, stated so it cannot come back: the
    // intermediate value is a real chapter and its name is a confident wrong answer.
    expect(patchOf('no', '1', '', pool)).toEqual({ chapter_no: '1', chapter: 'Loomings' })
    // What one commit of the finished value does.
    expect(patchOf('no', '15', '', pool)).toEqual({ chapter_no: '15', chapter: 'Chowder' })
    // And if the intermediate DID get committed — tab away at 1, come back, edit to
    // 15 — the name is not clobbered and the chip offers the way out. That is the
    // half that used to be a dead end.
    expect(patchOf('no', '15', 'Loomings', pool)).toEqual({ chapter_no: '15' })
    expect(offerOf('no', '15', 'Loomings', pool)).toEqual({ field: 'chapter', value: 'Chowder' })
  })
})
