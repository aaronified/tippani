// text.js — the string primitives shared by the People console and the search
// box's facet dropdown.
//
// editDistance had no test at all while it lived inside MetadataPage.jsx: it was
// a module-private function, so the only way to reach it was to render the whole
// Metadata screen and read the near-duplicate cards it produced. Lifting it out
// is what makes these assertions possible, and they are the point of the lift —
// a second caller is about to depend on the exact numbers.

import { describe, expect, it } from 'vitest'
import { editBudget, editDistance, foldText } from '../../src/text.js'

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('', '')).toBe(0)
    expect(editDistance('gaiman', 'gaiman')).toBe(0)
  })

  it('costs one per insertion, deletion and substitution', () => {
    expect(editDistance('stoicism', 'stoicsm')).toBe(1) // deletion
    expect(editDistance('stoicism', 'stoicismm')).toBe(1) // insertion
    expect(editDistance('stoicism', 'stoicisn')).toBe(1) // substitution
  })

  // A transposition is TWO edits under plain Levenshtein, not one
  // (Damerau-Levenshtein would say one). The dropdown's budget is written
  // against this number, so it is asserted rather than assumed.
  it('charges two for a transposition', () => {
    expect(editDistance('stoicism', 'stoicsim')).toBe(2)
  })

  it('falls back to the other string length when one side is empty', () => {
    expect(editDistance('', 'death')).toBe(5)
    expect(editDistance('death', '')).toBe(5)
  })

  it('is symmetric', () => {
    expect(editDistance('dostoyevsky', 'dostoevsky')).toBe(editDistance('dostoevsky', 'dostoyevsky'))
  })

  // The case the People console was written for, kept here so the lift is
  // provably behaviour-preserving: two transliterations of one Russian name.
  it('keeps the two Dostoyevskys one edit apart', () => {
    expect(editDistance('fyodor dostoyevsky', 'fyodor dostoevsky')).toBe(1)
  })

  // And the case its length guard exists for: short distinct names must stay
  // far enough apart in RELATIVE terms, which is the caller's job, but the raw
  // distance has to be small or the caller never gets the chance to reject it.
  it('reports one edit between Poe and Roe, leaving the ratio guard to reject it', () => {
    expect(editDistance('poe', 'roe')).toBe(1)
  })

  it('compares by code unit, so it is script-agnostic', () => {
    expect(editDistance('স্টোইক', 'স্টোইক')).toBe(0)
    expect(editDistance('कर्म', 'कर्मा')).toBe(1)
  })
})

describe('foldText', () => {
  it('lowercases and strips diacritics', () => {
    expect(foldText('Le Guin')).toBe('le guin')
    expect(foldText('Émile Zola')).toBe('emile zola')
    expect(foldText('Ursula K. Le Guin')).toBe('ursula k. le guin')
  })

  it('trims but does not collapse inner spacing', () => {
    expect(foldText('  stoicism  ')).toBe('stoicism')
  })

  it('survives null and undefined', () => {
    expect(foldText(null)).toBe('')
    expect(foldText(undefined)).toBe('')
    expect(foldText('')).toBe('')
  })

  // THE REASON THIS FUNCTION EXISTS RATHER THAN normName. normName drops
  // everything outside [a-z0-9], so every one of these folds to "" — and a
  // dropdown filtering on "" matches every option equally, which is the same as
  // not filtering at all. A reader whose tags are in Bengali would have got an
  // unusable typeahead.
  it('keeps non-Latin scripts rather than folding them away', () => {
    expect(foldText('স্টোইক')).toBe('স্টোইক')
    expect(foldText('黒澤明')).toBe('黒澤明')
    expect(foldText('कर्म')).toBe('कर्म')
  })

  // The NFC round trip, pinned by length rather than by eye. Without it these
  // come back as decomposed sequences that RENDER identically and compare
  // unequal — the failure mode that survives code review because the diff looks
  // the same on both sides.
  it('returns composed characters, not decomposed look-alikes', () => {
    expect(foldText('স্টোইক')).toHaveLength('স্টোইক'.length)
    expect(foldText('কর্মা')).toHaveLength('কর্মা'.length)
  })

  // What it DOES fold outside Latin: the U+0300–U+036F combining marks that
  // Greek and Cyrillic also use. This is deliberate and is the same forgiveness
  // é→e buys — but it is a real behaviour with a real cost (Cyrillic и and й are
  // different letters), so it is asserted rather than left to be discovered.
  it('folds the accents Greek and Cyrillic share with Latin', () => {
    expect(foldText('Толстой')).toBe('толстои')
    expect(foldText('Καβάφης')).toBe('καβαφης')
  })

  // Punctuation is KEPT, unlike normName. "j.r.r" is a prefix a reader can
  // usefully type, and folding the dots away would make "jrr" the only spelling
  // that matched — the opposite of forgiving.
  it('keeps punctuation', () => {
    expect(foldText('J.R.R. Tolkien')).toBe('j.r.r. tolkien')
  })
})

describe('editBudget', () => {
  // Mirrors budgetFor in internal/search/levenshtein.go. If that table changes,
  // this one changes with it — the reader is promised one behaviour, not two.
  // One test over all eight lengths rather than three tier-named ones: every
  // case is the same call and the same matcher, only the length and the budget
  // differ, and as one table it reads as the mirror of the Go table it is. The
  // single toEqual over collected pairs names every tier that drifted at once.
  it('forgives nothing under three characters, one from three to five, two beyond five', () => {
    const table = [
      // forgives nothing under three characters
      [0, 0],
      [1, 0],
      [2, 0],
      // forgives one edit from three to five characters
      [3, 1],
      [4, 1],
      [5, 1],
      // forgives two edits beyond five characters
      [6, 2],
      [40, 2],
    ]
    expect(table.map(([n]) => [n, editBudget(n)])).toEqual(table)
  })
})
