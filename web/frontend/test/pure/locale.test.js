import { beforeAll, describe, expect, it } from 'vitest'
import { EN, value } from '../locale-file.js'
import { KINDS, WORK_KINDS, specFor } from '../../src/workKinds.js'
import { nativeFaceName } from '../../src/fonts.js'

// board sorts by six dimensions and the film by six is a fact about the boards,
// and the board tests drive the real controls to prove it. This file proves the
// table is complete and internally consistent, which is the property no rendered
// test can see.
describe('work kinds', () => {
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
})

// A FACE'S NAME, IN THE SCRIPT IT IS BEING CHOSEN FOR.
//
// WHY THIS IS A PURE TEST AND NOT A JOURNEY. What the two functions below decide
// is a string, and the browser tier already presses the picker that shows it —
// see language-faces.test.jsx, which reads the Bengali name off a rendered
// option. What cannot be asked there is the rule at its edges: a script this app
// knows nothing about, a face with no entry, a family the measurement cannot
// judge. Those are the cases where "fall back to Latin" either holds or quietly
// starts showing boxes.
//
// THE OWNER'S REASON, in their words: "if a font doesn't natively support a
// script, it is very hard to see what it will show when chosen to render that
// script."
describe('font script names', () => {
  describe("a face's name in another script", () => {
    // THE HALF THAT MATTERS MORE. A Latin-only face named in Bengali would be a
    // promise the face cannot keep, and the reader finds out only when a quote
    // turns into boxes.
    it('is empty where it cannot, so the caller uses the Latin name', () => {
      expect(nativeFaceName('literata', 'bengali')).toBe('')
      expect(nativeFaceName('noto-serif-bengali', 'devanagari')).toBe('')
      expect(nativeFaceName('upload:7', 'bengali')).toBe('')
      // A script this app has no faces for at all — the ninety-odd languages
      // iso639 knows come back with scripts nothing here is written for.
      expect(nativeFaceName('noto-serif-bengali', 'arabic')).toBe('')
      expect(nativeFaceName('noto-serif-bengali', '')).toBe('')
    })
  })
})
