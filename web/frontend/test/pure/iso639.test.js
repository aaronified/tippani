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

// THIS REPO'S SCRIPT NAMES AGAINST UNICODE'S, and it lives here rather than in
// iso639.js on purpose. The module's script names are `fonts.js`'s FONT_ROLES keys —
// they exist to name a font stack, and nothing at run time needs to ask Unicode what
// script a letter is in. A second vocabulary in the module with no caller is the
// seam-with-no-caller this repository already has a name for; a mapping a TEST needs
// belongs to the test.
//
// `japanese` maps to Han because 日本語 is three Han characters. Were a kana row ever
// added, this entry is what would have to say so.
const UNICODE_SCRIPT = {
  latin: 'Latin',
  bengali: 'Bengali',
  devanagari: 'Devanagari',
  gujarati: 'Gujarati',
  gurmukhi: 'Gurmukhi',
  odia: 'Oriya',
  tamil: 'Tamil',
  telugu: 'Telugu',
  kannada: 'Kannada',
  malayalam: 'Malayalam',
  sinhala: 'Sinhala',
  arabic: 'Arabic',
  cyrillic: 'Cyrillic',
  han: 'Han',
  japanese: 'Han',
  hangul: 'Hangul',
  thai: 'Thai',
  lao: 'Lao',
  khmer: 'Khmer',
  myanmar: 'Myanmar',
  syllabics: 'Canadian_Aboriginal',
  greek: 'Greek',
  hebrew: 'Hebrew',
  armenian: 'Armenian',
  georgian: 'Georgian',
  ethiopic: 'Ethiopic',
}

