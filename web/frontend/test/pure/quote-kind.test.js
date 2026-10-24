// The quote-kind vocabulary and its words.
//
// WHY IT IS WORTH A PURE TEST. The values on the wire are machine words and the
// words on screen are not, and this is the one module that knows which is which —
// so the failure it protects against is a shelf heading or a card reading
// "speech" in a Bengali interface, which is the sort of thing that ships because
// it looks fine to whoever wrote it.
//
// The other half is the fallback. 0053 kept the free-text `medium` column and its
// values; a quote whose medium the one-time pass could not read has no kind, and
// its card has to go on showing that text or the reader watches a field they
// filled in disappear in the release that replaced it.

import { describe, expect, it } from 'vitest'
import {   quoteKindMeta,  } from '../../src/quoteKind.js'

describe('what a card shows', () => {
  it('falls back to the old free-text medium when there is not', () => {
    // The value the one-time pass declined to guess at. Showing it is what makes
    // it visible as work to do.
    expect(quoteKindMeta({ kind: '', medium: 'radio' })).toBe('radio')
  })
})
