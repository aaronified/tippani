// TYPE PER LANGUAGE, WHICH IS TWO TABLES AND NOT ONE.
//
// THE OWNER'S SPEC, and the last sentence is the whole reason this file exists:
// "any language that the user adds in via translation files should have a full ui
// font picker… And then every language that the user adds via adding them in
// metadata or via adding them in quotes (via the language field) should also get a
// font picker for their quotes. Even when they use same script. I may want my
// german to have serifs, but not english."
//
// GERMAN AND ENGLISH ARE ONE SCRIPT. Every type key a card has ever carried is a
// SCRIPT — `.bengali`, `.devanagari` — so no arrangement of those could set one of
// the two and leave the other alone. That is not a bug a screenshot shows; it is a
// shape the model did not have, and these cases are what say it has it now.

import { beforeEach, describe, expect, it } from 'vitest'
import { applyFonts, fontPatch, fontStateFor, languageClass, languageFamily, quoteFaceFor, quoteFontPatch } from '../../src/fonts.js'
import { quoteTexts } from '../../src/text.js'
import { bookShare } from '../../src/share.jsx'

beforeEach(() => applyFonts({}, ''))

const sheet = () => document.getElementById('tp-language-type')?.textContent || ''

describe('a quote language can have a face of its own', () => {
  it('gives two languages of one script two different faces', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    const de = languageClass('German')
    const en = languageClass('English')
    expect(de, 'the language with a face of its own got no class').toBeTruthy()
    expect(en, 'a language with no face took one anyway').toBe('')
    // The rule is real: a class the stylesheet does not define is silent breakage.
    expect(sheet()).toContain(`.${de}{font-family:'Literata'`)
  })

  // FOLDED, because the language box is free text and the server stores the
  // folded key — "German" on a quote has to meet "german" in the table.
  it('matches whatever case the quote was typed in', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    expect(languageClass('GERMAN')).toBe(languageClass('german'))
    expect(languageClass(' German ')).toBe(languageClass('german'))
  })

  // THE SCRIPT RUNG IS STILL THERE, UNDER THE LANGUAGE ONE. A Bengali library
  // where nobody has opened this picker must go on getting the Bengali face.
  it('falls back to the script when a language has no face of its own', () => {
    expect(languageClass('Bengali')).toBe('bengali')
    expect(languageClass('Hindi')).toBe('devanagari')
    expect(languageClass('Italian'), 'a language the app has no face for').toBe('')
    expect(languageClass('')).toBe('')
  })

  it('and the reader can overrule that script face for one language', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ bengali: 'tiro-bangla' }) }, '')
    expect(languageClass('Bengali')).not.toBe('bengali')
    expect(sheet()).toContain("'Tiro Bangla'")
  })

  // A CARD IS NOT ALWAYS ONE LANGUAGE, so the chosen face carries the Indic ones
  // after it exactly as every role stack does.
  it('keeps the Indic fallbacks behind whatever face was chosen', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    const rule = sheet()
    expect(rule.indexOf('Literata')).toBeLessThan(rule.indexOf('Noto Serif Bengali'))
  })

  // REPLACED WHOLE, NEVER APPENDED TO: a face that was just cleared has to stop
  // being drawn, and a sheet that only grows would go on setting it until a reload.
  it('stops styling a language whose face was cleared', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    expect(sheet()).toContain('Literata')
    applyFonts({}, '')
    expect(sheet()).toBe('')
    expect(languageClass('German')).toBe('')
  })

  // An `upload:12` whose file is gone, or a face this build dropped, resolves to
  // the display built-in — which would silently override the card with a face
  // nobody chose. Skipping it leaves the script rung to answer.
  it('ignores a token that resolves to something else', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'upload:999' }) }, '')
    expect(languageClass('German')).toBe('')
    expect(sheet()).toBe('')
  })
})

