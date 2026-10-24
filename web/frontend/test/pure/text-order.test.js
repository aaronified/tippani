// WHO DECIDES HOW MUCH OF THE ORIGINAL A CARD SHOWS.
//
// The owner's four states and three scopes, and the precedence between them:
// "the work controls will supercede the metadata controls."
//
// WHY THE PRECEDENCE IS THE THING WORTH TESTING. Each individual state is a line
// of `quoteTexts` and is covered beside it; what can go wrong here is a scope
// being consulted in the wrong order, or an empty value being read as an opinion
// rather than as silence. Both are silent in a screenshot: a card shows SOME text
// either way, and the reader only finds out their per-work setting is being
// ignored by comparing two screens.

import { describe, expect, it } from 'vitest'
import { resolveTextOrder } from '../../src/textOrder.js'

describe('the precedence', () => {
  const byLanguage = { german: 'trans-first' }

  it('lets the work overrule the language', () => {
    expect(resolveTextOrder({ scope: 'quote-only', language: 'German', byLanguage, master: 'trans-only' }))
      .toBe('quote-only')
  })
})
