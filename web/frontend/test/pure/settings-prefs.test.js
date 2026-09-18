// EVERY PREFERENCE THE SERVER STORES IS COUNTED BY A SECTION, OR EXCLUDED BY NAME.
//
// WHAT THIS GUARDS. Settings puts a "3 changed" badge on every section tab, and a
// tab you are not standing on draws no rows — so the number comes from a table of
// which preference keys belong to which section. A table like that is only true on
// the day it is written. Add `srWhatever` to the Go struct and wire a row for it,
// and nothing anywhere fails: the badge simply never counts it, and a reader who
// changed it is told the section is all default.
//
// ITS DECLARED EXCEPTION. This file reads the Go struct's json tags — it knows a
// source file, which the testing rule forbids by default. The justification is
// that the thing under test IS a claim about that file: "we have named every key
// it declares". There is no screen that can be driven to discover a key nobody
// wired up, because the symptom of the bug is the absence of a control's effect
// on a number. Nothing observable can serve.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { changedIn, SECTION_PREFS, UNCOUNTED_PREFS } from '../../src/Settings.jsx'

// The struct, by name rather than by line number, so this does not break when the
// file above it grows.
function serverPrefKeys() {
  const src = readFileSync(new URL('../../../../internal/httpapi/auth_handlers.go', import.meta.url), 'utf8')
  const start = src.indexOf('type prefs struct {')
  expect(start, 'the prefs struct should still be called `prefs`').toBeGreaterThan(-1)
  const end = src.indexOf('\n}', start)
  return [...src.slice(start, end).matchAll(/json:"([^",]+)/g)].map((m) => m[1])
}

describe('the settings sections between them account for every preference', () => {
  const owned = Object.values(SECTION_PREFS).flat()

  it('names every key the server stores', () => {
    const known = new Set([...owned, ...UNCOUNTED_PREFS])
    const orphans = serverPrefKeys().filter((k) => !known.has(k))
    expect(orphans, 'these preferences belong to no section and are excluded by none').toEqual([])
  })

  it('invents none', () => {
    const real = new Set(serverPrefKeys())
    expect(owned.filter((k) => !real.has(k)), 'these are counted but the server stores no such key').toEqual([])
    expect(UNCOUNTED_PREFS.filter((k) => !real.has(k)), 'these are excluded but the server stores no such key').toEqual([])
  })

  it('gives each key to exactly one section', () => {
    const twice = owned.filter((k, i) => owned.indexOf(k) !== i)
    expect(twice, 'a key counted by two sections is counted twice').toEqual([])
  })
})

describe('what counts as changed', () => {
  it('counts nothing for a reader who has set nothing', () => {
    expect(changedIn({}, 'review')).toBe(0)
    expect(changedIn(undefined, 'theme')).toBe(0)
  })

  it('counts a preference the reader has set', () => {
    expect(changedIn({ srDaily: 12 }, 'review')).toBe(1)
    expect(changedIn({ srDaily: 12, srTier: 'hard' }, 'review')).toBe(2)
  })

  it('counts only the section asked about', () => {
    const p = { srDaily: 12, accent: 'clay', locale: 'bn' }
    expect(changedIn(p, 'review')).toBe(1)
    expect(changedIn(p, 'theme')).toBe(1)
    expect(changedIn(p, 'lang')).toBe(1)
    expect(changedIn(p, 'sections')).toBe(0)
  })

  it('does not count the shapes the server sends for "nothing here"', () => {
    // An empty string is a text field nobody filled; the empty blobs are what the
    // packed preferences look like before anything is packed into them. Counting
    // them would put "5 changed" on a tab nobody has opened.
    expect(changedIn({ locale: '', fontUi: '' }, 'lang')).toBe(0)
    expect(changedIn({ texTweak: '{}', savedThemes: '[]' }, 'theme')).toBe(0)
  })

  it('does not count false or zero, because that is what unset looks like', () => {
    // THIS CASE ASSERTED THE OPPOSITE AND WAS WRONG. The reasoning was that
    // `hideLibrary: false` is only ever written by somebody switching the Library
    // back on — true of a reader, false of the wire. Only two of the Go struct's
    // seventy-four fields carry `omitempty`, so the server marshals the zero value
    // for every untouched preference and `false` is what "never touched" looks
    // like. A freshly created account read "7 changed" on Theme with this case
    // green.
    expect(changedIn({ hideLibrary: false }, 'sections')).toBe(0)
    expect(changedIn({ quoteMeasure: 0, trueGlass: false }, 'theme')).toBe(0)
  })

  it('counts a boolean that is on, because every one of them is off by default', () => {
    expect(changedIn({ hideLibrary: true }, 'sections')).toBe(1)
    expect(changedIn({ trueGlass: true }, 'theme')).toBe(1)
  })

  it('reads a whole freshly-created account as untouched', () => {
    // The shape the server actually sends a new account: every field present,
    // every one of them a zero value. This is the case the capture found and the
    // one that proves the fix, so it is written as the wire writes it rather than
    // as a tidy subset.
    const fresh = {}
    for (const k of Object.values(SECTION_PREFS).flat()) {
      fresh[k] = typeof k === 'string' && /^(hide|show|sr(Practice|Ladder|Submit)|trueGlass)/.test(k) ? false : ''
    }
    fresh.srDaily = 0
    fresh.quoteLeading = 0
    fresh.quoteMeasure = 0
    for (const section of Object.keys(SECTION_PREFS)) {
      expect(changedIn(fresh, section), `${section} should read as untouched`).toBe(0)
    }
  })
})
