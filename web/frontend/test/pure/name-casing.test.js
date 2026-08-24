// capitalizeNames and capitalizeTitle — the two casing rules, and why they are
// two. capitalizeNames promotes the first letter of each word and stops there;
// capitalizeTitle also keeps an English title's small words small.
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
import { capitalizeNames, capitalizeTitle, titleCaseGenre } from '../../src/ui.jsx'

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
    // The PERSON rule is promote-only, so nothing here is demoted.
    expect(capitalizeNames("don't look up")).toBe("Don't Look Up")
    // The TITLE rule keeps a small word small — but not the LAST one, which
    // English title case always capitalises. This assertion has been wrong twice:
    // "Up" (before the list), then "up" (before the last-word rule), now "Up".
    expect(capitalizeTitle("don't look up")).toBe("Don't Look Up")
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
  // Every case in this block is capitalizeTITLE. capitalizeNames does none of it,
  // which is asserted in the block after this one.
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
    const wrong = titles.filter(([a, b]) => capitalizeTitle(a) !== b).map(([a, b]) => `${a} -> ${capitalizeTitle(a)} (want ${b})`)
    expect(wrong).toEqual([])
  })

  it('demotes one that arrived capitalised, which is what typing produces', () => {
    // The failure in one line: this is the string the old rule built, letter by
    // letter, and it has to come back corrected rather than left alone.
    expect(capitalizeTitle('The Wheel Of Time')).toBe('The Wheel of Time')
  })

  it('survives being run on every prefix, the way the field runs it', () => {
    // The actual keystroke sequence. Each step feeds the previous result back in
    // with one more character, exactly as useNameCasing does.
    let v = ''
    for (const ch of 'the wheel of time') v = capitalizeTitle(v + ch)
    expect(v).toBe('The Wheel of Time')
  })

  it('promotes a small word that opens a clause', () => {
    expect(capitalizeTitle('2001: a space odyssey')).toBe('2001: A Space Odyssey')
    expect(capitalizeTitle('book two. the return')).toBe('Book Two. The Return')
  })

  it('never touches an all-caps small word', () => {
    // Demoting the first letter of "IN" gives "iN", which is nobody's title.
    expect(capitalizeTitle('LIVE IN PARIS')).toBe('LIVE IN PARIS')
    expect(capitalizeTitle('THE FALL OF ROME')).toBe('THE FALL OF ROME')
  })

  it('leaves a name particle exactly where it was', () => {
    // Not on the list, deliberately: "Vincent van Gogh" and "Robert De Niro" are
    // both right, so the list stays out of it and the old behaviour stands.
    expect(capitalizeTitle('vincent van gogh')).toBe('Vincent Van Gogh')
    expect(capitalizeTitle('ursula le guin')).toBe('Ursula Le Guin')
  })

  it('is still idempotent', () => {
    const once = capitalizeTitle('the wheel of time')
    expect(capitalizeTitle(once)).toBe(once)
  })
})

describe('and a person\u2019s name does not', () => {
  // WHY THIS BLOCK EXISTS. The small-word list shipped on the ONE rule, which is
  // used for authors, directors, actors, characters and speakers as well as
  // titles \u2014 and half of those words are whole names somewhere else. "Nguyen Van
  // An" came back "Nguyen Van an": a corruption of exactly the kind
  // capitalizeNames' own header refuses, on a reader who has no idea a
  // small-word list exists and no reason to look for one.
  const names = [
    ['nguyen van an', 'Nguyen Van An'],   // an
    ['kim so hyun', 'Kim So Hyun'],       // so
    ['nguyen thi to', 'Nguyen Thi To'],   // to
    ['li in ho', 'Li In Ho'],             // in
    ['park by ul', 'Park By Ul'],         // by
    ['agatha christie', 'Agatha Christie'],
  ]
  it('promotes every word, including the ones a title would keep small', () => {
    const wrong = names
      .filter(([a, b]) => capitalizeNames(a) !== b)
      .map(([a, b]) => `${a} -> ${capitalizeNames(a)} (want ${b})`)
    expect(wrong).toEqual([])
  })

  it('and the title rule is the one that differs, on the same strings', () => {
    // Stated as a contrast rather than left implied: if these two ever agree,
    // one of them has been changed into the other and the names above are no
    // longer safe.
    //
    // The name has to be MID-STRING with no punctuation on it to show the
    // difference: the title rule capitalises the last word however small it is,
    // and a small word carrying a terminator ends a phrase — so "Nguyen Van An"
    // and "Nguyen Van An: A Memoir" both come out right under BOTH rules, which is
    // a relief and not a test.
    expect(capitalizeTitle('kim so hyun in seoul')).toBe('Kim so Hyun in Seoul')
    expect(capitalizeNames('kim so hyun in seoul')).toBe('Kim So Hyun In Seoul')
    expect(capitalizeTitle('nguyen van an')).toBe('Nguyen Van An')
    expect(capitalizeTitle('nguyen van an: a memoir')).toBe('Nguyen Van An: A Memoir')
  })

  it('never demotes a capital somebody typed', () => {
    // The person rule has no demotion at all, so a name that arrives cased is a
    // name that stays cased.
    expect(capitalizeNames('Nguyen Van An')).toBe('Nguyen Van An')
  })
})