describe('the language list', () => {
  it('has a unique lowercase code on every row, two letters or three', () => {
    // A duplicate code is a row nobody can reach: byKey is a Map, so the second
    // silently wins and the first becomes unreferenced data that still LOOKS
    // present to anyone reading the file.
    //
    // TWO OR THREE, AND THAT IS THE STANDARD'S OWN RULE rather than a relaxation of
    // it. BCP 47 (RFC 5646 §2.2.1) says a primary language subtag is the SHORTEST
    // available code — ISO 639-1 where one exists, 639-3 where none does. Maa has
    // no 639-1 code, so `mas` is its correct tag and a two-letter-only rule would
    // have lost the language rather than upheld anything.
    const seen = new Set()
    for (const l of LANGUAGES) {
      expect(l.code, `${l.name} has a malformed code`).toMatch(/^[a-z]{2,3}$/)
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

// ── THE MARK, and the two objections it was built to answer.
//
// The ten hand-picked rows this list replaces existed because a plain first-rune
// rule collides between languages sharing a script. The tie-break is half of what
// earns the replacement, so these are the pairs the old comment named by hand.
//
// THE OTHER HALF IS THAT NOT COLLIDING IS NOT THE SAME AS IDENTIFYING. The owner's,
// on a mark this file derived and shipped: "Bengali ব vs Assamese অ, assamese should
// get their r, that is uniquely assamese. Same for all languages." অ is the first
// letter of অসমীয়া AND the first vowel of the script both languages write, so it
// said "some Bengali-script language that is not Bengali" and nothing more. A row
// may now carry its own `mark`, and where it does that letter is one no other listed
// language of its script writes — ৰ where Bengali writes র.
//
// UNIQUENESS IS TESTED GLOBALLY HERE BECAUSE IT WAS FALSE. At 8dc0a259 six pairs
// shared a mark (sk/es, lv/pl, zu/it, eu/et, gl/tl, eo/en): the derivation's last
// resort took the autonym's first rune whether or not it was claimed, and no test
// compared marks across the whole list. The comment claimed distinctness; only a
// script that printed all 86 and diffed them found otherwise.
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

  it('gives no two languages the same letter', () => {
    // THE INVARIANT THE WHOLE TIE-BREAK EXISTS FOR, and it was false for six pairs
    // until this case existed — see the note above. Across the WHOLE list rather
    // than per script: two marks that collide are two covers a reader cannot tell
    // apart, and it makes no difference to them which scripts the rows claimed.
    const seen = new Map()
    const clashes = []
    for (const l of LANGUAGES) {
      const m = markFor(l.code)
      if (seen.has(m)) clashes.push(`${l.code} and ${seen.get(m)} both wear ${m}`)
      seen.set(m, l.code)
    }
    expect(clashes).toEqual([])
  })

  it('gives every language exactly one code point to wear', () => {
    // A tile is one glyph. Two code points here is either a decomposed letter — s
    // plus a combining dot, which renders as neither — or a ligature somebody typed
    // as a pair, and both draw wrong at 22px rather than failing loudly.
    for (const l of LANGUAGES) {
      expect([...markFor(l.code)].length, `${l.code} wears ${JSON.stringify(markFor(l.code))}`).toBe(1)
    }
  })

  it('never offers a letter from a script the language does not write', () => {
    // The whole point of dropping the flags was that a language offers ITS OWN
    // SCRIPT. This used to assert the mark was a rune OF THE AUTONYM, which was the
    // same claim while every mark was derived from one; a row's own `mark` need not
    // be in its name — ৰ is not in অসমীয়া and Ж is not in Русский — so the check
    // moved to the thing it was actually protecting.
    //
    // IT IS ALSO THE STRONGER TEST. Cyrillic а and Latin a are one shape and two
    // code points, so a row typed with the wrong one looks perfect and sorts,
    // matches and folds wrong forever. Only a script assertion sees it.
    for (const l of LANGUAGES) {
      const script = UNICODE_SCRIPT[l.script]
      expect(script, `${l.script} is not mapped to a Unicode script name`).toBeTruthy()
      const inScript = new RegExp(`\\p{Script=${script}}`, 'u')
      expect(inScript.test(markFor(l.code)), `${l.code} wears ${markFor(l.code)}, not ${script}`).toBe(true)
      for (const g of glyphsFor(l.code)) {
        expect(inScript.test(g), `${l.code} offers ${g} in its tray, not ${script}`).toBe(true)
      }
    }
  })

  it('offers a tray of its own name, up to four, led by the mark', () => {
    // The tray is the ten hand-picked rows generalised: "which letter stands for my
    // language". FEWER IS A FINE ANSWER — 中文 has two runes and offers two, and an
    // abugida offers the letters it has rather than matras.
    //
    // THE LEAD MAY NOT BE IN THE NAME AND EVERYTHING AFTER IT MUST BE. A row's own
    // mark leads because it is the better answer; the rest are the language's name,
    // so a reader who would rather wear অ than ৰ still finds it one tap away. That
    // is what keeps an explicit mark an OFFER rather than a decision taken for them.
    expect(glyphsFor('zh')).toEqual(['中', '文'])
    expect(glyphsFor('bn')).toEqual(['ব', 'ল'])
    expect(glyphsFor('as')).toEqual(['ৰ', 'অ', 'স', 'ম'])
    for (const l of LANGUAGES) {
      const tray = glyphsFor(l.code)
      expect(tray.length, `${l.code} offers ${tray.length}`).toBeGreaterThan(0)
      expect(tray.length).toBeLessThanOrEqual(4)
      expect(tray[0], `${l.code}'s tray does not lead with its mark`).toBe(markFor(l.code))
      expect(new Set(tray.map((g) => g.toLowerCase())).size, `${l.code} repeats a glyph`).toBe(tray.length)
      for (const g of tray.slice(1)) {
        expect([...l.autonym], `${l.code} offers a rune it does not have`).toContain(g)
      }
    }
    expect(glyphsFor('Sylheti')).toEqual([])
  })

  it('lets a row name its own letter, and that letter wins', () => {
    // THE OWNER'S CASE, AS A VALUE. অ was the derivation's answer and it identified
    // no language; ৰ is the letter Assamese writes where Bengali writes র.
    expect(markFor('as')).toBe('ৰ')
    expect(markFor('as')).not.toBe('অ')
    // Bengali KEEPS ব rather than taking র, and that is a choice rather than an
    // oversight. র and ৰ differ by one short diagonal, so the principled pair (র,
    // ৰ) draws two covers a reader cannot tell apart at 22px — which is the failure
    // being fixed, arrived at from the other direction. ব is the first letter of
    // বাংলা and shares no shape with ৰ.
    expect(markFor('bn')).toBe('ব')
    // Every explicit mark is what markFor answers, with no derivation in between.
    for (const l of LANGUAGES.filter((x) => x.mark)) {
      expect(markFor(l.code), `${l.code} did not keep its own mark`).toBe(l.mark)
    }
  })

  it('is fixed by this file and not by what the reader happens to have', () => {
    // A tie-break resolved against the reader's own set would change a board's
    // cover because they added a DIFFERENT language. Asserted as values, so a
    // change to the list order that moves a mark shows up here rather than on
    // somebody's shelf.
    expect(markFor('bn')).toBe('ব')
    expect(markFor('ar')).toBe('ا')
    expect(markFor('ur')).toBe('ے')
    expect(markFor('en')).toBe('E')
    expect(markFor('el')).toBe('Σ')
  })

  it('answers nothing for a language it has never heard of', () => {
    expect(markFor('Sylheti')).toBe('')
  })
})
