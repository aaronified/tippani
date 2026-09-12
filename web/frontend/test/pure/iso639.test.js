// THE LANGUAGE LIST, held to the three things that make it usable and the one that
// makes it safe.
//
// IT IS AN OFFER AND NEVER A CONSTRAINT, which is the claim the last case makes:
// every language column in this app is free text, so a value this file has never
// heard of must pass through unchanged rather than being refused, blanked or
// coerced. A list that could reject would be a list that loses somebody's Sylheti.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANGUAGES, displayName, glyphsFor, languageFor, markFor, scriptOf } from '../../src/iso639.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('the language list', () => {
  it('has a unique lowercase two-letter code on every row', () => {
    // A duplicate code is a row nobody can reach: byKey is a Map, so the second
    // silently wins and the first becomes unreferenced data that still LOOKS
    // present to anyone reading the file.
    const seen = new Set()
    for (const l of LANGUAGES) {
      expect(l.code, `${l.name} has a malformed code`).toMatch(/^[a-z]{2}$/)
      expect(seen.has(l.code), `${l.code} appears twice`).toBe(false)
      seen.add(l.code)
    }
  })

  it('gives every row a name, an autonym and a script', () => {
    // AN EMPTY AUTONYM IS THE ONE THIS GUARDS. The file's own rule is that a row
    // nobody verified is no row — so a half-filled one, added later in a hurry,
    // must not pass: displayName would silently fall back to the English name and
    // the reader would never know the app had an opinion it could not state.
    for (const l of LANGUAGES) {
      expect(l.name, `${l.code} has no English name`).toBeTruthy()
      expect(l.autonym, `${l.code} (${l.name}) has no autonym`).toBeTruthy()
      expect(l.script, `${l.code} (${l.name}) has no script`).toBeTruthy()
    }
  })

  it('names scripts the way fonts.js already names them', () => {
    // ONE VOCABULARY. fonts.js has had `script: 'bengali'` and
    // `script: 'devanagari'` since the per-script faces landed, and a second
    // spelling here — 'Beng', 'bn-script', 'bangla' — would mean a language whose
    // face silently stops being chosen. Read out of that file rather than
    // restated, so the two cannot drift.
    const fonts = readFileSync(join(ROOT, 'web', 'frontend', 'src', 'fonts.js'), 'utf8')
    const roles = [...fonts.matchAll(/script:\s*'([a-z-]+)'/g)].map((m) => m[1])
    expect(roles.length, 'fonts.js declares no script roles — has the shape changed?').toBeGreaterThan(1)
    for (const role of roles) {
      expect(
        LANGUAGES.some((l) => l.script === role),
        `fonts.js has a face for ${role} and no language here is written in it`,
      ).toBe(true)
    }
  })

  it('matches a stored value by code, English name or autonym', () => {
    // All three are already in somebody's library, and a reader who has been typing
    // one of them for two years must not have to learn which one this file prefers.
    for (const v of ['bn', 'Bengali', 'বাংলা', '  BENGALI  ']) {
      expect(languageFor(v)?.code, `${v} did not resolve`).toBe('bn')
    }
    expect(displayName('Bengali')).toBe('বাংলা')
    expect(scriptOf('bn')).toBe('bengali')
  })

  // THE ONE NAME THIS APP OFFERED THAT THE STANDARD DOES NOT. The board form's
  // picker was STARTER_LANGUAGES' ten names for a year and one of them is not
  // 639-1's: the list said "Mandarin" where zh is "Chinese". Boards are stored under
  // the string that picker offered, so an alias is what keeps their cover glyph —
  // and it is an alias rather than a second name because it is a fact about this
  // app's history, not about the language.
  it('answers to a name this app used to offer under its own spelling', () => {
    expect(languageFor('Mandarin')?.code).toBe('zh')
    expect(displayName('Mandarin')).toBe(displayName('zh'))
    // The canonical keys still win: an alias is added only where nothing is already
    // answering to that spelling, so no real name can ever be shadowed by one.
    for (const l of LANGUAGES) {
      expect(languageFor(l.name)?.code, `${l.name} was shadowed`).toBe(l.code)
      expect(languageFor(l.autonym)?.code, `${l.autonym} was shadowed`).toBe(l.code)
    }
  })

  it('passes an unknown language through untouched', () => {
    // THE CLAIM THAT MAKES IT AN OFFER. Sylheti is a real language with real
    // speakers and no ISO 639-1 code; a reader who typed it must go on seeing it.
    expect(languageFor('Sylheti')).toBeNull()
    expect(displayName('Sylheti')).toBe('Sylheti')
    expect(scriptOf('Sylheti')).toBe('')
    // And nothing blanks an empty value into a word.
    expect(displayName('')).toBe('')
  })
})

