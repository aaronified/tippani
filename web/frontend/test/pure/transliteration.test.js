// A quote's third text — how it sounds.
//
// The owner keeps Bengali proverbs and writes them like this:
//
//   অতি সন্ন্যাসীতে গাজন নষ্ট (Ati sannyasite gajon nosto)
//   Literal translation: Too many ascetics ruin the festival.
//
// Three registers of one sentence, and the middle one had nowhere to live. What
// makes it a third field rather than a second use of the translation is that it
// says nothing about the MEANING: a reader who cannot read the script still cannot
// tell you what the proverb is about after reading the romanisation, and a reader
// who wants to say it aloud gets nothing from the translation.
//
// THE INTERESTING PART IS WHO IS ASKED. The owner's rule was not "show it for
// Bengali" — it was "only for scripts that are not the same as the chosen
// language", with the note that a reader "may want to store bengali
// transliteration everywhere". So the app in Bengali must offer a Bengali
// romanisation of an ENGLISH quote, which is the same feature pointing the other
// way, and neither script is hardcoded as the strange one.

import { describe, expect, it } from 'vitest'
import { quoteTexts, scriptOf, wantsTransliteration } from '../../src/text.js'

const PROVERB = 'অতি সন্ন্যাসীতে গাজন নষ্ট'
const ROMAN = 'Ati sannyasite gajon nosto'

describe('which script a line is in', () => {
  it('reads the script off the characters, not off a language field', () => {
    // There is no ISO code and no script column on a language in this app (see
    // languages.jsx) — the name is free text somebody typed. The characters are
    // the only thing that can answer.
    const cases = [
      [PROVERB, 'bengali'],
      ['Too many cooks spoil the broth', 'latin'],
      ['बहुत हुआ', 'devanagari'],
      ['Толстой', 'cyrillic'],
      ['كلام', 'arabic'],
      ['道可道', 'han'],
      ['', ''],
      ['   ', ''],
      ['1952', ''], // digits belong to no script
      ['— , !', ''], // nor does punctuation
    ]
    expect(cases.map(([s]) => scriptOf(s))).toEqual(cases.map(([, want]) => want))
  })

  // A romanisation in brackets after the original would tip a majority vote, and
  // that is exactly the string this app stores. The leading strong character is
  // what decides — the same rule the bidi algorithm uses for direction.
  it('is not swayed by a romanisation sitting inside the same string', () => {
    expect(scriptOf(`${PROVERB} (${ROMAN})`)).toBe('bengali')
  })
})

describe('who gets asked for a transliteration', () => {
  it('asks when the quote is in a script the reader is not reading the app in', () => {
    const cases = [
      // The owner's case: Bengali proverb, English interface.
      { name: 'bengali quote, english app', quote: PROVERB, locale: 'en', want: true },
      // The same feature pointing the other way, which is the half a hardcoded
      // "romanise into Latin" would have lost.
      { name: 'english quote, bengali app', quote: 'Too many cooks', locale: 'bn', want: true },
      // Nothing to respell: the reader already reads these letters.
      { name: 'english quote, english app', quote: 'Too many cooks', locale: 'en', want: false },
      { name: 'bengali quote, bengali app', quote: PROVERB, locale: 'bn', want: false },
      // A locale the app does not know is assumed to be written in Latin, which is
      // the same guess the fonts make.
      { name: 'unknown locale falls back to latin', quote: PROVERB, locale: 'xx', want: true },
      // An empty box on every quote is the thing the rule exists to prevent.
      { name: 'nothing typed yet', quote: '', locale: 'en', want: false },
      { name: 'only digits', quote: '1952', locale: 'en', want: false },
    ]
    const got = cases.map((c) => ({ name: c.name, ask: wantsTransliteration(c.quote, c.locale) }))
    expect(got).toEqual(cases.map((c) => ({ name: c.name, ask: c.want })))
  })

  // THE RULE MAY DECLINE TO ASK; IT MAY NEVER HIDE AN ANSWER. A field that
  // disappears while holding text is a field that drops it on the next save, and
  // switching locale would be enough to do it.
  it('always shows a box that already has something in it', () => {
    expect(wantsTransliteration('Too many cooks', 'en', ROMAN)).toBe(true)
    expect(wantsTransliteration(PROVERB, 'bn', ROMAN)).toBe(true)
    expect(wantsTransliteration('', 'en', ROMAN)).toBe(true)
    // Whitespace is not something in it.
    expect(wantsTransliteration('Too many cooks', 'en', '   ')).toBe(false)
  })
})

describe('where the transliteration sits on a card', () => {
  const row = { quote: PROVERB, translation: 'Too many ascetics ruin the festival', transliteration: ROMAN }

  it('follows the original rather than joining the order dial', () => {
    // The dial answers "which MEANING leads". A pronunciation is not a meaning, so
    // it is carried alongside whichever arrangement the reader chose rather than
    // being shuffled into it.
    const cases = [
      { name: 'default', order: undefined, body: PROVERB, second: row.translation, roman: ROMAN },
      { name: 'translation first', order: 'trans-first', body: row.translation, second: PROVERB, roman: ROMAN },
      { name: 'original only', order: 'quote-only', body: PROVERB, second: '', roman: ROMAN },
      // Under "translation only" the original is not on the card at all, so there
      // is nothing for a pronunciation to be a pronunciation OF.
      { name: 'translation only', order: 'trans-only', body: row.translation, second: '', roman: '' },
    ]
    const got = cases.map((c) => ({ name: c.name, ...quoteTexts(row, c.order) }))
    expect(got).toEqual(cases.map((c) => ({ name: c.name, body: c.body, second: c.second, roman: c.roman })))
  })

  it('leaves a row without one alone', () => {
    expect(quoteTexts({ quote: 'plain', translation: '' }, undefined)).toEqual({
      body: 'plain', second: '', roman: '',
    })
  })
})
