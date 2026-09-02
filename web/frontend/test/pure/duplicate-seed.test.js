// WHAT A DUPLICATE CARRIES, pinned field by field.
//
// The menu row promises "the same note, tags, colour and locator", and a promise
// in a label is only as good as the mapping under it — this is that mapping. It
// is a pure function precisely so the promise can be checked without a screen.
//
// TWO CONVERSIONS ARE THE WHOLE REASON IT EXISTS: a row's `tags` is an array and
// the form's box is a comma string, and a row's `chapter_no` is a number or null
// while every box holds a string. Both are the kind of thing that "works" in a
// browser by coercion and then saves 0 for "no chapter".

import { describe, expect, it } from 'vitest'
import { duplicateSeed } from '../../src/Library.jsx'

const FULL = {
  id: 7,
  quote: 'Manuscripts don’t burn.',
  note: 'Woland, to the Master.',
  chapter: 'Chapter Twenty-Four',
  chapter_no: 24,
  location: 'p.402',
  character: 'Woland',
  color: 'blue',
  tags: ['craft', 'fire'],
  // Not seeded, and deliberately: the capture form has no box for any of them,
  // so a value here would sit in a draft nothing can show and nothing will send.
  translation: 'পাণ্ডুলিপি পোড়ে না।',
  sticker_id: 3,
  favorite: 1,
  id_of_something_else: 99,
}

describe('the draft a duplicate opens on', () => {
  it('carries what the menu row promises', () => {
    const s = duplicateSeed(FULL)
    expect(s.note).toBe('Woland, to the Master.')
    expect(s.color).toBe('blue')
    expect(s.chapter).toBe('Chapter Twenty-Four')
    expect(s.location).toBe('p.402')
    expect(s.character).toBe('Woland')
  })

  it('carries the words too, because a clause is what usually changes', () => {
    // The pack's own reason: "the reader is usually keeping most of a sentence and
    // changing a clause, so an empty box would be a worse start than a full one."
    expect(duplicateSeed(FULL).quote).toBe('Manuscripts don’t burn.')
  })

  it('turns the tag array into the string the box holds', () => {
    expect(duplicateSeed(FULL).tags).toBe('craft, fire')
  })

  it('leaves a missing chapter number EMPTY rather than zero', () => {
    // A form field is a string. `String(null)` is "null" and `Number(null)` is 0,
    // and 0 is a real chapter — so "no chapter" has to arrive as no characters.
    expect(duplicateSeed({ ...FULL, chapter_no: null }).chapter_no).toBe('')
    expect(duplicateSeed({ ...FULL, chapter_no: 0 }).chapter_no).toBe('0')
  })

  it('seeds nothing the form cannot show', () => {
    const s = duplicateSeed(FULL)
    for (const k of ['translation', 'sticker_id', 'favorite', 'id']) {
      expect(s, k).not.toHaveProperty(k)
    }
  })

  it('opens a blank-ish draft rather than throwing on a sparse row', () => {
    // Every field on an annotation is optional except the words, and a quote
    // saved from an import has most of them empty.
    const s = duplicateSeed({ quote: 'Just the words.' })
    expect(s.quote).toBe('Just the words.')
    expect(s.tags).toBe('')
    expect(s.color).toBe('yellow') // the app's default, not an empty colour
    expect(s.note).toBe('')
  })
})
