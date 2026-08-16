// capitalizeNames — the promote-only rule behind every name and title field.
//
// The reason this is its own function rather than a reuse of titleCaseGenre is
// the whole test file: a genre comes from a small vocabulary and can be safely
// re-cased end to end, and a name cannot. "McDonald" and "O'Brien" are correct
// as typed, and a title-caser that lower-cases the rest of each word returns
// them as "Mcdonald" and "O'brien" — with what-you-see-is-what-is-saved, that
// corruption is persisted the moment it renders.
//
// So the cases below are mostly about what must NOT change.

import { describe, expect, it } from 'vitest'
import { capitalizeNames, titleCaseGenre } from '../../src/ui.jsx'

describe('capitalizeNames promotes the first letter of each word', () => {
  it('capitalizes a lowercase name', () => {
    expect(capitalizeNames('agatha christie')).toBe('Agatha Christie')
  })

  it('capitalizes every word, not just the first', () => {
    expect(capitalizeNames('gabriel garcia marquez')).toBe('Gabriel Garcia Marquez')
  })

  it('leaves an already-capitalized name alone', () => {
    expect(capitalizeNames('Agatha Christie')).toBe('Agatha Christie')
  })

  it('is idempotent', () => {
    const once = capitalizeNames('agatha christie')
    expect(capitalizeNames(once)).toBe(once)
  })

  it('handles the empty and nullish cases without throwing', () => {
    expect(capitalizeNames('')).toBe('')
    expect(capitalizeNames(null)).toBe('')
    expect(capitalizeNames(undefined)).toBe('')
  })
})

describe('it never lower-cases what you typed', () => {
  // Each of these is a real name or title that the genre rule would corrupt.
  // The last three also cover the second half of the rule: a word that already
  // holds a capital anywhere is left alone entirely, so a deliberately
  // lower-case first letter ("eBay", "iRobot") is not promoted either.
  const preserved = [
    'McDonald',
    "O'Brien",
    'eBay',
    'HBO',
    'Ian McEwan',
    'The KLF',
    'iRobot',
    'DeLillo',
    'MacBeth',
  ]
  // One test over all nine names rather than nine: the assertion is identical
  // per row and only the string differs, and the aggregate names every name
  // that came back corrupted instead of dying on the first one.
  it('keeps every one of these exactly as typed', () => {
    const corrupted = preserved.filter((s) => capitalizeNames(s) !== s).map((s) => `${s} -> ${capitalizeNames(s)}`)
    expect(corrupted).toEqual([])
  })

  it('differs from the genre rule on exactly that point', () => {
    // If these two ever agree, one of them has been changed into the other and
    // the names above are no longer safe.
    expect(titleCaseGenre('McEwan')).toBe('Mcewan')
    expect(capitalizeNames('McEwan')).toBe('McEwan')
  })
})

describe('word boundaries are whitespace only, deliberately', () => {
  it('does not promote after a hyphen, so "e-mail" survives', () => {
    // The trade is stated in the source: promoting here would fix "jean-luc"
    // and break "e-mail". Neither is worth doing automatically.
    expect(capitalizeNames('e-mail')).toBe('E-mail')
    expect(capitalizeNames('jean-luc picard')).toBe('Jean-luc Picard')
  })

  it("does not promote after an apostrophe, so possessives survive", () => {
    // The case that makes this non-negotiable: titles are in scope.
    expect(capitalizeNames("schindler's list")).toBe("Schindler's List")
    expect(capitalizeNames("don't look up")).toBe("Don't Look Up")
  })

  it('treats a newline or a tab as a word boundary like a space', () => {
    expect(capitalizeNames('agatha\nchristie')).toBe('Agatha\nChristie')
    expect(capitalizeNames('agatha\tchristie')).toBe('Agatha\tChristie')
  })

  it('leaves leading and trailing whitespace in place while you type', () => {
    // Trimming here would make it impossible to type a space between two words.
    expect(capitalizeNames('agatha ')).toBe('Agatha ')
    expect(capitalizeNames(' agatha')).toBe(' Agatha')
  })

  it('promotes a word that starts with a non-letter only at its first letter', () => {
    expect(capitalizeNames('2001 a space odyssey')).toBe('2001 A Space Odyssey')
  })

  it('handles non-ASCII lowercase letters', () => {
    expect(capitalizeNames('émile zola')).toBe('Émile Zola')
    expect(capitalizeNames('ólafur arnalds')).toBe('Ólafur Arnalds')
  })
})