describe('the last word of a title is never small', () => {
  // WHY THIS BLOCK EXISTS. The small-word list shipped without the other half of
  // English title case — the last word is capitalised however small it is — and
  // that did not merely under-capitalise. The rule runs on every keystroke, so a
  // title that arrived correct from a provider was REWRITTEN the moment somebody
  // fixed a typo elsewhere in the same field: "Bring It On" saved itself as "Bring
  // It on", with no diff and nothing said.
  const titles = [
    ['bring it on', 'Bring It On'],
    ['set it off', 'Set It Off'],
    ["don't look up", "Don't Look Up"],
    ['what is it all for', 'What Is It All For'],
    // And the mid-string case still holds, which is the whole point of the pair.
    ['the wheel of time', 'The Wheel of Time'],
    ['a tale of two cities', 'A Tale of Two Cities'],
  ]
  it('capitalises it, and still keeps the middle ones small', () => {
    const wrong = titles.filter(([a, b]) => capitalizeTitle(a) !== b).map(([a, b]) => `${a} -> ${capitalizeTitle(a)} (want ${b})`)
    expect(wrong).toEqual([])
  })

  it('does not rewrite a correct title that is edited', () => {
    // The failure in one line: idempotence over a title that was already right.
    for (const t of ['Bring It On', 'Set It Off', 'The Wheel of Time', 'A Tale of Two Cities']) {
      expect(capitalizeTitle(t), t).toBe(t)
    }
  })

  it('demotes it again the moment another word follows', () => {
    // This is what makes the last-word rule safe to have at all while the field
    // capitalises as you type: "of" is promoted while it is briefly last, and
    // lowered again by the next word — where the promote-only rule would have
    // frozen it, because a word carrying a capital is left alone.
    expect(capitalizeTitle('The Wheel Of')).toBe('The Wheel Of')
    expect(capitalizeTitle('The Wheel Of t')).toBe('The Wheel of T')
  })
})

describe('a title that is already right is never rewritten', () => {
  // WHY THIS BLOCK EXISTS, AND WHY IT IS THE THIRD ONE. The small-word rule has
  // been wrong three times in three releases, each time in a way that looked like
  // an omission and was actually a CORRUPTION — because it runs on every keystroke
  // and saves what you see, so a title that arrived correct is rewritten the
  // moment somebody edits a typo elsewhere in the same field. No diff, no warning.
  //
  //   1. "The Wheel Of Time"        — no small-word list at all
  //   2. "Bring It on"              — no last-word rule
  //   3. "Set It off (1996)"        — the last TOKEN is not the last WORD
  //      "Bring It on: A Sequel"    — a small word can END a clause as well as follow one
  //      "Get up, Stand Up"         — a comma ends a phrase too
  //
  // So the assertion that matters is idempotence over titles that are correct.
  const correct = [
    'Bring It On',
    'Set It Off (1996)',
    'Bring It On: A Sequel',
    'Get Up, Stand Up',
    'Where Are You From?',
    'Live at the Apollo [Remastered]',
    'The Wheel of Time',
    'A Tale of Two Cities',
    'The Lion, the Witch and the Wardrobe',
    'Gone with the Wind',
    '2001: A Space Odyssey',
    "Don't Look Up",
    'Of Mice and Men',
  ]
  it('leaves every one of these exactly as it is', () => {
    const rewritten = correct.filter((s) => capitalizeTitle(s) !== s).map((s) => `${s} -> ${capitalizeTitle(s)}`)
    expect(rewritten).toEqual([])
  })

  it('and produces them from lower case', () => {
    const wrong = correct
      .map((s) => [s.toLowerCase(), s])
      .filter(([a, b]) => capitalizeTitle(a) !== b)
      .map(([a, b]) => `${a} -> ${capitalizeTitle(a)} (want ${b})`)
    // The one exception is the comma case, which lower-casing destroys the
    // evidence for — "the lion, the witch" is genuinely ambiguous from lower case
    // and is asserted above in the form a reader would type it.
    expect(wrong).toEqual([])
  })

  it('a comma ends a phrase but does not open one', () => {
    // The asymmetry that needs two constants: the word CARRYING the comma is
    // promoted, the word after it is not.
    expect(capitalizeTitle('get up, stand up')).toBe('Get Up, Stand Up')
    expect(capitalizeTitle('the lion, the witch and the wardrobe')).toBe('The Lion, the Witch and the Wardrobe')
  })

  it('a trailing parenthetical does not steal the last word', () => {
    expect(capitalizeTitle('set it off (1996)')).toBe('Set It Off (1996)')
    expect(capitalizeTitle('live at the apollo [remastered]')).toBe('Live at the Apollo [Remastered]')
  })
})
