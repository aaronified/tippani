// A chapter's number and its name, printed as one thing.
//
// 0044 split `chapter` in two. Every display site went through one of two helpers
// rather than punctuating the pair itself, and these are the rules those helpers
// keep — including the one that matters most and is easiest to break silently: the
// string chapterLabel produces has to be BYTE-IDENTICAL to the "## " heading
// export_handlers.go writes, because the importer reads that heading back. A space
// added on one side of the middle dot here and not there would round-trip every
// chapter number into a chapter name, and nothing would fail.

import { describe, expect, it } from 'vitest'
import { chapterLabel } from '../../src/text.js'

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
