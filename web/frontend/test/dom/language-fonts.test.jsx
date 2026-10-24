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
    // A VARIABLE AND NOT font-family, which is the whole of why this works at all
    // — see fonts.js. A rule declaring the family lost to every quote slot's
    // inline style, silently, and that is what shipped for one commit.
    expect(sheet()).toContain(`.${de}{--font-quote:'Literata'`)
  })

  // FOLDED, because the language box is free text and the server stores the
  // folded key — "German" on a quote has to meet "german" in the table.

  // THE SCRIPT RUNG IS STILL THERE, UNDER THE LANGUAGE ONE. A Bengali library
  // where nobody has opened this picker must go on getting the Bengali face.

  // A CARD IS NOT ALWAYS ONE LANGUAGE, so the chosen face carries the Indic ones
  // after it exactly as every role stack does.

  // REPLACED WHOLE, NEVER APPENDED TO: a face that was just cleared has to stop
  // being drawn, and a sheet that only grows would go on setting it until a reload.

  // An `upload:12` whose file is gone, or a face this build dropped, resolves to
  // the display built-in — which would silently override the card with a face
  // nobody chose. Skipping it leaves the script rung to answer.
})

// THE CARD IS WHERE THIS IS SEEN, and quoteTexts is the one function that decides
// which of the two texts is the quote — so the face has to follow the quote there
// rather than be computed beside a render.

// ---- the interface's own faces, per UI language ----------------------------

// THE PICTURE AND THE CARD MUST NOT DISAGREE, which is the one place this could
// have been half-built: the share image draws on a canvas and has no stylesheet
// to read, so a class was never going to reach it. `languageFamily` is the same
// answer as a family name, and the payload carries the quote's language for no
// other purpose.

// ---- THE FACE HAS TO WIN, NOT JUST BE ASKED FOR -----------------------------
//
// WHAT THESE CASES EXIST FOR, and it is the one thing the rest of this file could
// not see. Every quote slot in the app carries an INLINE font-family, and a style
// attribute beats a normal author rule whatever its specificity — so the class
// shipped attached to seven surfaces and changed the face on none of them, with
// 4,191 green tests, because every one of them asserted the CLASS NAME.
//
// jsdom does not resolve `var()` inside font-family, so the honest pair is:
//   1. the element RESOLVES --font-quote to the chosen family (proves the class
//      reaches it and the rule sets a variable rather than a family), and
//   2. its own font-family DEFERS to that variable instead of naming a face.
// Break either and the reader sees the wrong type; assert only the class and you
// see nothing at all.
import { render } from '@testing-library/react'
import { ExpandableText, TranslationLine } from '../../src/ui.jsx'
import { FlowQuote } from '../../src/flow.jsx'
import { MatchWindow } from '../../src/SearchPage.jsx'
import { QUOTE_FACE } from '../../src/fonts.js'

