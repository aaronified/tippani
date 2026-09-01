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
// TWO HALVES, because the defect lived in the SEAM between them and either half
// alone passes. This file owns the registry half: what the action names mean,
// and which kinds the gate lets through. The screen half — that a favourite tile
// actually draws the row — is in test/dom/home-favourites.test.jsx, where it can
// be looked at.

import { describe, expect, it } from 'vitest'
import { actionsFor, atRow, isWorkKind } from '../../src/actions.jsx'

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

// WHAT HOME'S FAVOURITE TABLE REPORTS TO THE REGISTRY is asserted where it can
// be seen: test/dom/home-favourites.test.jsx opens a favourite of each kind and
// looks for Copy and Share on it. This file used to scrape Home.jsx for
// `actionKind:\s*'([a-z]+)'` and `actionsFor(meta.actionKind,` — three regexes
// that are true of a table nothing reads, a tile that never renders the row, and
// a registry call whose result is thrown away. The rule they were guarding —
// that a favourite reports the QUOTE kind and never the work kind, because copy
// and share are gated off works — is above, over toolsFor and isWorkKind
// directly, which is the half a pure test can actually answer.
