// Language marks — what a proverb wears where every other quote wears a face.
//
// THE DECISION THIS FILE GUARDS is that nothing here maps a language to a
// country. The ask was "use flags for languages"; the first answer was to offer
// two dozen of them without ever mapping one, on the grounds that offering is
// not deciding. That reasoning was right and the screen was still wrong — a grid
// of flags at the top of a language's tray is a recommendation whoever wrote it
// — so 1.16.0 took them out of the tray entirely. A language offers the letters of
// its OWN NAME FOR ITSELF, and a flag is still reachable by typing one.
//
// The rule is therefore stronger than it was, not weaker, and it is asserted as
// a property of the WHOLE LIST rather than of the ten rows somebody remembered to
// check: no glyph the app OFFERS may be a flag, anywhere.
//
// AND THE LIST IS NO LONGER TEN. STARTER_LANGUAGES — ten names with four
// hand-typed glyphs each — is gone, and `iso639.js` answers in its place: 86
// languages, each one's glyphs derived from its own autonym. So the assertions
// that used to name a hand-picked letter now name the letter the rule produces,
// and the ones that were properties of the table are properties of 86 rows.

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  applyLanguageMarks,
  currentLanguageEntries,
  glyphFor,
  LanguageMark,
  languageMarksBlob,
  languageMarksState,
  markFor,
  MAX_CUSTOM_MARKS,
  nameFor,
} from '../../src/languages.jsx'
import { LANGUAGES, glyphsFor } from '../../src/iso639.js'

beforeEach(() => applyLanguageMarks({}))

const FLAG = /\p{Regional_Indicator}/u

// A language nothing in this app has ever heard of, which is what the
// never-heard-of cases need now that the list is 86 rather than ten. Yoruba used
// to play this part and cannot: it is row 62.
const UNKNOWN = 'Sylheti'

describe('the app offers a script, never a country', () => {
  it('offers no flag anywhere in the list', () => {
    // Every glyph of every language, not just the default one. The tray renders
    // all four, so checking only the mark would have passed a flag sitting in the
    // second slot — which is exactly the shape of the miss this file exists for.
    const offered = LANGUAGES.flatMap((l) => glyphsFor(l.code))
    expect(offered.filter((g) => FLAG.test(g))).toEqual([])
  })

  // The code and the autonym are as much a stored value as the English name, and
  // all three are already in somebody's library.

  // THE ONE NAME THIS APP OFFERED THAT THE STANDARD DOES NOT. The board form's
  // picker said "Mandarin" for a year, so boards are stored under it; 639-1 calls
  // zh "Chinese". A blank cover on those boards is what the alias prevents.

  // Being confidently wrong about somebody's language is worse than being blank.
})

describe('the reader’s own mark', () => {
  it('wins over the script letter', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"m":"🇧🇩"}}' })
    expect(markFor(['Bengali'])).toBe('🇧🇩')
    // …and leaves the others alone.
    expect(markFor(['Hindi'])).toBe('ह')
  })

  // The only way a language this app has never heard of gets a mark at all.

  // THE TABLE IS THE READER'S OWN LIST NOW. It used to open with ten languages
  // whether or not the reader had a word in any of them; with the starters gone,
  // a row is there because something put it there — a mark, or the caller saying
  // the library holds quotes in it.

})

// THE SHAPE EVERY EXISTING ACCOUNT STORES. A preference string has no migration
// step and is not getting one, so the 1.15.x bare-string entry is read forever.
// An account that had set a mark must not open Settings to find it gone.

