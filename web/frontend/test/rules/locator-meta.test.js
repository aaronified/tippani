// WHERE IN THE BOOK, AND ONE ANSWER RATHER THAN TWO.
//
// THE OWNER, from their own phone: "the book annotations in the book details
// view do not need to show page number if chapter details are available. think
// through all cases like that." So a named chapter suppresses the page, and the
// pair stops being composed on four screens by four different hands.
//
// THE FOUR DISAGREED IN THREE WAYS, and every one of them is a case below:
//
//   · Library drew `CH. {chapterLabel}` — the prefix on a NAME as well as a
//     number, which is the exact thing `chapterMeta` was written to stop. Its
//     comment claimed it had ("Library's own meta line… stops disagreeing with
//     Home and the quiz"); it never did.
//   · Library printed `P.{n}` while Home and the recall card printed `P. {n}`,
//     out of two locale keys that differed by one space.
//   · `chapterMeta` spelled "CH." as a LITERAL in a module that imports nothing,
//     so one row was captioned in English on Home and in the reader's own
//     language on the book page.
//
// The last of those is why this lives in attribution.js and not text.js: a
// caption is vocabulary, and text.js has no imports on purpose.
import { describe, expect, it } from 'vitest'

import { locatorMeta } from '../../src/attribution.js'
import { readSource, sourcesUnder } from '../src-files.js'

describe('locatorMeta — the chapter beats the page', () => {
  // THE REPORTED CASE, and the one everything else is in service of.
  it('drops the page when a chapter names the place', () => {
    expect(locatorMeta({ chapter_no: 4, chapter: '', location: '112' })).toBe('CH. 4')
    expect(locatorMeta({ chapter_no: 4, chapter: 'The Wanderer', location: '112' }))
      .toBe('CH. 4 · The Wanderer')
  })

  // A NAME COUNTS AS A CHAPTER. "Envoi · P. 112" is the same redundancy with
  // the durable half spelled differently, so the rule reads chapterLabel rather
  // than chapter_no.
  it('a chapter with only a name still beats the page', () => {
    expect(locatorMeta({ chapter: 'Envoi', location: '112' })).toBe('Envoi')
  })

  it('keeps the page where there is no chapter, because it is all there is', () => {
    expect(locatorMeta({ location: '112' })).toBe('P. 112')
    expect(locatorMeta({ chapter_no: 0, chapter: '   ', location: '112' })).toBe('P. 112')
  })

  // THE PREFIX ON A NUMBER ONLY — chapterMeta's rule, kept. "CH. Envoi" reads as
  // somebody who did not know what was in the field.
  it('prefixes CH. onto a number and never onto a name', () => {
    expect(locatorMeta({ chapter_no: 7, chapter: '' })).toBe('CH. 7')
    expect(locatorMeta({ chapter_no: 0, chapter: 'Envoi' })).toBe('Envoi')
  })

  it('says nothing when the row records neither, so a caller can join it in blind', () => {
    expect(locatorMeta({})).toBe('')
    expect(locatorMeta(null)).toBe('')
    expect(locatorMeta({ chapter: '', location: '' })).toBe('')
  })

  // `location` IS FREE TEXT — the column's own comment says so ("free text
  // page/loc/%"), because a Kindle position and a percentage both live in it.
  // So it is trimmed and printed, never parsed as a number.
  it('prints a locator that is not a page number at all', () => {
    expect(locatorMeta({ location: 'loc. 2451' })).toBe('P. loc. 2451')
    expect(locatorMeta({ location: '  63%  ' })).toBe('P. 63%')
  })
})

// AND THE ANCHOR: one function, or this is four functions again in a month.
//
// A SOURCE SCAN, deliberately. The cases above would all pass on a tree where
// Library had quietly gone back to composing the pair itself — they test the
// function, not who calls it, and "who calls it" is the entire defect this
// commit is about. So the two captions are held to one module.
describe('nothing else captions a chapter or a page', () => {
  // THROUGH THE ONE WALK (test/src-files.js), which recurses and throws rather
  // than returning a short list: a guard whose walk finds nothing reports no
  // violations and means nothing, and two guards in this suite were found silent
  // that way. It also reaches a nested folder, which a hand-rolled readdir of
  // `src` does not — the first draft of this file was that readdir.
  const files = sourcesUnder()

  for (const key of ['common.locator.chapter.label', 'common.locator.page.label']) {
    it(`only attribution.js reads ${key}`, () => {
      const guilty = files.filter((rel) => {
        if (rel === 'attribution.js') return false
        // Comments may name the key — text.js's tombstone does — so a line that
        // is a comment is not a caller. Crude but exact for this repo's style:
        // every real call is `t('<key>'` on a line of code.
        return readSource(rel)
          .split('\n')
          .some((ln) => !ln.trimStart().startsWith('//') && ln.includes(`t('${key}'`))
      })
      expect(guilty, 'these compose the locator themselves instead of calling locatorMeta')
        .toEqual([])
    })
  }

  // The retired helper must not come back: it is the same rule minus the page
  // and minus the translation, which is how the four spellings started.
  it('chapterMeta is gone from text.js rather than kept beside it', () => {
    expect(/export function chapterMeta\b/.test(readSource('text.js'))).toBe(false)
  })
})
