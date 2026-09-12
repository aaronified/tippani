// THE ANTHOLOGY FIELD REGISTRY, IN TWO LANGUAGES (0074).
//
// An anthology's switch list exists twice: `anthologyRegistry` in
// `internal/httpapi/anthology_registry.go`, which decides what the export writes
// and what `shows` will answer for, and `FIELD_SWITCHES` / `WORK_SWITCHES` in
// `src/anthologies.jsx`, which decides what the form offers and what the reading
// view draws. Neither can import the other.
//
// WHY TWO LISTS ARE ALLOWED TO EXIST AT ALL. The repo already pays this exact cost
// for `addFields.js`, and pays it the same way: the lists are permitted to be two
// and are not permitted to DISAGREE. The alternative — serving the registry from
// an endpoint — buys one list and costs a request on a screen that already has
// everything it needs, for a table that changes about twice a year.
//
// WHAT GOING WRONG LOOKS LIKE, and it is why this is worth a file. A field added
// in Go and not here is a binding the export writes that nothing can switch off.
// A field added here and not in Go is a toggle that does nothing: the server drops
// the key (the registry is the vocabulary), so the switch flips, saves, and comes
// back off — which reads as a broken form rather than as a missing table row.
//
// It READS the Go source rather than restating it, which is archive-header's trick
// and the only kind of cross-language guard worth having: a restatement is a third
// list to keep in step.
//
// fileURLToPath AND NOT `new URL(...).pathname`, per the failure recorded in
// CLAUDE.md: the raw pathname keeps a leading slash and percent-encodes, so on a
// Windows checkout in a directory with a space in its name every test in the file
// dies on ENOENT with nothing in the message about the thing being tested.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const GO = readFileSync(join(ROOT, 'internal', 'httpapi', 'anthology_registry.go'), 'utf8')
const JSX = readFileSync(join(ROOT, 'web', 'frontend', 'src', 'anthologies.jsx'), 'utf8')

// The Go rows are `{Key: "publisher", ...}` — one per line, inside the one slice
// literal. Anchored on the slice so a `Key:` in a comment or in a later helper
// cannot be mistaken for a row.
const goSlice = GO.split('var anthologyRegistry = []anthologyField{')[1].split('\n}')[0]
const goKeys = [...goSlice.matchAll(/\bKey:\s*"([^"]+)"/g)].map((m) => m[1])
// `Col:` marks a 0045 column; a row without one lives in the `fields` blob.
const goRows = goSlice
  .split('\n')
  .filter((l) => /\bKey:\s*"/.test(l))
  .map((l) => ({ key: l.match(/\bKey:\s*"([^"]+)"/)[1], col: /\bCol:\s*"/.test(l) }))

const jsList = (name) => {
  const body = JSX.split(`const ${name} = [`)[1].split('\n]')[0]
  return [...body.matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1])
}
// The client keys the six by their COLUMN (hide_credit) and the rest by the
// registry key, so the six are mapped back before comparing. That mapping is the
// `hide`/`show` prefix and nothing else — asserted below rather than assumed.
const columnKeys = jsList('FIELD_SWITCHES')
// The client splits what Go keeps in one list, because the FORM asks three
// different questions — what the document shows, what the work knows, who is
// answerable — and the registry only has to know where each field is stored. So
// the comparison is against the union, and the split itself is asserted below.
const workKeys = jsList('WORK_SWITCHES')
const personKeys = jsList('PERSON_SWITCHES')
const storedKeys = [...workKeys, ...personKeys]
const unprefixed = (k) => k.replace(/^(hide|show)_/, '')

describe('the two field lists name the same fields', () => {
  it('reads a non-empty registry out of each source', () => {
    // A parser that silently matches nothing would make every assertion below pass
    // over two empty arrays, which is the way a cross-language guard stops testing
    // anything without ever going red.
    expect(goKeys.length).toBeGreaterThan(10)
    expect(columnKeys.length).toBe(6)
    expect(workKeys.length).toBeGreaterThan(0)
    expect(personKeys.length).toBeGreaterThan(0)
  })

  it('splits the stored fields into two lists with nothing in both', () => {
    // A key in WORK_SWITCHES and PERSON_SWITCHES would draw two toggles writing one
    // flag: pressing either moves the other, which reads as the form fighting back.
    const both = workKeys.filter((k) => personKeys.includes(k))
    expect(both).toEqual([])
  })

  it('has the same six column-backed fields on both sides', () => {
    const goCols = goRows.filter((r) => r.col).map((r) => r.key).sort()
    expect(columnKeys.map(unprefixed).sort()).toEqual(goCols)
  })

  it('has the same stored fields on both sides', () => {
    const goStored = goRows.filter((r) => !r.col).map((r) => r.key).sort()
    expect([...storedKeys].sort()).toEqual(goStored)
  })

  it('agrees with Go about which stored fields come off the person', () => {
    // Go names them in `personFieldKeys` and the split decides which SELECT reads
    // them; the client names them by which list they are in and the split decides
    // which line they are drawn on. Either half naming a field the other does not
    // is a field the form offers and the server never fills — a toggle that saves
    // and then shows nothing, which looks like a broken record rather than a
    // missing table row.
    const body = GO.split('var personFieldKeys = map[string]bool{')[1].split('}')[0]
    const goPerson = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()
    expect([...personKeys].sort()).toEqual(goPerson)
  })

  it('spells every column-backed switch hide_ or show_, and nothing else', () => {
    // The asymmetry is 0045's and it is load-bearing — four hide_, two show_, so
    // every default is the zero value. A seventh spelling would make `unprefixed`
    // above silently wrong and this comparison meaningless.
    for (const k of columnKeys) expect(k).toMatch(/^(hide|show)_/)
  })

  it('gives every work field a label key the locale files carry', () => {
    // A switch with no label draws an empty row, which is the sort of thing that
    // ships because the list still has the right LENGTH.
    const en = readFileSync(join(ROOT, 'internal', 'i18n', 'en.txt'), 'utf8')
    const labels = ['WORK_SWITCHES', 'PERSON_SWITCHES'].flatMap((name) => {
      const body = JSX.split(`const ${name} = [`)[1].split('\n]')[0]
      return [...body.matchAll(/\blabel:\s*'([^']+)'/g)].map((m) => m[1])
    })
    expect(labels.length).toBe(storedKeys.length)
    for (const key of labels) expect(en).toContain(`\n${key} = `)
  })
})
