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
import { chapterLabel, chapterMeta } from '../../src/text.js'

describe('chapterLabel', () => {
  it('prints a number and a name as one string', () => {
    expect(chapterLabel({ chapter_no: 7, chapter: 'The Fall' })).toBe('7 · The Fall')
  })

  it('prints a number alone, which is most books', () => {
    expect(chapterLabel({ chapter_no: 7, chapter: '' })).toBe('7')
  })

  it('prints a name alone, which is essays and scripture', () => {
    expect(chapterLabel({ chapter_no: 0, chapter: 'Envoi' })).toBe('Envoi')
  })

  it('prints nothing when there is neither, so a caller can join it in blind', () => {
    expect(chapterLabel({ chapter_no: 0, chapter: '' })).toBe('')
    expect(chapterLabel({})).toBe('')
    expect(chapterLabel(null)).toBe('')
  })

  it('keeps a fraction, which is why the column is not an integer', () => {
    expect(chapterLabel({ chapter_no: 12.5, chapter: 'Interlude' })).toBe('12.5 · Interlude')
  })

  // A REAL column hands back 7 as 7, but a form hands back "7" — and a whole number
  // must never print as "7.0" or the heading stops matching the exporter's.
  it('never prints a trailing .0, whatever type it is given', () => {
    expect(chapterLabel({ chapter_no: 7.0, chapter: '' })).toBe('7')
    expect(chapterLabel({ chapter_no: '7', chapter: '' })).toBe('7')
    expect(chapterLabel({ chapter_no: '7.50', chapter: '' })).toBe('7.5')
  })

  it('trims the name, so a stray space cannot become part of the separator', () => {
    expect(chapterLabel({ chapter_no: 7, chapter: '  The Fall  ' })).toBe('7 · The Fall')
    expect(chapterLabel({ chapter_no: 0, chapter: '   ' })).toBe('')
  })

  // THE SEPARATOR IS THE ROUND TRIP. chapterHeading in export_handlers.go writes
  // this exact string and splitChapterHeading in markdown.go cuts on it; if this
  // assertion ever needs changing, those two need changing in the same commit.
  it('joins with a space, a middle dot and a space — the shape the importer cuts on', () => {
    expect(chapterLabel({ chapter_no: 7, chapter: 'The Fall' })).toContain(' · ')
    expect(chapterLabel({ chapter_no: 7, chapter: 'The Fall' }).split(' · ')).toEqual(['7', 'The Fall'])
  })
})

describe('chapterMeta — the card caption', () => {
  it('prefixes CH. when there is a number', () => {
    expect(chapterMeta({ chapter_no: 7, chapter: '' })).toBe('CH. 7')
    expect(chapterMeta({ chapter_no: 7, chapter: 'The Fall' })).toBe('CH. 7 · The Fall')
  })

  // The rule the three copies of `/^\d/.test(ch)` were reaching for: "CH. Envoi"
  // reads as a bug, so a name stands on its own.
  it('leaves a bare name unprefixed', () => {
    expect(chapterMeta({ chapter_no: 0, chapter: 'Envoi' })).toBe('Envoi')
  })

  it('says nothing when the chapter is empty', () => {
    expect(chapterMeta({ chapter_no: 0, chapter: '' })).toBe('')
    expect(chapterMeta(undefined)).toBe('')
  })
})
