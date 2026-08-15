// Language marks — what a proverb wears where every other quote wears a face.
//
// THE DECISION THIS FILE GUARDS is that nothing here maps a language to a
// country. The ask was "use flags for languages", and flags are offered — but a
// flag is a country and a language is not, so the built-in is a letter from the
// language's own script and a flag is one tap away. A default flag would be the
// app telling somebody which country owns their mother tongue, and it is exactly
// the kind of thing that gets added later by someone filling in a table.

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  applyLanguageMarks,
  glyphFor,
  LanguageMark,
  languageMarksBlob,
  languageMarksState,
  markFor,
  MARK_PALETTE,
  STARTER_LANGUAGES,
} from '../../src/languages.jsx'

beforeEach(() => applyLanguageMarks({}))

describe('no language has a flag until its reader gives it one', () => {
  it('ships no flag for any starter language', () => {
    const flag = /\p{Regional_Indicator}/u
    for (const l of STARTER_LANGUAGES) {
      expect(flag.test(markFor([l.name])), `${l.name} arrived wearing a flag`).toBe(false)
      expect(flag.test(l.glyph)).toBe(false)
    }
  })

  it('offers flags in the tray, which is a different thing', () => {
    expect(MARK_PALETTE.some((m) => /\p{Regional_Indicator}/u.test(m))).toBe(true)
  })

  it('defaults to the script letter', () => {
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
    applyLanguageMarks({ languageMarks: '{"bengali":"🇧🇩"}' })
    expect(markFor(['Bengali'])).toBe('🇧🇩')
    // …and leaves the others alone.
    expect(markFor(['Hindi'])).toBe('अ')
  })

  // The only way a language the starter list never heard of gets a mark at all.
  it('gives an unlisted language a mark', () => {
    applyLanguageMarks({ languageMarks: '{"yoruba":"🇳🇬"}' })
    expect(markFor(['Yoruba'])).toBe('🇳🇬')
  })

  it('survives a blob that is not JSON, without taking the screen down', () => {
    applyLanguageMarks({ languageMarks: 'bengali=flag' })
    expect(markFor(['Bengali'])).toBe('অ')
  })

  it('lists every starter plus anything the reader has marked', () => {
    applyLanguageMarks({ languageMarks: '{"yoruba":"🇳🇬"}' })
    const rows = languageMarksState()
    expect(rows.length).toBe(STARTER_LANGUAGES.length + 1)
    const yoruba = rows.find((r) => r.key === 'yoruba')
    expect(yoruba.mark).toBe('🇳🇬')
    expect(yoruba.glyph).toBe('') // no script letter was ever claimed for it
  })

  // An empty mark means "back to the script letter", so it must not be stored —
  // the absence IS the default, and a stored "" would be a mark that draws
  // nothing and cannot be told from a bug.
  it('serialises an empty mark as no mark', () => {
    expect(languageMarksBlob({ Bengali: '🇧🇩' })).toBe('{"bengali":"🇧🇩"}')
    expect(languageMarksBlob({ Bengali: '' })).toBe('')
    expect(languageMarksBlob({})).toBe('')
  })
})

describe('the mark on a card', () => {
  it('draws the mark and names the language for a screen reader', () => {
    applyLanguageMarks({ languageMarks: '{"bengali":"🇧🇩"}' })
    render(<LanguageMark languages={['Bengali']} />)
    expect(screen.getByLabelText('in Bengali').textContent).toBe('🇧🇩')
  })

  // Nothing rather than an empty circle: a blank disc where a face goes reads as
  // a portrait that failed to load.
  it('draws nothing at all when there is no mark to draw', () => {
    const { container } = render(<LanguageMark languages={['Yoruba']} />)
    expect(container.textContent).toBe('')
  })
})
