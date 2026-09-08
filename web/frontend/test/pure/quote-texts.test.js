// WHICH OF A QUOTE'S TWO TEXTS GOES IN THE BIG TYPE.
//
// THE OWNER'S RULING, asked and answered: the language decides, the menu
// overrides. A quote in a language the reader has not declared leads with its
// TRANSLATION and prints the original underneath — "a poem in a foreign language
// will need the translation to be on top, and the original in the bottom" — and
// the board's own text menu still wins where it says something explicit.
//
// WHY THIS IS A TABLE AND NOT THREE CASES. The answer is a function of three
// things (the menu, the language, whether there is a translation at all) and the
// two halves — what leads and what sits under it — have to agree. They used to be
// two functions, each reading the menu for itself, which was safe only while the
// second line was ALWAYS the translation. Now that the two can swap, a
// disagreement prints the same words in both sizes or hides one of them, silently.
// So every combination is written out.

import { describe, expect, it } from 'vitest'
import { quoteBody, quoteTexts, showsTranslationLine } from '../../src/text.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const q = { quote: 'Als die Nazis die Kommunisten holten', translation: 'First they came for the Communists', language: 'German' }
const readsGerman = (l) => String(l || '').toLowerCase() === 'german'
const readsNothingElse = (l) => String(l || '').toLowerCase() === 'english'

describe('the menu overrides', () => {
  it('quote-only shows the quote and nothing under it, whatever the reader reads', () => {
    for (const canRead of [readsGerman, readsNothingElse, undefined]) {
      expect(quoteTexts(q, 'quote', canRead)).toEqual({ body: q.quote, second: '' })
    }
  })

  it('translation-only shows the translation and nothing under it', () => {
    for (const canRead of [readsGerman, readsNothingElse, undefined]) {
      expect(quoteTexts(q, 'translation', canRead)).toEqual({ body: q.translation, second: '' })
    }
  })

  // A FALLBACK, NOT A BLANK — kept from the pair this replaces. Honouring
  // "translation only" exactly would empty every untranslated quote on the board,
  // which on a library where translations are the exception is a setting that
  // looks like a bug that has deleted your highlights.
  it('and translation-only on an untranslated quote still says something', () => {
    const bare = { quote: 'a line', translation: '', language: 'German' }
    expect(quoteTexts(bare, 'translation', readsNothingElse).body).toBe('a line')
  })
})

describe('otherwise the language decides', () => {
  it('a quote in a language the reader declared reads as written', () => {
    expect(quoteTexts(q, 'both', readsGerman)).toEqual({ body: q.quote, second: q.translation })
  })

  it('and one in a language they did not leads with its translation', () => {
    expect(quoteTexts(q, 'both', readsNothingElse)).toEqual({ body: q.translation, second: q.quote })
  })

  // THE DEFAULT HAS TO CHANGE NOTHING for a reader who never opens the setting,
  // and for a card rendered outside the provider — which is every card in a test
  // that does not know this feature exists.
  it('and with no predicate at all, every quote reads as written', () => {
    expect(quoteTexts(q, 'both', undefined)).toEqual({ body: q.quote, second: q.translation })
    expect(quoteTexts(q, 'both', null)).toEqual({ body: q.quote, second: q.translation })
  })

  it('and a quote with no translation cannot lead with one', () => {
    const bare = { quote: 'a line', translation: '', language: 'German' }
    expect(quoteTexts(bare, 'both', readsNothingElse)).toEqual({ body: 'a line', second: '' })
  })

  // A QUOTE WITH NO LANGUAGE IS NOT A FOREIGN QUOTE. It is the commonest row in
  // any library, and reading the blank as "not declared" would put the
  // translation first on every one of them.
  it('and a quote with no language reads as written', () => {
    const untagged = { quote: 'a line', translation: 'eine Zeile', language: '' }
    expect(quoteTexts(untagged, 'both', readsNothingElse)).toEqual({ body: 'a line', second: 'eine Zeile' })
  })
})

describe('the two old names still answer, and answer the same way', () => {
  // They are re-exported from Library.jsx and four test files call them there.
  // Expressed through quoteTexts, so there is one answer to "which text leads".
  it('quoteBody is the big type', () => {
    expect(quoteBody(q, 'both', readsNothingElse)).toBe(q.translation)
    expect(quoteBody(q, 'both', readsGerman)).toBe(q.quote)
  })

  it('and showsTranslationLine is "is there a second line", not "is there a translation"', () => {
    expect(showsTranslationLine(q, 'both', readsGerman)).toBe(true)
    // Still true when the two have swapped — there IS a second line, it is the
    // original. A version of this that asked about the translation would say the
    // same thing here for the wrong reason.
    expect(showsTranslationLine(q, 'both', readsNothingElse)).toBe(true)
    expect(showsTranslationLine(q, 'quote', readsGerman)).toBe(false)
    expect(showsTranslationLine(q, 'translation', readsGerman)).toBe(false)
  })
})

// ---- and every screen that asks actually passes the predicate ---------------
//
// THE FAILURE THIS GUARDS IS NOT A WRONG ANSWER, IT IS AN UNASKED QUESTION, and
// it has happened twice in this repo now. `quoteBody(a, tview)` compiles, runs,
// and returns a perfectly sensible string — the one it returned before readable
// languages existed. The table view shipped like that: cards led with the
// translation and the same rows in the table led with the original, one library
// giving two answers, and no test failed because nothing was broken. It was
// merely not connected.
//
// SO THE ASSERTION IS ON THE CALL SITES, not on one component. A test that
// rendered AnnotationTable would pin the site that was wrong and say nothing
// about the next one; this fails on any screen that adds a call and forgets the
// third argument. text.js is exempt because it IS the pair of wrappers, and its
// own two-argument signature is what the wrappers exist to widen.
//
// AND HERE IS WHAT IT CANNOT SEE, said plainly because a guard that is trusted
// past its reach is worse than no guard. The pattern refuses nested parentheses,
// so `quoteBody(a, tview, readerFrom(x))` does not match it AT ALL and is skipped
// in silence rather than counted — the same shape of miss the test is here to
// prevent. It holds for the three call sites that exist, all of which pass bare
// identifiers; a call that needs an expression for its reader should hoist it to
// a `const` on the line above, which is what the two real callers already do.
// Quotes.jsx has no call today and its row asserts nothing yet — it is listed so
// that the screen most likely to grow one is already covered when it does.
describe('the predicate reaches every caller', () => {
  const SCREENS = ['Library.jsx', 'Movies.jsx', 'Quotes.jsx']
  // The three names that answer "which text leads", and a call to any of them
  // that stops at two arguments is a screen that cannot see the reader.
  const CALL = /\b(quoteTexts|quoteBody|showsTranslationLine)\s*\(([^()]*)\)/g

  it.each(SCREENS)('%s passes a reader to every one of them', (file) => {
    const src = readFileSync(join(process.cwd(), 'src', file), 'utf8')
    const thin = []
    for (const m of src.matchAll(CALL)) {
      const args = m[2].split(',').map((a) => a.trim()).filter(Boolean)
      if (args.length < 3) thin.push(`${m[1]}(${m[2]})`)
    }
    expect(thin, `${file} asks which text leads without saying who is reading — the answer will be the pre-feature one and nothing will look broken`)
      .toEqual([])
  })
})
