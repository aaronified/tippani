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

  it('gives every language up to four of them, all different', () => {
    // FOUR WAS A FLOOR WHEN THE GLYPHS WERE TYPED BY HAND AND IS A CEILING NOW.
    // They come off the language's own name for itself, and 中文 has two letters
    // in it — there is no fourth to offer and inventing one would be the app
    // choosing a letter again, which is the thing that was removed.
    for (const l of LANGUAGES) {
      const g = glyphsFor(l.code)
      expect(g.length, `${l.name} offers none`).toBeGreaterThan(0)
      expect(g.length, `${l.name} offers too many`).toBeLessThanOrEqual(4)
      expect(new Set(g).size, `${l.name} repeats a glyph`).toBe(g.length)
      expect(markFor([l.name]), `${l.name} default`).toBe(g[0])
    }
  })

  it('keeps the four Latin languages apart', () => {
    // A cover that was the identical letter on all four would say nothing about
    // which board you were looking at. This held when the letters were chosen by
    // hand; it has to go on holding now they are derived.
    const latin = ['English', 'Spanish', 'French', 'Portuguese'].map((n) => glyphFor([n]))
    expect(new Set(latin).size).toBe(4)
  })

  it('does not hand Urdu the Arabic letter', () => {
    // They share a script and are not the same language, which is how a reader
    // tells two shelves apart. It is the MARK that has to differ, not the tray:
    // the tray is now each language's own name, and اردو and العربية genuinely
    // share letters — asserting the trays were disjoint would be asserting that
    // two Arabic-script words have no letter in common.
    expect(markFor(['Urdu'])).not.toBe(markFor(['Arabic']))
  })

  it('defaults to the first letter of its own name', () => {
    expect(markFor(['Bengali'])).toBe('ব') // বাংলা
    expect(markFor(['bengali'])).toBe('ব')
    expect(markFor(['  Hindi '])).toBe('ह') // हिन्दी
  })

  // The code and the autonym are as much a stored value as the English name, and
  // all three are already in somebody's library.
  it('answers to the code and to the autonym too', () => {
    expect(markFor(['bn'])).toBe('ব')
    expect(markFor(['বাংলা'])).toBe('ব')
  })

  // THE ONE NAME THIS APP OFFERED THAT THE STANDARD DOES NOT. The board form's
  // picker said "Mandarin" for a year, so boards are stored under it; 639-1 calls
  // zh "Chinese". A blank cover on those boards is what the alias prevents.
  it('still knows the name its own picker used to offer', () => {
    expect(markFor(['Mandarin'])).toBe(markFor(['Chinese']))
    expect(markFor(['Mandarin'])).not.toBe('')
  })

  // Being confidently wrong about somebody's language is worse than being blank.
  it('guesses nothing for a language it does not know', () => {
    expect(markFor([UNKNOWN])).toBe('')
    expect(glyphFor([UNKNOWN])).toBe('')
    expect(markFor([])).toBe('')
  })
})

describe('the reader’s own mark', () => {
  it('wins over the script letter', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"m":"🇧🇩"}}' })
    expect(markFor(['Bengali'])).toBe('🇧🇩')
    // …and leaves the others alone.
    expect(markFor(['Hindi'])).toBe('ह')
  })

  // The only way a language this app has never heard of gets a mark at all.
  it('gives an unlisted language a mark', () => {
    applyLanguageMarks({ languageMarks: '{"sylheti":{"m":"🇧🇩"}}' })
    expect(markFor([UNKNOWN])).toBe('🇧🇩')
  })

  it('survives a blob that is not JSON, without taking the screen down', () => {
    applyLanguageMarks({ languageMarks: 'bengali=flag' })
    expect(markFor(['Bengali'])).toBe('ব')
  })

  // THE TABLE IS THE READER'S OWN LIST NOW. It used to open with ten languages
  // whether or not the reader had a word in any of them; with the starters gone,
  // a row is there because something put it there — a mark, or the caller saying
  // the library holds quotes in it.
  it('lists what the reader has touched and nothing else', () => {
    applyLanguageMarks({ languageMarks: '{"sylheti":{"m":"🇧🇩"}}' })
    const rows = languageMarksState()
    expect(rows.map((r) => r.key)).toEqual(['sylheti'])
    expect(rows[0].mark).toBe('🇧🇩')
    expect(rows[0].glyphs).toEqual([]) // no script is known for it
  })

  it('lists the languages the caller says the library holds', () => {
    const rows = languageMarksState(['Bengali', 'Hindi'])
    expect(rows.map((r) => r.key)).toEqual(['bengali', 'hindi'])
    expect(rows[0].glyphs).toEqual(glyphsFor('bn'))
  })

  it('opens empty for an account with no marks and no quotes', () => {
    expect(languageMarksState()).toEqual([])
  })
})

