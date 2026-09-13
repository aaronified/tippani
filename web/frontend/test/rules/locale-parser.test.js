// The JS half of the locale format's tests. The Go half is
// internal/i18n/i18n_test.go, and the two share internal/i18n/testdata/agree.txt
// and agree.json — the fixture and the PINNED answer.
//
// NEITHER PARSER GENERATES THE OTHER'S EXPECTATION. agree.json is hand-written, so
// a drift in either implementation turns that implementation's own suite red
// rather than the two of them quietly agreeing on something new. Two parsers
// disagreeing about one file format is the failure this arrangement exists to make
// impossible to ship.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseLocale } from '../../src/i18n.js'

// TIPPANI_SRC is web/frontend/src, exported by vitest.config.js because a test
// cannot work out where the source is on its own (see the comment there). The
// fixture lives beside the Go parser, three levels up.
const FIXTURES = join(process.env.TIPPANI_SRC, '..', '..', '..', 'internal', 'i18n', 'testdata')
const raw = readFileSync(join(FIXTURES, 'agree.txt'), 'utf8')
const expected = JSON.parse(readFileSync(join(FIXTURES, 'agree.json'), 'utf8'))

describe('the two parsers agree', () => {
  test('the fixture still holds the line endings it exists to test', () => {
    // .gitattributes marks agree.txt -text so a checkout cannot normalise its CR
    // and CRLF away. Without this, the two assertions below would pass vacuously
    // for ever and the promise "a file edited on Windows parses the same" would
    // have no test at all.
    expect(raw).toContain('\r\n')
    expect(raw).toMatch(/\r[^\n]/)
  })

  test('on the shared fixture, key for key', () => {
    const got = parseLocale(raw)
    expect(got.keys).toEqual(expected.keys)
    expect(got.reserved).toEqual(expected.reserved)
    expect(got.empty).toEqual(expected.empty)
    expect(got.bad).toEqual(expected.bad)
  })
})

describe('one mangled line costs one string', () => {
  test('and the rest of the file loads', () => {
    const f = parseLocale('a.one = first\nnot a line at all\na.two = second\n')
    expect(f.bad).toEqual([2])
    expect(f.keys['a.one']).toBe('first')
    expect(f.keys['a.two']).toBe('second')
  })

  test('a line with a value and no key is mangled too', () => {
    const f = parseLocale(' = orphaned\nreal.key = kept\n')
    expect(f.bad).toEqual([1])
    expect(f.keys).toEqual({ 'real.key': 'kept' })
  })
})

describe('the format', () => {
  test('a value may contain an equals sign', () => {
    expect(parseLocale('hint = press = to compare\n').keys.hint).toBe('press = to compare')
  })

  test('a leading hash is a comment, a hash inside a value is not', () => {
    const f = parseLocale('# a.key = never\n   # indented too\na.key = colour #1\n')
    expect(f.keys).toEqual({ 'a.key': 'colour #1' })
  })

  test('a byte-order mark does not break the first key', () => {
    const f = parseLocale('\uFEFF_name = English\nfirst.key = value\n')
    expect(f.reserved._name).toBe('English')
    expect(f.keys['first.key']).toBe('value')
  })

  test('both halves are trimmed, but a non-breaking space survives', () => {
    // A translator's NBSP is a character they typed on purpose — French
    // punctuation needs one before a colon — so trimming it would silently
    // correct their language.
    const f = parseLocale('  spaced   =   value  \nnbsp =\u00a0kept\u00a0\n')
    expect(f.keys.spaced).toBe('value')
    expect(f.keys.nbsp).toBe('\u00a0kept\u00a0')
  })

  test('an underscore key is reserved and never a renderable string', () => {
    const f = parseLocale('_name = X\n_fallback = en\n_dir = rtl\nreal = y\n')
    expect(f.reserved).toEqual({ _name: 'X', _fallback: 'en', _dir: 'rtl' })
    expect(f.keys).toEqual({ real: 'y' })
  })

  test('a duplicate key is last wins, in both directions', () => {
    expect(parseLocale('k = one\nk = two\n').keys.k).toBe('two')
    // Re-appearing empty un-sets it…
    let f = parseLocale('k = one\nk =\n')
    expect(f.keys.k).toBeUndefined()
    expect(f.empty).toEqual(['k'])
    // …and re-appearing with a value un-empties it.
    f = parseLocale('k =\nk = two\n')
    expect(f.keys.k).toBe('two')
    expect(f.empty).toEqual([])
  })
})

describe('an empty value is absent rather than empty', () => {
  test('so a half-finished template does not blank the interface', () => {
    // This is the rule that makes `node scripts/locale-template.mjs` output safe
    // to drop in unfilled: every key is there with nothing after the =, and every
    // one of them falls through the chain instead of rendering as blank.
    const f = parseLocale('filled = yes\nunfilled =\n')
    expect(f.keys).toEqual({ filled: 'yes' })
    expect(f.empty).toEqual(['unfilled'])
    expect(f.bad).toEqual([])
  })
})

describe('nothing at all', () => {
  test('an empty file, a whitespace file and a comment-only file all parse to nothing', () => {
    for (const src of ['', '\n\n\n', '   \n\t\n', '# only a comment\n', '\uFEFF', null, undefined]) {
      const f = parseLocale(src)
      expect(f.keys).toEqual({})
      expect(f.reserved).toEqual({})
      expect(f.bad).toEqual([])
    }
  })
})
