// Copy and share on a favourite tile — and the reason they were missing.
//
// THE BUG THIS FILE EXISTS FOR was invisible in every way a bug can be. Home's
// FavouriteTile asked the registry what could be done to a favourite and passed
// the favourite's OWN kind: `book`, `screen` or `quote`. Two of those are fine.
// The first is not — a favourite of kind `book` is a highlight OUT OF a book,
// while `book` is what the registry calls the book itself, and isWorkKind()
// gates copy and share on exactly that:
//
//     available: !isWork && !!ctx.copy
//
// So every book favourite came back with no copy and no share. The tile drew
// correctly. The handlers were wired and correct. QuoteTools rendered null,
// because null is what it renders for an empty list — and an empty row looks
// exactly like a row nobody has added yet.
//
// That is what let it survive being "fixed": 1.15.3 moved the tools row onto the
// collapsed tile, the row was genuinely added, and it still drew nothing.
//
// TWO HALVES, because the defect lived in the seam between them and either half
// alone passes. The registry half pins what the action names mean. The source
// half reads Home's own table and checks it names one of the good ones — read
// rather than run, the same technique icon-imports uses, because the failure was
// a screen asking the wrong question rather than rendering the wrong picture.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { actionsFor, atRow, isWorkKind } from '../../src/actions.jsx'

// TIPPANI_SRC, not cwd — the same seam icon-imports and infodot-copy use.
const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const home = readFileSync(join(SRC, 'Home.jsx'), 'utf8')

const row = { id: 1, quote: 'The book is the author’s. The margin is yours.' }
const toolsFor = (kind) =>
  atRow(actionsFor(kind, row, { copy: () => {}, share: () => {} })).map((a) => a.id)

describe('what the registry will put in a quote card’s tools row', () => {
  it('gives copy and share to the three QUOTE kinds', () => {
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(toolsFor(kind), kind).toEqual(['copy', 'share'])
    }
  })

  // The failing case, pinned rather than merely fixed: a work has no words of
  // its own to copy and no share card, so asking on its behalf correctly gets
  // nothing. Anyone who reintroduces the old call sees why here.
  it('gives neither to a work, which is what a highlight was being read as', () => {
    expect(toolsFor('book')).toEqual([])
    expect(toolsFor('movie')).toEqual([])
  })
})

describe('the kind Home’s favourite table reports to the registry', () => {
  // One `actionKind` per entry in FAV_KINDS. Reading the source keeps this
  // honest without importing the whole screen — and makes a FOURTH kind added
  // without one a failure rather than a silent inheritance of the wrong answer.
  const declared = [...home.matchAll(/actionKind:\s*'([a-z]+)'/g)].map((m) => m[1])

  it('names one for every kind of favourite', () => {
    const favKinds = [...home.matchAll(/^const FAV_KINDS = \{$/gm)]
    expect(favKinds.length, 'FAV_KINDS should be declared exactly once').toBe(1)
    // book, screen, quote.
    expect(declared.length).toBe(3)
  })

  it('and never names a work kind, because copy and share are gated off it', () => {
    for (const kind of declared) {
      expect(isWorkKind(kind), `actionKind '${kind}' is a work kind`).toBe(false)
      expect(toolsFor(kind), `actionKind '${kind}'`).toEqual(['copy', 'share'])
    }
  })

  it('reads a book favourite as the annotation it actually is', () => {
    expect(declared).toEqual(['annotation', 'dialogue', 'quote'])
  })

  // The call site itself, so the table cannot be right while the code that reads
  // it still passes the raw kind through.
  it('and FavouriteTile asks using the table rather than the favourite’s own key', () => {
    expect(home).toMatch(/actionsFor\(meta\.actionKind,/)
    expect(home).not.toMatch(/actionsFor\(f\.kind/)
  })
})
