// text.js — the string primitives shared by the People console and the search
// box's facet dropdown.
//
// editDistance had no test at all while it lived inside MetadataPage.jsx: it was
// a module-private function, so the only way to reach it was to render the whole
// Metadata screen and read the near-duplicate cards it produced. Lifting it out
// is what makes these assertions possible, and they are the point of the lift —
// a second caller is about to depend on the exact numbers.

import { describe, expect, it } from 'vitest'
import { editDistance, quoteTexts } from '../../src/text.js'

describe('editDistance', () => {
  // A transposition is TWO edits under plain Levenshtein, not one
  // (Damerau-Levenshtein would say one). The dropdown's budget is written
  // against this number, so it is asserted rather than assumed.
  // The case the People console was written for, kept here so the lift is
  // provably behaviour-preserving: two transliterations of one Russian name.
  it('keeps the two Dostoyevskys one edit apart', () => {
    expect(editDistance('fyodor dostoyevsky', 'fyodor dostoevsky')).toBe(1)
  })
})

// WHICH FACE EACH OF THE TWO TEXTS IS SET IN.
//
// The faces have been in Settings since the type dials shipped and nothing but the
// wordmark ever wore one: a Bengali quote drew in the Latin text face, on the one
// screen whose whole subject is somebody's own words. `scriptOf` existed, was
// tested, and had no caller in the app at all — a seam this repo counts as a defect
// in its own right.
//
// THE SCRIPT BELONGS TO THE QUOTE, NOT TO THE CARD. A quote's language is stored;
// the language of the translation beside it is not, so only the slot holding
// `a.quote` is tagged — and under "translations first" that is the SECOND line,
// which is the case a render site computing this for itself would get wrong.
describe('the face a quote is set in', () => {
  const bn = { quote: 'আমার সোনার বাংলা', translation: 'My golden Bengal', language: 'Bengali' }

  it('tags the quote and leaves the translation alone', () => {
    const { bodyScript, secondScript } = quoteTexts(bn, 'both')
    expect(bodyScript).toBe('bengali')
    expect(secondScript).toBe('')
  })
})