// THE SHAPE EVERY EXISTING ACCOUNT STORES. A preference string has no migration
// step and is not getting one, so the 1.15.x bare-string entry is read forever.
// An account that had set a mark must not open Settings to find it gone.
describe('the shape before 1.16.0', () => {
  it('reads a bare string as the mark', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":"🇧🇩"}' })
    expect(markFor(['Bengali'])).toBe('🇧🇩')
    expect(languageMarksState().find((r) => r.key === 'bengali').customs).toEqual([])
  })

  it('reads both shapes out of one blob', () => {
    // What a browser refresh across the upgrade actually produces.
    applyLanguageMarks({ languageMarks: '{"hindi":"अ","bengali":{"m":"ক","c":["✦"]}}' })
    expect(markFor(['Hindi'])).toBe('अ')
    expect(markFor(['Bengali'])).toBe('ক')
    expect(languageMarksState().find((r) => r.key === 'bengali').customs).toEqual(['✦'])
  })

  it('re-serialises it into the new shape', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":"অ"}' })
    expect(languageMarksBlob(currentLanguageEntries())).toBe('{"bengali":{"m":"অ"}}')
  })
})

describe('a language’s own marks', () => {
  it('keeps them per language, not in one shared tray', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"c":["✦"]},"hindi":{"c":["🌙"]}}' })
    const rows = languageMarksState()
    expect(rows.find((r) => r.key === 'bengali').customs).toEqual(['✦'])
    expect(rows.find((r) => r.key === 'hindi').customs).toEqual(['🌙'])
  })

  it('stops at four', () => {
    applyLanguageMarks({ languageMarks: `{"bengali":{"c":["1","2","3","4","5","6"]}}` })
    expect(languageMarksState().find((r) => r.key === 'bengali').customs).toHaveLength(MAX_CUSTOM_MARKS)
  })

  it('drops a repeat rather than drawing it twice', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"c":["✦","✦"]}}' })
    expect(languageMarksState().find((r) => r.key === 'bengali').customs).toEqual(['✦'])
  })

  it('round-trips through the blob', () => {
    expect(languageMarksBlob({ Bengali: { mark: 'ক', customs: ['✦', '🌙'], name: '' } }))
      .toBe('{"bengali":{"m":"ক","c":["✦","🌙"]}}')
  })
})

describe('renaming a language', () => {
  it('changes what it is called and not what it is', () => {
    // The stored language on a quote is never rewritten, so the canonical name
    // still resolves — this is the guarantee that a rename cannot orphan a quote
    // or break the board form's matching.
    applyLanguageMarks({ languageMarks: '{"bengali":{"n":"বাংলা"}}' })
    expect(nameFor(['Bengali'])).toBe('বাংলা')
    expect(markFor(['Bengali'])).toBe('ব')
    const row = languageMarksState().find((r) => r.key === 'bengali')
    expect(row.name).toBe('বাংলা')
    expect(row.canonical).toBe('Bengali')
    expect(row.renamed).toBe(true)
  })

  it('falls back to the name the quote was stored with', () => {
    expect(nameFor(['Bengali'])).toBe('Bengali')
    expect(nameFor([UNKNOWN])).toBe(UNKNOWN)
    expect(nameFor([])).toBe('')
  })

  // THE NAME IS THE ROW NOW, WHICH REVERSES A RULE. A "rename" to the name a
  // language already has used to be dropped, on the reasoning that a row saying
  // nothing is not a setting. That was true while ten starters were rows whether
  // or not anything was stored for them, and false the moment they went: an entry
  // that serialises to nothing is dropped whole, so a reader who added Bengali and
  // gave it no mark would have watched the row appear and be gone on reload.
  it('keeps a language that has nothing but its own name', () => {
    expect(languageMarksBlob({ Bengali: { mark: '', customs: [], name: 'Bengali' } }))
      .toBe('{"bengali":{"n":"Bengali"}}')
  })

  // …and the row still knows it was not renamed, because that question is asked
  // at display time by comparing the two rather than by the field being present.
  it('does not call that a rename', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"n":"Bengali"}}' })
    expect(languageMarksState().find((r) => r.key === 'bengali').renamed).toBe(false)
  })

  it('stores nothing for an entry with nothing in it', () => {
    expect(languageMarksBlob({ Bengali: { mark: '', customs: [], name: '' } })).toBe('')
    expect(languageMarksBlob({})).toBe('')
  })

  it('keeps a renamed language alive with no mark at all', () => {
    // Which is what makes "add a language" work: a new row has nothing but a
    // name, and an entry that serialised to nothing would vanish on reload.
    expect(languageMarksBlob({ sylheti: { mark: '', customs: [], name: 'Sylheti' } }))
      .toBe('{"sylheti":{"n":"Sylheti"}}')
  })
})

describe('the mark on a card', () => {
  it('draws the mark and names the language for a screen reader', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"m":"🇧🇩"}}' })
    render(<LanguageMark languages={['Bengali']} />)
    expect(screen.getByLabelText('in Bengali').textContent).toBe('🇧🇩')
  })

  it('uses the reader’s own name for it', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"m":"অ","n":"বাংলা"}}' })
    render(<LanguageMark languages={['Bengali']} />)
    expect(screen.getByLabelText('in বাংলা')).toBeTruthy()
  })

  // Nothing rather than an empty circle: a blank disc where a face goes reads as
  // a portrait that failed to load.
  it('draws nothing at all when there is no mark to draw', () => {
    const { container } = render(<LanguageMark languages={[UNKNOWN]} />)
    expect(container.textContent).toBe('')
  })
})
