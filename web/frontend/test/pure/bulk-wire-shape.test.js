// WHAT THE BROWSER SENDS, AGAINST WHAT THE HANDLER DECLARES.
//
// THE BUG THIS EXISTS FOR SHIPPED, and it shipped past two green tests. The bulk
// editor's season and episode controls answered 400 on every press and set
// nothing; `chapter_no` had been doing the same for far longer. The cause is one
// line on each side of an HTTP boundary:
//
//   bulkOps.jsx   `number: true`  -> bulkFieldBody emits a JSON NUMBER
//   bulk_handlers.go               `Season *string` -> decodeBody answers 400
//
// NEITHER SIDE WAS WRONG ABOUT ITSELF. `*string` is right: absent, "" and "0" are
// three states and a *int holds two, which is how "clear it" and "season zero"
// stay different answers. `number: true` is right too: the input is numeric and
// must not take name-casing. What was missing was anything that asked whether the
// two agreed — the frontend test asserted the number shape, the Go test asserted
// the string shape, and both passed over a feature that did nothing.
//
// SO THIS READS BOTH SOURCES. Not a list typed here: a list typed here would have
// been written by the same person who got it wrong, and would have agreed with
// them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BULK_QUOTE_FIELDS, BULK_WORK_FIELDS, bulkFieldBody } from '../../src/bulkOps.jsx'
import { SRC } from '../src-files.js'

const GO = (f) => readFileSync(join(SRC, '..', '..', '..', 'internal', 'httpapi', f), 'utf8')

// Every `Name Type `json:"key"`` in a struct, as { key: type }. The type is taken
// verbatim so a *float64 and a *int stay distinguishable — both are numbers on the
// wire, and the point here is number-vs-string, so they fold at the comparison
// rather than at the read.
function declared(src) {
  const out = {}
  for (const m of src.matchAll(/^\s*\w+\s+(\*?[\w.]+)\s+`json:"([a-z_]+)"/gm)) out[m[2]] = m[1]
  return out
}

// What the Go type accepts on the wire. `json.Unmarshal` into a *string refuses a
// number and vice versa, which is exactly the failure being guarded.
const wireOf = (goType) => {
  const t = String(goType).replace(/^\*/, '')
  if (t === 'string') return 'string'
  if (/^(int|int64|float64|uint|uint64)$/.test(t)) return 'number'
  if (t === 'bool') return 'boolean'
  return null // []string and friends — this guard has nothing to say about them
}

const QUOTE_REQ = declared(GO('bulk_handlers.go'))
const WORK_REQ = { ...declared(GO('metadata_bulk.go')) }

describe('the bulk editor and its endpoint agree on every field', () => {
  it('reads both structs at all', () => {
    // A scan that matched nothing would pass every case below in silence.
    expect(Object.keys(QUOTE_REQ).length, 'bulkTagReq no longer parses the way this reads').toBeGreaterThan(15)
    expect(WORK_REQ.published_year, 'the work request no longer declares published_year').toBeTruthy()
  })

  for (const [name, fields, req] of [
    ['a quote field', BULK_QUOTE_FIELDS, QUOTE_REQ],
    ['a work field', BULK_WORK_FIELDS, WORK_REQ],
  ]) {
    it(`sends ${name} in the shape the handler declares`, () => {
      const wrong = []
      for (const spec of fields) {
        const goType = req[spec.key]
        if (!goType) continue // not this endpoint's field, or a list type
        const want = wireOf(goType)
        if (!want) continue
        const sent = typeof bulkFieldBody(spec, '7', false)[spec.key]
        if (sent !== want) wrong.push(`${spec.key}: sends ${sent}, handler takes ${goType}`)
      }
      expect(wrong.sort(), 'a bulk control whose every press is a 400').toEqual([])
    })
  }

  it('and a blank reaches the handler as a clear, not as zero', () => {
    // THE SECOND HALF OF THE SAME BUG. `Number('') || 0` is 0, so a blank on a
    // numeric field sent "season 0" — a real season, where a series keeps its
    // specials — while the CHANGELOG promised it cleared the field. Only a text
    // wire can carry the empty string the server reads as NULL.
    for (const key of ['season', 'episode', 'chapter_no']) {
      const spec = BULK_QUOTE_FIELDS.find((f) => f.key === key)
      expect(spec, `${key} is not in the table`).toBeTruthy()
      expect(bulkFieldBody(spec, '', false), `a blank ${key} does not clear`).toEqual({ [key]: '' })
      expect(bulkFieldBody(spec, '0', false), `${key} zero is not sent as zero`).toEqual({ [key]: '0' })
    }
  })

  it('and a genuinely numeric field still sends a number', () => {
    // The other direction, which is what makes this a rule rather than a blanket
    // "send everything as text": /books/bulk takes *int and *float64, so a year
    // sent as "1851" would 400 just as surely.
    const year = BULK_WORK_FIELDS.find((f) => f.key === 'published_year')
    expect(bulkFieldBody(year, '1851', false)).toEqual({ published_year: 1851 })
    const idx = BULK_WORK_FIELDS.find((f) => f.key === 'series_index')
    expect(typeof bulkFieldBody(idx, '3', false).series_index).toBe('number')
  })
})
