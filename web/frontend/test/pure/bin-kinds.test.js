// Every kind the bin can hold has a word, a glyph and a plural — in both languages.
//
// THE FAILURE THIS EXISTS FOR is a bin row that renders the raw wire word. The
// server's kinds are enumerated in a CHECK constraint (0058, 0060), and each one
// that reaches the list needs three entries in BinPage's tables plus keys in
// en.txt and bn.txt. Nothing connected those two lists, so a migration adding a
// kind shipped a row labelled `person-delete` with no icon and no filter chip —
// which is exactly what happened here and is why this file was written.
//
// It reads the MIGRATION rather than a copy of the list, because a copy is the
// drift surface the check is meant to close.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TRASH_CHILD_NOUN, TRASH_LABELS } from '../../src/BinPage.jsx'

const SRC = process.env.TIPPANI_SRC
const repo = join(SRC, '..', '..', '..')
const read = (f) => readFileSync(join(repo, f), 'utf8')

// The kinds the schema allows, taken from the LAST migration that rebuilds the
// CHECK — which is how SQLite makes this list change at all.
function kindsFromSchema() {
  const sql = read('internal/store/migrations/0060_trash_character_merge.sql')
  const m = sql.match(/CHECK \(kind IN \(([\s\S]*?)\)\)/)
  if (!m) throw new Error('0060 no longer declares the trash kind CHECK')
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
}

// 'account' is written by admin deletion and never listed as a bin row a reader
// filters, but it carries a label anyway — so nothing is exempted here.
const KINDS = kindsFromSchema()

describe('the bin can name everything it holds', () => {
  it('reads a real list of kinds out of the migration', () => {
    // The anchor: if the parse breaks, every assertion below passes vacuously.
    expect(KINDS.length).toBeGreaterThanOrEqual(9)
    expect(KINDS).toContain('person-delete')
    expect(KINDS).toContain('character-merge')
  })

  it('has a label for every one of them', () => {
    for (const kind of KINDS) {
      expect(TRASH_LABELS[kind], `the bin has no word for ${kind}`).toBeTruthy()
    }
  })

  // WHAT THE NUMBER ON A ROW IS COUNTING. Every row used to say "quote", which was
  // right for a binned book and wrong for a merge — a merged author read "1 quote"
  // for a book. A kind may legitimately count nothing (the two record deletes, whose
  // children are aliases, cast pairings and lines together, with no honest single
  // noun); what it may not do is count them in somebody else's unit.
  it('never counts a merge in quotes', () => {
    for (const kind of ['person-merge', 'character-merge']) {
      expect(TRASH_CHILD_NOUN[kind], `${kind} counts works, not quotes`).toBe('unit.work')
    }
  })

  it('counts a binned work in quotes, which is the case the phrase was written for', () => {
    expect(TRASH_CHILD_NOUN.book).toBe('unit.quote')
  })

  it('resolves every one of those labels in English and in Bengali', () => {
    const en = read('internal/i18n/en.txt')
    const bn = read('internal/i18n/bn.txt')
    for (const kind of KINDS) {
      const key = TRASH_LABELS[kind]
      // The plural key is the label's, one segment over — the filter chips use it.
      const plural = key.replace(/\.label$/, '.plural')
      for (const [lang, text] of [['en', en], ['bn', bn]]) {
        expect(text.includes(`${key} =`), `${lang}.txt has no ${key}`).toBe(true)
        expect(text.includes(`${plural} =`), `${lang}.txt has no ${plural}`).toBe(true)
      }
    }
  })
})