// THE CARD IS WHERE THIS IS SEEN, and quoteTexts is the one function that decides
// which of the two texts is the quote — so the face has to follow the quote there
// rather than be computed beside a render.
describe('the card takes the language face', () => {
  const de = { quote: 'Der Mensch ist frei', translation: 'Man is free', language: 'German' }

  it('tags the quote with the language class, not a script class', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    const { bodyScript, secondScript } = quoteTexts(de, 'quote-first')
    expect(bodyScript).toBe(languageClass('German'))
    expect(secondScript, 'the translation is not in the quote’s language').toBe('')
  })

  it('and follows the quote to the second line when the translation leads', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    const { bodyScript, secondScript } = quoteTexts(de, 'trans-first')
    expect(bodyScript).toBe('')
    expect(secondScript).toBe(languageClass('German'))
  })
})

// ---- the interface's own faces, per UI language ----------------------------

describe('a UI language can have faces of its own', () => {
  const prefs = {
    fontDisplay: 'literata',
    fontsByLocale: JSON.stringify({ bn: { display: 'source-serif-4', displayStyle: 'bold' } }),
  }

  it('draws the locale that has one in its own face', () => {
    applyFonts(prefs, 'bn')
    expect(fontStateFor(prefs, 'bn').find((r) => r.key === 'display').chosen.id).toBe('source-serif-4')
  })

  // A PARTIAL, NEVER A FULL SET: the roles this locale never touched go on
  // following the answer every language inherits.
  it('and follows the shared answer for every role it says nothing about', () => {
    const rows = fontStateFor(prefs, 'bn')
    expect(rows.find((r) => r.key === 'display').own).toBe(true)
    const ui = rows.find((r) => r.key === 'ui')
    expect(ui.own).toBe(false)
    expect(ui.chosen.id).toBe('hanken-grotesk')
  })

  it('shows the inherited face on an untouched locale rather than a blank', () => {
    const rows = fontStateFor(prefs, 'fr')
    expect(rows.find((r) => r.key === 'display').chosen.id).toBe('literata')
    expect(rows.every((r) => r.own === false)).toBe(true)
  })

  // THE SCOPE THAT IS NOT RENDERING MUST NOT CHANGE THE SCREEN. Editing Bengali's
  // faces while the interface is in English is the ordinary case, and applyFonts
  // composing the ACTIVE locale is what keeps it harmless.
  it('leaves the app alone when the locale being edited is not the one rendering', () => {
    applyFonts(prefs, 'en')
    expect(document.documentElement.style.getPropertyValue('--font-display')).toContain('Literata')
    applyFonts(prefs, 'bn')
    expect(document.documentElement.style.getPropertyValue('--font-display')).toContain('Source Serif 4')
  })
})

