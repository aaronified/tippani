// WHICH OF A QUOTE'S TWO TEXTS GOES IN THE BIG TYPE.
//
// FOUR STATES, ON ONE AXIS, and the owner's own numbering: "1) translations above
// quotations, 2) quotations above translation, 3) no translation, 4) no
// quotations." Which state applies is textOrder.js's question and is tested beside
// it; this file is only about what each state DRAWS.
//
// WHY IT IS A TABLE. Every state has to answer for a row that is missing one of
// its two texts, and that is where a display rule turns into a card with nothing
// on it. Six of the eight cases below are that.
//

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { quoteBody, quoteTexts, showsTranslationLine } from '../../src/text.js'

const both = { quote: 'Als die Nazis die Kommunisten holten', translation: 'First they came for the Communists' }
const quoteOnly = { quote: 'a line', translation: '' }
const transOnly = { quote: '', translation: 'eine Zeile' }

// toMatchObject RATHER THAN toEqual, WHICH THESE CASES USED TO USE. `quoteTexts`
// returns the face each of the two texts is set in as well as the texts
// themselves, and a whole-object compare here failed on all eight of them for a
// field none of them is about — every case below asks which TEXT leads, and that
// is exactly what a partial match asserts. The scripts have their own cases in
// text.test.js, where they are the subject.
describe('what each state draws', () => {
  it('quote-first is the quotation with its translation under it', () => {
    expect(quoteTexts(both, 'quote-first')).toMatchObject({ body: both.quote, second: both.translation })
  })

  it('trans-first swaps them — "a poem in a foreign language will need the translation to be on top, and the original in the bottom"', () => {
    expect(quoteTexts(both, 'trans-first')).toMatchObject({ body: both.translation, second: both.quote })
  })

  it('quote-only is the quotation alone', () => {
    expect(quoteTexts(both, 'quote-only')).toMatchObject({ body: both.quote, second: '' })
  })

  it('trans-only is the translation alone', () => {
    expect(quoteTexts(both, 'trans-only')).toMatchObject({ body: both.translation, second: '' })
  })

  // THE DEFAULT IS WHAT THE APP DID BEFORE ANY OF THIS, and an unknown state
  // resolves to it rather than to nothing — a card rendered by an older screen, or
  // one whose state came from a newer client, still has to draw.
  it('and anything it does not recognise reads as written', () => {
    for (const order of [undefined, null, '', 'both', 'sideways']) {
      expect(quoteTexts(both, order), String(order))
        .toMatchObject({ body: both.quote, second: both.translation })
    }
  })
})

// A FALLBACK, NOT A BLANK. Honouring a state exactly on a row that lacks the text
// it asks for would empty the card — which, on a library where translations are
// the exception, is a setting that looks like a bug that has deleted your
// highlights.
describe('a row that is missing one of its two texts', () => {
  it('shows the quotation when the translation is wanted and absent', () => {
    expect(quoteTexts(quoteOnly, 'trans-only')).toMatchObject({ body: 'a line', second: '' })
    expect(quoteTexts(quoteOnly, 'trans-first')).toMatchObject({ body: 'a line', second: '' })
  })

  it('and shows the translation when the quotation is wanted and absent', () => {
    // The mirror case, and it is real: an imported row can arrive with only the
    // translation filled in.
    expect(quoteTexts(transOnly, 'quote-only')).toMatchObject({ body: 'eine Zeile', second: '' })
  })

  it('and never prints the same words twice', () => {
    // The failure this forbids is a card whose big type and second line are the
    // same string, which is what a naive fallback produces.
    for (const row of [quoteOnly, transOnly]) {
      for (const order of ['trans-only', 'trans-first', 'quote-first', 'quote-only']) {
        const { body, second } = quoteTexts(row, order)
        expect(second === '' || second !== body, `${order} on ${JSON.stringify(row)}`).toBe(true)
      }
    }
  })
})

describe('the two names beside it answer the same way', () => {
  it('quoteBody is the big type', () => {
    expect(quoteBody(both, 'trans-first')).toBe(both.translation)
    expect(quoteBody(both, 'quote-first')).toBe(both.quote)
  })

  it('and showsTranslationLine is "is there a second line", not "is there a translation"', () => {
    // Still true when the two have swapped: there IS a second line, it is the
    // original. A version of this that asked about the translation would say the
    // same thing here for the wrong reason.
    expect(showsTranslationLine(both, 'quote-first')).toBe(true)
    expect(showsTranslationLine(both, 'trans-first')).toBe(true)
    expect(showsTranslationLine(both, 'quote-only')).toBe(false)
    expect(showsTranslationLine(both, 'trans-only')).toBe(false)
  })
})

// ---- and every screen that asks passes a state ------------------------------
//
// THE FAILURE THIS GUARDS IS NOT A WRONG ANSWER, IT IS AN UNASKED QUESTION, and it
// has happened twice. `quoteBody(a, tview)` compiled, ran, and returned a
// perfectly sensible string — the one it returned before the feature existed. The
// table view shipped like that for a day: cards led with the translation and the
// same rows in the table led with the original, and no test failed because nothing
// was broken. It was merely not connected.
//
// SO THE ASSERTION IS ON THE CALL SITES. A test that rendered one component would
// pin the site that was wrong and say nothing about the next one.
describe('the state reaches every caller', () => {
  const SCREENS = ['Library.jsx', 'Movies.jsx', 'Quotes.jsx']
  const CALL = /\b(quoteTexts|quoteBody|showsTranslationLine)\s*\(([^()]*)\)/g

  it.each(SCREENS)('%s passes a state to every one of them', (file) => {
    const src = readFileSync(join(process.cwd(), 'src', file), 'utf8')
    const thin = []
    for (const m of src.matchAll(CALL)) {
      const args = m[2].split(',').map((a) => a.trim()).filter(Boolean)
      if (args.length < 2) thin.push(`${m[1]}(${m[2]})`)
    }
    expect(thin, `${file} asks which text leads without saying which state applies — the answer will be the default and nothing will look broken`)
      .toEqual([])
  })

  // AND WHAT THIS CANNOT SEE, said plainly because a guard trusted past its reach
  // is worse than no guard: the pattern refuses nested parentheses, so
  // `quoteBody(a, resolve(x))` does not match it AT ALL and is skipped in silence
  // — the same shape of miss it exists to prevent. It holds for the call sites
  // that exist, which pass bare identifiers; a caller needing an expression should
  // hoist it to a const on the line above, as all three already do.
  it('and the pattern still finds the calls it is meant to', () => {
    // Without this, a rename could leave the guard scanning for nothing and
    // passing on every file.
    const src = readFileSync(join(process.cwd(), 'src', 'Library.jsx'), 'utf8')
    expect([...src.matchAll(CALL)].length, 'the call-site pattern matches nothing in Library.jsx any more')
      .toBeGreaterThan(0)
  })
})
