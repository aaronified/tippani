// EVERY POOL A FIELD ASKS FOR IS A POOL THE SERVER SERVES.
//
// `vocab: 'characters'` on a field spec is a promise about a key in
// `/search/vocabulary`'s reply, and nothing about a wrong one fails: `useVocabulary`
// answers an unknown key with `[]`, so a typo — `character` for `characters`, or a
// list nobody ever wrote — is a box that silently offers nothing. That is the same
// shape as the bulk wire mismatch this suite already guards: two sides each correct
// about themselves, and no test comparing them.
//
// IT READS THE GO HANDLER, not a list typed here. A list typed here would have been
// written by whoever got it wrong and would agree with them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BULK_QUOTE_FIELDS, BULK_WORK_FIELDS } from '../../src/bulkOps.jsx'
import { WRITABLE_FIELDS } from '../../src/StagingPage.jsx'
import { SRC } from '../src-files.js'

const GO = (f) => readFileSync(join(SRC, '..', '..', '..', 'internal', 'httpapi', f), 'utf8')
const HANDLER = GO('vocabulary_handler.go')

// Every `{"key", ...}` row of the handler's spec table, plus the two id-bearing
// lists it builds after the loop.
const served = new Set([
  ...[...HANDLER.matchAll(/^\s*\{"([a-z_]+)",\s*`/gm)].map((m) => m[1]),
  ...[...HANDLER.matchAll(/^\s*\{"([a-z_]+)",\s*`SELECT id/gm)].map((m) => m[1]),
])

// The pool names the two bulk panels ask for.
const asked = [
  ...[...BULK_QUOTE_FIELDS, ...BULK_WORK_FIELDS]
    .filter((f) => f.vocab)
    .map((f) => ({ where: `bulkOps ${f.key}`, key: f.vocab })),
  ...WRITABLE_FIELDS
    .filter(([, , opts]) => opts?.vocab)
    .map(([key, , opts]) => ({ where: `staged ${key}`, key: opts.vocab })),
]

describe('the pools the bulk panels ask for', () => {
  it('reads the handler at all', () => {
    // A scan that matched nothing would pass the case below in silence.
    expect(served.has('speakers'), 'the vocabulary handler no longer parses the way this reads').toBe(true)
    expect(served.has('occasions'), 'the occasions list is gone from the handler').toBe(true)
    expect(served.size, 'too few lists found to be reading the real table').toBeGreaterThan(8)
  })

  it('and there are fields asking for them', () => {
    // The other half of the floor: an empty `asked` satisfies the assertion below
    // without comparing anything, which is what a dropped `vocab` key would look like.
    expect(asked.length, 'no field names a pool — the vocab key is gone from both panels').toBeGreaterThan(8)
  })

  it('are every one of them served', () => {
    const missing = asked.filter((a) => !served.has(a.key)).map((a) => `${a.where} -> ${a.key}`)
    expect(missing, 'a field asks for a list /search/vocabulary does not return').toEqual([])
  })

  it('and BOTH panels ask, so one cannot quietly stop', () => {
    // The live panel is SelectionBar, the staged one is StagingPage, and they are
    // two files that drew the same bare box for the same reason. Whichever is fixed
    // alone is the one that goes on being right.
    expect(asked.some((a) => a.where.startsWith('bulkOps')), 'the live bulk panel names no pool').toBe(true)
    expect(asked.some((a) => a.where.startsWith('staged')), 'the staged bulk panel names no pool').toBe(true)
  })
})
