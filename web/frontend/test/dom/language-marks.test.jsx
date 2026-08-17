// Language marks — what a proverb wears where every other quote wears a face.
//
// THE DECISION THIS FILE GUARDS is that nothing here maps a language to a
// country. The ask was "use flags for languages"; the first answer was to offer
// two dozen of them without ever mapping one, on the grounds that offering is
// not deciding. That reasoning was right and the screen was still wrong — a grid
// of flags at the top of a language's tray is a recommendation whoever wrote it
// — so 1.16.0 took them out of the tray entirely. A language offers four letters
// of its OWN SCRIPT, and a flag is still reachable by typing one.
//
// The rule is therefore stronger than it was, not weaker, and it is asserted as
// a property of the whole starter table rather than of the ten rows somebody
// remembered to check: no glyph the app OFFERS may be a flag, anywhere.

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
  STARTER_LANGUAGES,
} from '../../src/languages.jsx'

beforeEach(() => applyLanguageMarks({}))

const FLAG = /\p{Regional_Indicator}/u

describe('the app offers a script, never a country', () => {
  it('offers no flag anywhere in the starter table', () => {
    // Every glyph of every language, not just the default one. The tray renders
    // all four, so checking only `glyph` would have passed a flag sitting in the
    // second slot — which is exactly the shape of the miss this file exists for.
    const offered = STARTER_LANGUAGES.flatMap((l) => l.glyphs)
    expect(offered.filter((g) => FLAG.test(g))).toEqual([])
  })

  it('gives every language four of them', () => {
    for (const l of STARTER_LANGUAGES) {
      expect(l.glyphs, l.name).toHaveLength(4)
      expect(new Set(l.glyphs).size, `${l.name} repeats a glyph`).toBe(4)
      expect(l.glyph, `${l.name} default`).toBe(l.glyphs[0])
    }
  })

  it('keeps the four Latin languages apart', () => {
    // A cover that was the identical letter on all four would say nothing about
    // which board you were looking at.
    const latin = ['English', 'Spanish', 'French', 'Portuguese'].map((n) => glyphFor([n]))
    expect(new Set(latin).size).toBe(4)
  })

  it('does not hand Urdu the Arabic row', () => {
    // They share a script and are not the same language. Urdu offers the letters
    // Arabic does not have, which is how a reader tells two shelves apart.
    const arabic = STARTER_LANGUAGES.find((l) => l.name === 'Arabic').glyphs
    const urdu = STARTER_LANGUAGES.find((l) => l.name === 'Urdu').glyphs
    expect(urdu.filter((g) => arabic.includes(g))).toEqual([])
  })

  it('defaults to the first letter of that script', () => {
    expect(markFor(['Bengali'])).toBe('অ')
    expect(markFor(['bengali'])).toBe('অ')
    expect(markFor(['  Hindi '])).toBe('अ')
  })

  // Being confidently wrong about somebody's language is worse than being blank.
  it('guesses nothing for a language it does not know', () => {
    expect(markFor(['Yoruba'])).toBe('')
    expect(glyphFor(['Yoruba'])).toBe('')
    expect(markFor([])).toBe('')
  })
})

describe('the reader’s own mark', () => {
  it('wins over the script letter', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":{"m":"🇧🇩"}}' })
    expect(markFor(['Bengali'])).toBe('🇧🇩')
    // …and leaves the others alone.
    expect(markFor(['Hindi'])).toBe('अ')
  })

  // The only way a language the starter list never heard of gets a mark at all.
  it('gives an unlisted language a mark', () => {
    applyLanguageMarks({ languageMarks: '{"yoruba":{"m":"🇳🇬"}}' })
    expect(markFor(['Yoruba'])).toBe('🇳🇬')
  })

  it('survives a blob that is not JSON, without taking the screen down', () => {
    applyLanguageMarks({ languageMarks: 'bengali=flag' })
    expect(markFor(['Bengali'])).toBe('অ')
  })

  it('lists every starter plus anything the reader has touched', () => {
    applyLanguageMarks({ languageMarks: '{"yoruba":{"m":"🇳🇬"}}' })
    const rows = languageMarksState()
    expect(rows.length).toBe(STARTER_LANGUAGES.length + 1)
    const yoruba = rows.find((r) => r.key === 'yoruba')
    expect(yoruba.mark).toBe('🇳🇬')
    expect(yoruba.glyphs).toEqual([]) // no script was ever claimed for it
    expect(yoruba.added).toBe(true) // and it is the reader's, so it may be removed
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
    expect(markFor(['Bengali'])).toBe('অ')
    const row = languageMarksState().find((r) => r.key === 'bengali')
    expect(row.name).toBe('বাংলা')
    expect(row.canonical).toBe('Bengali')
    expect(row.renamed).toBe(true)
  })

  it('falls back to the name the quote was stored with', () => {
    expect(nameFor(['Bengali'])).toBe('Bengali')
    expect(nameFor(['Yoruba'])).toBe('Yoruba')
    expect(nameFor([])).toBe('')
  })

  it('is not stored when it says nothing', () => {
    // A "rename" to the name it already has would keep an entry alive for a
    // language nobody has touched.
    expect(languageMarksBlob({ Bengali: { mark: '', customs: [], name: 'Bengali' } })).toBe('')
    expect(languageMarksBlob({ Bengali: { mark: '', customs: [], name: '' } })).toBe('')
    expect(languageMarksBlob({})).toBe('')
  })

  it('keeps a renamed language alive with no mark at all', () => {
    // Which is what makes "add a language" work: a new row has nothing but a
    // name, and an entry that serialised to nothing would vanish on reload.
    expect(languageMarksBlob({ yoruba: { mark: '', customs: [], name: 'Yorùbá' } }))
      .toBe('{"yoruba":{"n":"Yorùbá"}}')
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
    const { container } = render(<LanguageMark languages={['Yoruba']} />)
    expect(container.textContent).toBe('')
  })
})
