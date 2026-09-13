// ONE BAND ORDER, FOR EVERY ANNOTATION CARD IN THE APP.
//
// THE OWNER SETTLED IT AS A TABLE, and their closing sentence is why this file
// exists rather than a comment: "this shape will be adhered for all annotation
// cards across the app."
//
//   1  the body        the quote and its translation, both separately expandable
//   2  the person chip author / speaker / character, whichever the kind has
//   3  the attribution the kind's own phrase
//   4  the note
//   5  the tag row
//   6  the action row
//
// WHAT WENT WRONG. `AnnotationCard` (Library.jsx) has drawn that order since the
// shape was settled. `Frame` (Movies.jsx) drew the translation AFTER the chips,
// the credit row and the tag row — so a bilingual film line read the words, who
// said them, where, its tags, and only then what the words mean.
//
// AND IT DID SO UNDER A COMMENT CITING THE OTHER CARD: "Above the pasted note,
// for the reason AnnotationCard gives." That reason is about the note. It says
// nothing about the tags, and the card it cites puts the translation directly
// under the words. A rule cited rather than called is a rule with two readings —
// the same shape that put a hand-written credit in `Home.jsx` and in the search
// results row, both under comments naming the function they were not calling.
//
// SO THE CASES BELOW ASSERT THE ORDER, NOT EITHER CARD. A test that checked only
// the film card would have passed for the release in which it was wrong, because
// the film card was self-consistent; what it was not was the same as its twin.
// This reads the two sources and compares the positions they draw things in.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8')

// The marker each band leaves in the JSX, per card. Deliberately the RENDERED
// element rather than a class name: a class can be moved without moving what it
// wraps, and it is the reading order that is under test.
const BANDS = ['body', 'translation', 'chips', 'attribution', 'note', 'tags', 'actions']

const MARKERS = {
  'AnnotationCard': {
    file: 'Library.jsx',
    from: 'export function AnnotationCard(',
    body: '<ExpandableText',
    translation: '<TranslationLine',
    chips: '{chips}',
    attribution: '{metaLine && <MonoLabel',
    note: '<HandNote>',
    tags: '<TagChip',
    actions: '<ActionRow',
  },
  'Frame': {
    file: 'Movies.jsx',
    from: 'function Frame(',
    body: '<ExpandableText',
    translation: '<TranslationLine',
    chips: '<SpeakerChips',
    attribution: '{creditParts.map(',
    note: '<HandNote',
    tags: '<TagChip',
    actions: '<ActionRow',
  },
}

// Where each band appears in a card's source, as an index into the file.
function positions(name) {
  const m = MARKERS[name]
  const whole = src(m.file)
  const start = whole.indexOf(m.from)
  expect(start, `${name} not found in ${m.file}`).toBeGreaterThan(-1)
  const body = whole.slice(start)
  return Object.fromEntries(BANDS.map((band) => {
    const at = body.indexOf(m[band])
    expect(at, `${name} draws no ${band} (looked for ${m[band]})`).toBeGreaterThan(-1)
    return [band, at]
  }))
}

describe.each(Object.keys(MARKERS))('%s draws the settled band order', (card) => {
  const at = positions(card)
  // Each band after its predecessor. Named pairwise so a failure says WHICH two
  // are the wrong way round rather than that an array did not match.
  for (let i = 1; i < BANDS.length; i++) {
    const [before, after] = [BANDS[i - 1], BANDS[i]]
    it(`draws the ${before} above the ${after}`, () => {
      expect(at[after], `${card}: the ${after} is drawn above the ${before}`).toBeGreaterThan(at[before])
    })
  }
})

// AND THE TWO AGREE WITH EACH OTHER, which is the claim the owner's sentence
// actually makes. The cases above would both pass if the shared order were
// changed in one place and this file's BANDS list updated to match; this one says
// the two cards rank their bands identically, whatever that ranking is.
it('the book card and the film card rank their bands the same way', () => {
  const rank = (card) => {
    const at = positions(card)
    return [...BANDS].sort((a, b) => at[a] - at[b])
  }
  expect(rank('Frame')).toEqual(rank('AnnotationCard'))
})
