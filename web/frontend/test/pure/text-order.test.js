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
import {
  TEXT_ORDERS,
  TEXT_ORDER_DEFAULT,
  foldLanguage,
  masterIsCustom,
  resolveTextOrder,
  textOrderFromReadLanguages,
} from '../../src/textOrder.js'

describe('the four states', () => {
  it('are the owner\'s four and are ordered by how much of the original they show', () => {
    // The order is the slider's, and it is load-bearing: a slider whose stops are
    // not on one axis is four radio buttons wearing a slider's clothes.
    expect(TEXT_ORDERS).toEqual(['trans-only', 'trans-first', 'quote-first', 'quote-only'])
  })

  it('and the default is what the app did before any of this', () => {
    // Anything else reorders every card in every library on upgrade, for a
    // preference nobody expressed.
    expect(TEXT_ORDER_DEFAULT).toBe('quote-first')
    expect(resolveTextOrder({})).toBe('quote-first')
  })
})

describe('the precedence', () => {
  const byLanguage = { german: 'trans-first' }

  it('lets the work overrule the language', () => {
    expect(resolveTextOrder({ scope: 'quote-only', language: 'German', byLanguage, master: 'trans-only' }))
      .toBe('quote-only')
  })

  it('and the language overrule the master', () => {
    expect(resolveTextOrder({ language: 'German', byLanguage, master: 'quote-only' }))
      .toBe('trans-first')
  })

  it('and the master answer when nothing else has an opinion', () => {
    expect(resolveTextOrder({ language: 'Bengali', byLanguage, master: 'trans-only' }))
      .toBe('trans-only')
  })

  // EMPTY IS SILENCE, NOT A STATE, and this is the case that fails quietly. A work
  // that stores '' has no opinion; reading it as an opinion would make every work
  // in the library out-rank every language setting, and the per-language table
  // would appear to do nothing at all.
  it('treats an empty scope as no opinion rather than as a state', () => {
    expect(resolveTextOrder({ scope: '', language: 'German', byLanguage, master: 'quote-only' }))
      .toBe('trans-first')
  })

  it('and an unknown value the same way, at every level', () => {
    // A value from a newer client, or a typo in a hand-edited preference. It must
    // fall through rather than render as nothing.
    expect(resolveTextOrder({ scope: 'sideways', language: 'German', byLanguage, master: 'quote-only' }))
      .toBe('trans-first')
    expect(resolveTextOrder({ language: 'German', byLanguage: { german: 'sideways' }, master: 'quote-only' }))
      .toBe('quote-only')
    expect(resolveTextOrder({ language: 'German', byLanguage: {}, master: 'sideways' }))
      .toBe(TEXT_ORDER_DEFAULT)
  })

  it('and matches a language however the reader typed it', () => {
    // "if i write ENG, that becomes a language for me" — so the name on a quote and
    // the name in the table are both whatever was typed, and they have to meet.
    for (const written of ['German', 'german', ' GERMAN ', 'gErMaN']) {
      expect(resolveTextOrder({ language: written, byLanguage, master: 'quote-only' }), written)
        .toBe('trans-first')
    }
  })

  // A QUOTE WITH NO LANGUAGE IS NOT A FOREIGN QUOTE — the rule the shipped
  // version already had, carried across. It is the commonest row in any library.
  it('and a quote with no language named falls to the master, not to some row', () => {
    expect(resolveTextOrder({ language: '', byLanguage, master: 'quote-first' })).toBe('quote-first')
    expect(resolveTextOrder({ byLanguage, master: 'quote-first' })).toBe('quote-first')
  })
})

describe('retiring readLanguages', () => {
  // THIS HAS TO BE EXACTLY TODAY'S BEHAVIOUR. It is a migration of a preference
  // people already have, and the failure mode is every translated card in a
  // library silently swapping which text is in the big type.
  it('an empty declaration means every quote reads as written, as before', () => {
    for (const raw of ['', '[]', null, undefined, 'not json', '{}']) {
      expect(textOrderFromReadLanguages(raw), JSON.stringify(raw))
        .toEqual({ master: 'quote-first', byLanguage: {} })
    }
  })

  it('and a declaration becomes "those as written, everything else translated first"', () => {
    // Which is what the predicate did: declared -> read as written; undeclared ->
    // the translation leads.
    expect(textOrderFromReadLanguages('["german","bengali"]')).toEqual({
      master: 'trans-first',
      byLanguage: { german: 'quote-first', bengali: 'quote-first' },
    })
  })

  it('and a blank entry is dropped rather than given a row of its own', () => {
    // A row keyed '' would out-rank the master for every untagged quote in the
    // library — the exact defect the "no language is not a foreign quote" rule
    // exists to prevent, reintroduced through the migration.
    expect(textOrderFromReadLanguages('["german","","  "]')).toEqual({
      master: 'trans-first',
      byLanguage: { german: 'quote-first' },
    })
  })
})

describe('the master slider\'s custom state', () => {
  // "when other knobs are adjusted (custom), it will lose contrast, which will
  // indicate custom state."
  it('is quiet while every row agrees with it', () => {
    expect(masterIsCustom('trans-first', {})).toBe(false)
    expect(masterIsCustom('trans-first', { german: 'trans-first', bengali: 'trans-first' })).toBe(false)
  })

  it('and shows as soon as one row does not', () => {
    expect(masterIsCustom('trans-first', { german: 'quote-only' })).toBe(true)
  })

  it('and is not fooled by a row holding something meaningless', () => {
    // An unknown value is not a disagreement, because it is not a state — it
    // resolves to the master anyway, so drawing the master as overridden would
    // report a custom setting the reader cannot see or clear.
    expect(masterIsCustom('trans-first', { german: 'sideways' })).toBe(false)
  })

  it('and reads the default when no master has been stored', () => {
    expect(masterIsCustom('', { german: 'quote-first' })).toBe(false)
    expect(masterIsCustom('', { german: 'trans-only' })).toBe(true)
  })
})

describe('foldLanguage', () => {
  it('is the fold the table and the quote both go through', () => {
    expect(foldLanguage(' ENG ')).toBe('eng')
    expect(foldLanguage(null)).toBe('')
  })
})
