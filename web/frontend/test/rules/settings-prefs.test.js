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

import { SECTION_PREFS, UNCOUNTED_PREFS } from '../../src/Settings.jsx'

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
})
