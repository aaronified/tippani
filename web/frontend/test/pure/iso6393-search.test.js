// THE LANGUAGE SEARCH, where the function is the observable unit: what a reader
// types into "Find a language" and which languages come back in which order.
// The journey `linking-a-language-to-its-code` proves one pick end to end; this is
// the ranking and the registry's edges, which one pick cannot show.
import { describe, expect, it } from 'vitest'

import {  loadISO6393, searchISO6393 } from '../../src/iso6393.js'

const list = await loadISO6393()
const codes = (q) => searchISO6393(list, q).map((r) => r.code)

describe('finding a language in ISO 639-3', () => {
  it('finds a language by its three-letter code, first', () => {
    expect(codes('grc')[0]).toBe('grc')
  })
})

