// THE LANGUAGE SEARCH, where the function is the observable unit: what a reader
// types into "Find a language" and which languages come back in which order.
// The journey `linking-a-language-to-its-code` proves one pick end to end; this is
// the ranking and the registry's edges, which one pick cannot show.
import { describe, expect, it } from 'vitest'

import { iso6393For, loadISO6393, searchISO6393 } from '../../src/iso6393.js'

const list = await loadISO6393()
const codes = (q) => searchISO6393(list, q).map((r) => r.code)

describe('finding a language in ISO 639-3', () => {
  it('finds a language by its three-letter code, first', () => {
    expect(codes('grc')[0]).toBe('grc')
  })

  it('puts the living language before its historical forms', () => {
    // "French" is the likelier answer to "fre" than Old French.
    const hits = codes('french')
    expect(hits[0]).toBe('fra')
    expect(hits.indexOf('fro')).toBeGreaterThan(0)
  })

  it('does not need the diacritic to find a name that has one', () => {
    expect(codes('arbereshe')).toContain('aae')
  })

  it('finds a word inside a name, not only its start', () => {
    expect(codes('greek')).toContain('grc')
  })

  it('offers nothing for nothing typed', () => {
    expect(searchISO6393(list, '   ')).toEqual([])
  })

  it('has no special codes — they are not languages a quote is in', () => {
    const all = new Set(list.map((r) => r.code))
    for (const c of ['mis', 'mul', 'und', 'zxx']) expect(all.has(c), c).toBe(false)
  })
})

describe('the code a language already has', () => {
  it('comes from the two-letter code the app knows it by', () => {
    expect(iso6393For('Bengali')).toBe('ben')
  })

  it('is the one the reader linked, when there is one', () => {
    expect(iso6393For('Greek', 'GRC')).toBe('grc')
  })

  it('is nothing for a language typed free and never linked', () => {
    expect(iso6393For('Tippanese')).toBe('')
  })
})
