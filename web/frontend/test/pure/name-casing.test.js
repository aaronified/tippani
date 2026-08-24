// capitalizeNames — the casing rule behind every name and title field: promote
// the first letter of each word, and keep an English title's small words small.
//
// The reason this is its own function rather than a reuse of titleCaseGenre is
// the whole test file: a genre comes from a small vocabulary and can be safely
// re-cased end to end, and a name cannot. "McDonald" and "O'Brien" are correct
// as typed, and a title-caser that lower-cases the rest of each word returns
// them as "Mcdonald" and "O'brien" — with what-you-see-is-what-is-saved, that
// corruption is persisted the moment it renders.
//
// So the cases below are mostly about what must NOT change. The last block is the
// one place the rule takes something away, and says why.

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
    // "up" is on the small-word list, so this comes back with a small u — the
    // film's own title has a capital, and a capital is what you type to get one
    // (see the small-words block below). This assertion used to expect "Up" and
    // is written down as changed rather than deleted: it is the one place the
    // list costs something.
    expect(capitalizeNames("don't look up")).toBe("Don't Look up")
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
    expect(capitalizeNames('2001 space odyssey')).toBe('2001 Space Odyssey')
    expect(capitalizeNames('“quiet” hours')).toBe('“Quiet” Hours')
  })

  it('handles non-ASCII lowercase letters', () => {
    expect(capitalizeNames('émile zola')).toBe('Émile Zola')
    expect(capitalizeNames('ólafur arnalds')).toBe('Ólafur Arnalds')
  })
})

describe('a title keeps its small words small', () => {
  // WHY THIS BLOCK EXISTS. The owner could not type "The Wheel of Time". Every
  // name field capitalises as you type, so "of" was promoted to "Of" while it
  // was still the two-letter word "o", and the promote-only rule's own escape
  // hatch — a word carrying a capital is left alone — then froze it there. The
  // reader saw "The Wheel Of Time" and had no way to argue with it.
  const titles = [
    ['the wheel of time', 'The Wheel of Time'],
    ['a tale of two cities', 'A Tale of Two Cities'],
    ['the lord of the rings', 'The Lord of the Rings'],
    ['to kill a mockingbird', 'To Kill a Mockingbird'],
    ['war and peace', 'War and Peace'],
    ['of mice and men', 'Of Mice and Men'], // first word promotes however small
    ['gone with the wind', 'Gone with the Wind'],
  ]
  it('lower-cases a small word anywhere but the first', () => {
    const wrong = titles.filter(([a, b]) => capitalizeNames(a) !== b).map(([a, b]) => `${a} -> ${capitalizeNames(a)} (want ${b})`)
    expect(wrong).toEqual([])
  })

  it('demotes one that arrived capitalised, which is what typing produces', () => {
    // The failure in one line: this is the string the old rule built, letter by
    // letter, and it has to come back corrected rather than left alone.
    expect(capitalizeNames('The Wheel Of Time')).toBe('The Wheel of Time')
  })

  it('survives being run on every prefix, the way the field runs it', () => {
    // The actual keystroke sequence. Each step feeds the previous result back in
    // with one more character, exactly as useNameCasing does.
    let v = ''
    for (const ch of 'the wheel of time') v = capitalizeNames(v + ch)
    expect(v).toBe('The Wheel of Time')
  })

  it('promotes a small word that opens a clause', () => {
    expect(capitalizeNames('2001: a space odyssey')).toBe('2001: A Space Odyssey')
    expect(capitalizeNames('book two. the return')).toBe('Book Two. The Return')
  })

  it('never touches an all-caps small word', () => {
    // Demoting the first letter of "IN" gives "iN", which is nobody's title.
    expect(capitalizeNames('LIVE IN PARIS')).toBe('LIVE IN PARIS')
    expect(capitalizeNames('THE FALL OF ROME')).toBe('THE FALL OF ROME')
  })

  it('leaves a name particle exactly where it was', () => {
    // Not on the list, deliberately: "Vincent van Gogh" and "Robert De Niro" are
    // both right, so the list stays out of it and the old behaviour stands.
    expect(capitalizeNames('vincent van gogh')).toBe('Vincent Van Gogh')
    expect(capitalizeNames('ursula le guin')).toBe('Ursula Le Guin')
  })

  it('is still idempotent', () => {
    const once = capitalizeNames('the wheel of time')
    expect(capitalizeNames(once)).toBe(once)
  })
})
