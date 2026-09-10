// WHAT A DUPLICATE CARRIES, pinned field by field.
//
// The menu row promises "the same note, tags, colour and locator", and a promise
// in a label is only as good as the mapping under it — this is that mapping. It
// is a pure function precisely so the promise can be checked without a screen.
//
// ONE CONVERSION IS LEFT, AND IT WAS TWO. A row's `chapter_no` is a number or
// null while every box holds a string — the kind of thing that "works" in a
// browser by coercion and then saves 0 for "no chapter". The other was `tags`:
// the old capture card kept them in a comma box so this joined the array, and the
// add-surface rework replaced that box with the token input the three edit forms
// have always used, which takes the array the row already carries.

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
  // SEEDED NOW, AND THEY WERE NOT. The old capture card had no translation, no
  // language and no sticker box, so seeding them would have put values in a draft
  // nothing could show — the add surface's rework gave every quote form all
  // three, and a duplicate that dropped the translation is a copy whose meaning
  // has to be retyped.
  translation: 'পাণ্ডুলিপি পোড়ে না।',
  language: 'Bengali',
  sticker_id: 3,
  // Still not seeded: a duplicate is a NEW quote, so it starts unfavourited and
  // with no id of its own.
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

  it('hands the tags over as the array the token input takes', () => {
    // It joined them into 'craft, fire' for as long as the form's box was a comma
    // input. That box is gone.
    expect(duplicateSeed(FULL).tags).toEqual(['craft', 'fire'])
  })

  it('carries the three texts the reworked form can show', () => {
    const s = duplicateSeed(FULL)
    expect(s.translation).toBe('পাণ্ডুলিপি পোড়ে না।')
    expect(s.language).toBe('Bengali')
    expect(s.sticker_id).toBe(3)
  })

  it('leaves a missing chapter number EMPTY rather than zero', () => {
    // A form field is a string. `String(null)` is "null" and `Number(null)` is 0,
    // and 0 is a real chapter — so "no chapter" has to arrive as no characters.
    expect(duplicateSeed({ ...FULL, chapter_no: null }).chapter_no).toBe('')
    expect(duplicateSeed({ ...FULL, chapter_no: 0 }).chapter_no).toBe('0')
  })

  it('seeds nothing the form cannot show, and nothing a new quote must not inherit', () => {
    const s = duplicateSeed(FULL)
    // `favorite` and `id` are the two that must never come across: a duplicate is
    // a new quote, so it starts unfavourited and unidentified. Anything else on
    // the row that the form has no box for is dropped for the original reason —
    // a value in a draft nothing can show is a value nothing will send.
    for (const k of ['favorite', 'id', 'id_of_something_else']) {
      expect(s, k).not.toHaveProperty(k)
    }
  })

  it('opens a blank-ish draft rather than throwing on a sparse row', () => {
    // Every field on an annotation is optional except the words, and a quote
    // saved from an import has most of them empty.
    const s = duplicateSeed({ quote: 'Just the words.' })
    expect(s.quote).toBe('Just the words.')
    expect(s.tags).toEqual([])
    expect(s.color).toBe('yellow') // the app's default, not an empty colour
    expect(s.note).toBe('')
    expect(s.translation).toBe('')
    expect(s.sticker_id).toBe(null)
  })
})
