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

import {  quoteTexts,  } from '../../src/text.js'

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
  it('trans-first swaps them — "a poem in a foreign language will need the translation to be on top, and the original in the bottom"', () => {
    expect(quoteTexts(both, 'trans-first')).toMatchObject({ body: both.translation, second: both.quote })
  })
})

// A FALLBACK, NOT A BLANK. Honouring a state exactly on a row that lacks the text
// it asks for would empty the card — which, on a library where translations are
// the exception, is a setting that looks like a bug that has deleted your
// highlights.
describe('a row that is missing one of its two texts', () => {
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