describe('what a change on the Type card writes', () => {
  it('writes the flat field for the shared scope', () => {
    expect(fontPatch({}, '', { display: 'literata' })).toEqual({ fontDisplay: 'literata' })
    expect(fontPatch({}, '', { displayStyle: 'bold' })).toEqual({ fontDisplayStyle: 'bold' })
  })

  it('and the blob for a named locale, without touching the flat field', () => {
    const patch = fontPatch({ fontDisplay: 'literata' }, 'bn', { display: 'tiro-bangla' })
    expect(patch.fontDisplay).toBeUndefined()
    expect(JSON.parse(patch.fontsByLocale)).toEqual({ bn: { display: 'tiro-bangla' } })
  })

  // CLEARING IS NOT SETTING "". An empty token on a flat field means "back to the
  // built-in"; a locale with nothing of its own must have no entry at all, or it
  // stops following the answer it is supposed to inherit.
  it('takes the entry out when a locale row is reverted', () => {
    const prefs = { fontsByLocale: JSON.stringify({ bn: { display: 'tiro-bangla' }, fr: { ui: 'inter' } }) }
    const patch = fontPatch(prefs, 'bn', { display: null, displayStyle: null })
    expect(JSON.parse(patch.fontsByLocale)).toEqual({ fr: { ui: 'inter' } })
  })

  // ONE GESTURE IS NOT ONE FIELD, and this is the case that made `changes` a set:
  // the revert glyph clears a role's face AND its modifiers, and two separate
  // calls would each build their blob from the same unchanged preferences — so
  // the second would write a table that never heard about the first, and the face
  // would come back.
  it('clears the face and its modifiers in ONE patch, not two', () => {
    const prefs = { fontsByLocale: JSON.stringify({ bn: { display: 'tiro-bangla', displayStyle: 'bold' } }) }
    expect(fontPatch(prefs, 'bn', { display: null, displayStyle: null })).toEqual({ fontsByLocale: '' })
    // Clearing only the face leaves the modifier behind, which is why one call
    // has to carry both — the locale would go on being bold with no face of its own.
    const half = fontPatch(prefs, 'bn', { display: null })
    expect(JSON.parse(half.fontsByLocale)).toEqual({ bn: { displayStyle: 'bold' } })
  })

  it('and stores nothing at all when the last one goes', () => {
    const prefs = { fontsByLocale: JSON.stringify({ bn: { display: 'tiro-bangla' } }) }
    expect(fontPatch(prefs, 'bn', { display: null })).toEqual({ fontsByLocale: '' })
  })
})

describe('what a change on a language row writes', () => {
  it('folds the name and keeps the rest of the table', () => {
    const prefs = { fontsByLanguage: JSON.stringify({ bengali: 'tiro-bangla' }) }
    const patch = quoteFontPatch(prefs, 'German', 'literata')
    expect(JSON.parse(patch.fontsByLanguage)).toEqual({ bengali: 'tiro-bangla', german: 'literata' })
  })

  it('takes the row out when the reader picks "follows the card"', () => {
    const prefs = { fontsByLanguage: JSON.stringify({ german: 'literata' }) }
    expect(quoteFontPatch(prefs, 'German', '')).toEqual({ fontsByLanguage: '' })
  })

  // The row shows NOTHING for a language that follows the card — not the display
  // built-in, which would read as a choice nobody made.
  it('and the row reports no face at all until one is set', () => {
    expect(quoteFaceFor({}, 'German')).toBeNull()
    expect(quoteFaceFor({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, 'German').id).toBe('literata')
  })
})

// THE PICTURE AND THE CARD MUST NOT DISAGREE, which is the one place this could
// have been half-built: the share image draws on a canvas and has no stylesheet
// to read, so a class was never going to reach it. `languageFamily` is the same
// answer as a family name, and the payload carries the quote's language for no
// other purpose.
describe('the share image sets the quote in the same face', () => {
  it('hands the family out for a language that has one', () => {
    applyFonts({ fontsByLanguage: JSON.stringify({ german: 'literata' }) }, '')
    expect(languageFamily('German')).toBe('Literata')
    expect(languageFamily('English'), 'a language with no face named one').toBe('')
  })

  // The ladder does NOT apply here, and that is deliberate rather than an
  // oversight: the image's quote stack already carries the Indic faces after the
  // Latin one, so a Bengali quote with no chosen face draws in the Bengali face
  // exactly as it did — this answers only "did the reader pick one".
  it('and names nothing for a language whose script already answers', () => {
    applyFonts({}, '')
    expect(languageFamily('Bengali')).toBe('')
  })

  it('carries the quote’s language on the payload, with no toggle of its own', () => {
    const share = bookShare({ quote: 'Der Mensch ist frei', language: 'German', title: 'Werke' })
    expect(share.language).toBe('German')
    // Not a field the dialog offers: nothing is DRAWN from it, so it takes no
    // checkbox and no label.
    expect((share.attribution || []).some((a) => a.id === 'language')).toBe(false)
    expect((share.meta || []).some((m) => m.id === 'language')).toBe(false)
  })
})
