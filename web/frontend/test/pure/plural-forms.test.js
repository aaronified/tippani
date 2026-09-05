// A PLURAL IS TWO KEYS, NOT ONE VALUE WITH A PIPE IN IT.
//
// THE DEFECT. `common.field.people.characters.summary` read
// `{n} character|{n} characters`, and this app's plural mechanism is the KEY
// SUFFIX — `resolveText` in i18n.js looks up `<key>.<plural category>`, then
// `<key>.other`, then the bare key. Nothing anywhere splits a pipe. So the value
// was printed exactly as written, and a film's People row said
// "Hrishikesh Mukherjee — 3 character|3 characters" on the owner's own phone.
//
// Two keys carried it, in both languages, and neither language's suite noticed:
// `locale-complete` checks that every key has a caller and every caller a key,
// and both of these had both. What was wrong was the SHAPE OF THE VALUE, which
// is what this file is for.
//
// WHY A PIPE SPECIFICALLY. It is the plural syntax of gettext-style catalogues
// and of ICU's simpler cousins, so it is the shape somebody reaches for from
// habit — including a translator working from another project's file. The rule
// has to be written down where the values are, not just known.
import { describe, expect, it } from 'vitest'
import { BUILTINS } from '../locale-file.js'

// Every language the binary ships, parsed by the app's own parser — the one
// `locale-file.js` exists to stop this suite growing a second copy of.
const catalogues = BUILTINS.map(([code, parsed]) => [code, parsed.keys])

describe('a plural in the catalogue', () => {
  it('is written as separate keys, never as one value with a pipe', () => {
    const piped = []
    for (const [code, cat] of catalogues) {
      for (const [k, v] of Object.entries(cat)) {
        // A pipe inside a `{placeholder}` would be something else; none exist,
        // and this is about the value's own text.
        if (v.includes('|')) piped.push(`${code}: ${k} = ${v}`)
      }
    }
    expect(piped, 'these values will be printed with the pipe in them — the app splits nothing').toEqual([])
  })

  it('and the catalogues really were read, so this cannot pass on an empty set', () => {
    // The guard on the guard: a parser that stopped matching would make the case
    // above green over every value in the file.
    expect(catalogues.length, 'no language catalogues were read').toBeGreaterThan(1)
    for (const [code, cat] of catalogues) {
      expect(Object.keys(cat).length, `${code} parsed to nothing`).toBeGreaterThan(100)
    }
  })

  it('gives every language the same plural keys for one message', () => {
    // The other half of the shape: a `.one` in English and no `.one` in Bengali
    // means English pluralises and Bengali silently falls through to `.other` —
    // which is a decision somebody should make in the file, not a hole.
    const family = (cat) => {
      const out = {}
      for (const k of Object.keys(cat)) {
        const m = k.match(/^(.*)\.(zero|one|two|few|many|other)$/)
        if (m) (out[m[1]] ||= new Set()).add(m[2])
      }
      return out
    }
    const [[, base]] = catalogues
    const want = family(base)
    for (const [code, cat] of catalogues.slice(1)) {
      const got = family(cat)
      for (const key of Object.keys(want)) {
        expect(
          got[key] ? [...got[key]].sort() : null,
          `${code} is missing the plural forms for ${key}`,
        ).not.toBeNull()
      }
    }
  })
})