// ── THE MARK, and the objection it was built to answer.
//
// The ten hand-picked rows this list replaces existed because a plain first-rune
// rule collides between languages sharing a script. The tie-break is what earns the
// replacement, so these are the pairs the old comment named by hand.
describe('the mark a language wears', () => {
  it('keeps the pairs the hand-picked glyphs existed to separate apart', () => {
    // ARABIC AND URDU are the pair that matters most to this library: both autonyms
    // begin with alef, and a naive rule gives them the same tile. They are also the
    // pair a South Asian shelf is most likely to hold together.
    expect(markFor('ar')).not.toBe(markFor('ur'))
    // BENGALI AND ASSAMESE share a script and a shelf just as often.
    expect(markFor('bn')).not.toBe(markFor('as'))
    // ENGLISH AND SPANISH are the Latin case the old comment cites by name — and
    // they differed only in CASE under a naive rule, which on a cover drawn at one
    // size is one shape with two heights.
    expect(markFor('en').toLowerCase()).not.toBe(markFor('es').toLowerCase())
    expect(markFor('fr')).not.toBe(markFor('pt'))
  })

  it('never offers a rune that cannot stand on its own', () => {
    // THREE KINDS OF UNRENDERABLE TILE, and the third is the one that nearly
    // shipped. Spaces: "Bahasa Indonesia". Punctuation: says nothing about a
    // language. And COMBINING MARKS — বাংলা is ব + া + ং + ল + া, and a dependent
    // vowel sign drawn alone renders as a DOTTED CIRCLE with the mark hung off it,
    // which is exactly the rendering-bug tile the whole rule exists to avoid.
    for (const l of LANGUAGES) {
      const m = markFor(l.code)
      expect(m, `${l.code} has no mark`).toBeTruthy()
      expect(/[\s\p{P}\p{M}]/u.test(m), `${l.code} (${l.name}) offers ${JSON.stringify(m)}`).toBe(false)
      for (const g of glyphsFor(l.code)) {
        expect(/[\s\p{P}\p{M}]/u.test(g), `${l.code} (${l.name}) offers ${JSON.stringify(g)} in its tray`).toBe(false)
      }
    }
  })

  it('offers a tray of its own script, up to four, and never pads it', () => {
    // The tray is the ten hand-picked rows generalised: "which letter stands for my
    // language", four from its own script. FEWER IS A FINE ANSWER — 中文 has two
    // runes and offers two, and an abugida offers the letters it has rather than
    // matras. Padding from another script would be the flags mistake in miniature.
    expect(glyphsFor('zh')).toEqual(['中', '文'])
    expect(glyphsFor('bn')).toEqual(['ব', 'ল'])
    for (const l of LANGUAGES) {
      const tray = glyphsFor(l.code)
      expect(tray.length, `${l.code} offers ${tray.length}`).toBeGreaterThan(0)
      expect(tray.length).toBeLessThanOrEqual(4)
      expect(tray[0], `${l.code}'s tray does not lead with its mark`).toBe(markFor(l.code))
      expect(new Set(tray.map((g) => g.toLowerCase())).size, `${l.code} repeats a glyph`).toBe(tray.length)
      for (const g of tray) expect([...l.autonym], `${l.code} offers a rune it does not have`).toContain(g)
    }
    expect(glyphsFor('Sylheti')).toEqual([])
  })

  it('takes the mark from the autonym’s own script', () => {
    // The whole point of dropping the flags was that a language offers ITS OWN
    // SCRIPT. A mark that came from the English name would put a Latin letter on a
    // Bengali tile, which is the old behaviour wearing a new rule.
    for (const l of LANGUAGES) {
      expect([...l.autonym], `${l.code}'s mark is not from its autonym`).toContain(markFor(l.code))
    }
  })

  it('is fixed by this file and not by what the reader happens to have', () => {
    // A tie-break resolved against the reader's own set would change a board's
    // cover because they added a DIFFERENT language. Asserted as a value, so a
    // change to the list order that moves a mark shows up here rather than on
    // somebody's shelf.
    expect(markFor('bn')).toBe('ব')
    expect(markFor('ar')).toBe('ا')
    expect(markFor('ur')).toBe('ر')
    expect(markFor('en')).toBe('E')
  })

  it('answers nothing for a language it has never heard of', () => {
    expect(markFor('Sylheti')).toBe('')
  })
})
