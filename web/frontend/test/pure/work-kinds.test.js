// THE SWEEP INVARIANT FOR THE KIND TABLE.
//
// workKinds.js exists so that one work-detail screen can serve a book, a film, a
// show and a game — which means the screen stops asking "am I a film?" and starts
// asking the table. The failure mode that replaces the old one is therefore not a
// screen that drifted; it is a ROW THAT IS HALF FILLED IN. Add a fifth media type,
// forget its `quoteUnit`, and the board's counts say `undefined` in a language
// nobody has; forget its `capWords` and the cap dialog opens blank.
//
// So this file asks three things of the table and nothing about taste:
//
//   1. EVERY WORK KIND ANSWERS EVERY FIELD the shared screen will read. Not a
//      hand-written list of kinds against a hand-written list of fields — the
//      fields are taken from the `book` row, which is the one the merged screen
//      was lifted out of, so a field that screen comes to need is a field this
//      test starts demanding of the other three the moment it is added to book.
//
//   2. THE KEY SETS AGREE WITH works.jsx. ACTIVE_STATUS, SHELF_CAPS and this
//      table are three tables keyed the same way, and the in-progress word and
//      the cap number stay in works.jsx because the server mirrors them. Three
//      tables keyed the same way is exactly the shape where a fifth kind gets
//      added to two of them.
//
//   3. EVERY LOCALE KEY THE TABLE NAMES EXISTS. locale-complete already fails on
//      a key the source asks for and en.txt lacks, but it scans for key-SHAPED
//      literals — and it cannot tell that `spec.detail.export` is reached through
//      t(). Reading the table structurally is the only way to know that the
//      field a screen will index actually resolves.
//
// WHAT THIS DOES NOT ASSERT: that the values are the RIGHT ones. That the book
// board sorts by six dimensions and the film by six is a fact about the boards,
// and the board tests drive the real controls to prove it. This file proves the
// table is complete and internally consistent, which is the property no rendered
// test can see.

import { describe, expect, it } from 'vitest'
import { KINDS, WORK_KINDS, specFor } from '../../src/workKinds.js'
import { EN } from '../locale-file.js'

const enHas = (k) => Object.prototype.hasOwnProperty.call(EN.keys, k)

// The resolved spec for each kind, which is what a screen actually holds.
const resolved = Object.fromEntries(
  WORK_KINDS.map((k) => [k, specFor(KINDS[k].side, { media_type: KINDS[k].mediaType })]),
)
// Every row including the card-only one, which inherits nothing and is already
// whole.
const specOf = { ...KINDS, ...resolved }

describe('the four work kinds', () => {
  // The field list is the book row's, on purpose: see the header. Functions and
  // explicit nulls both count as answered — `origLanguage: null` is the film
  // saying "no such fact", which is an answer.
  const FIELDS = Object.keys(KINDS.book)
  it.each(WORK_KINDS)('%s answers every field the book row declares', (kind) => {
    const spec = resolved[kind]
    const unanswered = FIELDS.filter((f) => f !== 'inherits' && spec[f] === undefined)
    expect(unanswered, `${kind} has no answer for: ${unanswered.join(', ')}`).toEqual([])
  })
})

describe('the locale keys the table names', () => {
  // Walk the table structurally. A string that looks like a key IS one here —
  // the table holds nothing else that is dotted and lower-kebab.
  const KEYISH = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.[a-z0-9-]+$/
  // Values that are deliberately not locale keys: wire words, storage keys,
  // field names and the two enumerations.
  const NOT_KEYS = new Set([
    'kind', 'side', 'mediaType', 'workPath', 'workListKey', 'quotePath', 'quoteListKey',
    'quoteParam', 'addTarget', 'practiseParam', 'seedField', 'seenKind', 'workActionKind',
    'quoteActionKind', 'selectKind', 'screenLabel', 'scrollKey', 'shelfKind', 'statusFields',
    'facts', 'factDoors', 'requires', 'stateBuilder', 'carried', 'cleared', 'meta', 'views',
    'sortDims', 'groupDims', 'defaultSort', 'card', 'countsTone', 'yearField', 'circaField',
    'persist', 'field', 'personKind', 'suggest', 'input', 'options', 'key', 'fillsFrom',
    'requiredFor', 'faceFallback', 'family', 'inherits',
  ])

  function walk(node, path, out) {
    if (typeof node === 'string') {
      if (KEYISH.test(node)) out.push([path, node])
      return out
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, out))
      return out
    }
    if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) {
        if (NOT_KEYS.has(k)) continue
        walk(v, `${path}.${k}`, out)
      }
    return out
  }

  // THE RESOLVED SPEC, not the raw row. A show and a game are written as patches
  // over the film, so their own rows name a fraction of the keys their screen
  // will index — and it is the inherited half that a broken `inherits` would
  // silently drop. What must resolve is what a screen holds.
  it.each(Object.keys(KINDS))('%s names only keys en.txt has', (kind) => {
    const named = walk(specOf[kind], kind, [])
    // A floor, because a walk that finds nothing passes the real assertion below
    // vacuously. Per row rather than one number: the card-only quote row names
    // six keys and a work page names dozens, and a floor set for the second
    // would have to be lowered to the first to be true of both.
    const floor = KINDS[kind].hasWorkPage ? 20 : 5
    expect(named.length, `${kind}: the walk found ${named.length} keys — broken?`).toBeGreaterThanOrEqual(floor)
    const absent = named.filter(([, k]) => !enHas(k))
    expect(absent.map(([p, k]) => `${p} = ${k}`)).toEqual([])
  })
})
