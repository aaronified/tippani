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
import { QUOTE_KINDS, quoteKindLabel, quoteKindMeta, quoteKindOptions } from '../../src/quoteKind.js'
import { t } from '../../src/i18n.js'

describe('the five kinds', () => {
  it('are the five, in the order the form offers them', () => {
    expect(QUOTE_KINDS).toEqual(['speech', 'letter', 'essay', 'proverb', 'other'])
  })

  it('each has a word in the interface language', () => {
    // A missing token renders as the key, which on a card is a shelf heading
    // reading "vocab.quote-kind.essay.label".
    const missing = QUOTE_KINDS.filter((k) => quoteKindLabel(k).includes('quote-kind'))
    expect(missing).toEqual([])
  })

  it('offers the unset answer first, and it is a real answer', () => {
    const opts = quoteKindOptions()
    expect(opts[0][0]).toBe('')
    expect(opts[0][1]).toBe(t('vocab.quote-kind.unset.label'))
    expect(opts).toHaveLength(QUOTE_KINDS.length + 1)
  })

  it('has no label for the unset value, which is not the same as "(not set)"', () => {
    // A card's meta line joins what it is given with " · ", so a label here would
    // print "(not set)" on every quote nobody has filed.
    expect(quoteKindLabel('')).toBe('')
    expect(quoteKindLabel(undefined)).toBe('')
    expect(quoteKindLabel('radio')).toBe('')
  })
})

describe('what a card shows', () => {
  it('is the kind, when there is one', () => {
    expect(quoteKindMeta({ kind: 'proverb', medium: 'radio' })).toBe(t('vocab.quote-kind.proverb.label'))
  })

  it('falls back to the old free-text medium when there is not', () => {
    // The value the one-time pass declined to guess at. Showing it is what makes
    // it visible as work to do.
    expect(quoteKindMeta({ kind: '', medium: 'radio' })).toBe('radio')
  })

  it('is empty when there is neither, rather than a word about nothing', () => {
    expect(quoteKindMeta({ kind: '', medium: '' })).toBe('')
    expect(quoteKindMeta({})).toBe('')
    expect(quoteKindMeta(null)).toBe('')
  })
})
