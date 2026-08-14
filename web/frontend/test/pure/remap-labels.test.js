// Which speaker labels the remap screen offers.
//
// A line spoken by two characters is stored as one string — "V, Evey" — and the
// screen offered that whole string as a single remappable row. Mapping an ensemble
// onto one cast member is not a thing, and the server would not have matched it
// anyway: it compared the whole stored label, so the mapping answered 200 having
// changed nothing. Both halves were the same bug.
//
// This is the client half, extracted from the fetch it used to be buried inside so
// that the rule can actually be checked.

import { describe, expect, it } from 'vitest'
import { remapLabels } from '../../src/MetadataPage.jsx'
import { DEFAULT_CREDIT_SEPS } from '../../src/people.jsx'
import { utteranceState } from '../../src/Quotes.jsx'

const seps = DEFAULT_CREDIT_SEPS
const lines = (...chars) => chars.map((character) => ({ character }))
const names = (out) => out.map((l) => l.name)

describe('the remappable speaker labels', () => {
  it('offers the individuals from an ensemble, never the ensemble', () => {
    const out = remapLabels(lines('V, Evey'), seps)
    expect(names(out)).toEqual(['Evey', 'V'])
    // The whole string must not survive as a row of its own.
    expect(names(out)).not.toContain('V, Evey')
  })

  it('counts LINES, so the number matches what a mapping will touch', () => {
    const out = remapLabels(lines('V', 'V, Evey', 'Evey', 'Finch'), seps)
    const by = Object.fromEntries(out.map((l) => [l.name, l.count]))
    expect(by).toEqual({ V: 2, Evey: 2, Finch: 1 })
  })

  it('counts a repeated name in one line once', () => {
    // One line naming the same character twice. Counting it twice would promise a
    // remap of two rows and deliver one.
    expect(remapLabels(lines('Evey, Evey'), seps)).toEqual([{ name: 'Evey', count: 1 }])
  })

  it('splits on the comma, the semicolon and the ampersand', () => {
    const out = remapLabels(lines('V & Evey', 'Finch; Dominic'), seps)
    expect(names(out)).toEqual(['Dominic', 'Evey', 'Finch', 'V'])
  })

  it('keeps "X and Y" whole when neither side looks like a full name', () => {
    // splitCredits' own rule, and it is the right one: outside a list context both
    // sides of "and" must be ≥2 words, so "Daniels and Sons" and "William and Mary"
    // survive as the single names they are. Inherited deliberately rather than
    // worked around — a second splitting rule for characters is how the client and
    // the server drift apart.
    expect(names(remapLabels(lines('Delia and Evey'), seps))).toEqual(['Delia and Evey'])
    expect(names(remapLabels(lines('Evey Hammond and Eric Finch'), seps)))
      .toEqual(['Eric Finch', 'Evey Hammond'])
  })

  // KNOWN LIMITATION, pinned rather than hidden.
  //
  // The shared splitter merges a trailing component that is a credit SUFFIX back
  // onto the name before it, so "Ursula Le Guin, Jr" stays one person. Roman
  // numerals are in that set, for "Henry V" and "Elizabeth II" — and a character
  // actually named "V" collides with it head-on: "Evey, V" comes back as one label.
  //
  // Not worked around here. The suffix rule is right for the authors it was written
  // for, and the server splits with the same set, so a client-only exception would
  // make the two disagree about what a component IS — which is the class of bug this
  // whole change exists to remove. Fixing it means teaching BOTH sides that a
  // character list has no suffixes.
  it('merges a name that is also a credit suffix (V, II) — known limitation', () => {
    expect(names(remapLabels(lines('Evey, V'), seps))).toEqual(['Evey, V'])
    // The other order is unaffected, because the suffix rule only looks backwards.
    expect(names(remapLabels(lines('V, Evey'), seps))).toEqual(['Evey', 'V'])
  })

  it('leaves a single name exactly as it is', () => {
    // The common case, and the one the whole screen was built for: an imported
    // label that needs reconciling with the cast.
    expect(remapLabels(lines('Evey Hammond'), seps)).toEqual([{ name: 'Evey Hammond', count: 1 }])
  })

  it('drops speakerless lines rather than offering a blank row', () => {
    // Narration has no speaker. A blank label is unmappable and the server refuses
    // an empty `from`, so a row for it is a control that cannot do anything.
    expect(remapLabels(lines('', '   ', 'V'), seps)).toEqual([{ name: 'V', count: 1 }])
  })

  it('is ordered commonest first, then alphabetically', () => {
    // Stable rather than whatever the object happened to enumerate — a list that
    // reshuffles between loads is a list you have to re-read every time.
    const out = remapLabels(lines('Evey', 'V', 'Evey', 'Adam'), seps)
    expect(names(out)).toEqual(['Evey', 'Adam', 'V'])
  })

  it('survives no dialogue at all', () => {
    expect(remapLabels([], seps)).toEqual([])
    expect(remapLabels(undefined, seps)).toEqual([])
  })
})

// ---- the full-state PUT, and the field it would have thrown away -----------
//
// Every save on the Quotes screen is a FULL-STATE PUT built from utteranceState, so
// a field missing from that object is a field the request CLEARS. The ♥ on a card,
// the colour dots and the selection bar all go through it.
//
// 0034 caught this exact shape on books: `bookState` fed the ♥ on the detail header,
// so favouriting a book cleared the translator that had just been added. 0035 adds
// three more fields to a quote, and the same trap was waiting — recolouring a
// Bengali proverb would have quietly thrown away its category, its language and its
// English translation, with a successful save and no error.
//
// Asserted field by field rather than with a snapshot, so the failure names the one
// that went missing.
describe('utteranceState carries everything a full-state PUT must not clear', () => {
  const row = {
    id: 7,
    quote: 'চোরের মায়ের বড় গলা',
    note: 'a note',
    color: 'blue',
    tags: ['proverb'],
    favorite: true,
    speaker: '',
    occasion: '',
    occasion_date: '',
    place: '',
    medium: '',
    category: 'proverb',
    language: 'Bengali',
    translation: "The thief's mother has the loudest voice",
    sticker_id: 3,
    sticker_x: 0.5,
    sticker_y: 0.25,
  }

  it('keeps the 0035 fields', () => {
    const s = utteranceState(row)
    expect(s.category).toBe('proverb')
    expect(s.language).toBe('Bengali')
    expect(s.translation).toBe("The thief's mother has the loudest voice")
  })

  it('defaults the category rather than sending an empty one', () => {
    // '' would fail the server's validation; 'other' is the column default and what
    // an older row legitimately is.
    expect(utteranceState({ quote: 'x' }).category).toBe('other')
  })

  it('sends nothing for a language and translation that were never set', () => {
    const s = utteranceState({ quote: 'x' })
    expect(s.language).toBe('')
    expect(s.translation).toBe('')
  })

  it('still carries every field it carried before', () => {
    // A regression in the other direction: adding fields must not drop any.
    const s = utteranceState(row)
    for (const k of ['quote', 'note', 'color', 'tags', 'favorite', 'speaker', 'occasion',
      'occasion_date', 'place', 'medium', 'sticker_id', 'sticker_x', 'sticker_y']) {
      expect(s, k).toHaveProperty(k)
    }
  })
})
