// WHERE THE READER'S SETTINGS COME FROM, while two preferences exist.
//
// `textOrder` is the blob the per-language table writes. `readLanguages` is the
// preference it replaces — the owner's ruling absorbed the declaration into the
// four states — and an account that has one but has never touched the table is
// migrated from it on read.
//
// THIS IS IN test/dom BECAUSE textOrderFrom SHIPS BESIDE THE PROVIDER, not because
// it renders anything: it is the one function that knows both sources exist, and
// it lives with the context it feeds rather than in the pure module, which knows
// only about states.
//
// EVERY CASE HERE FAILS SILENTLY IF WRONG. Each one still produces a working card;
// what changes is which text is in the big type, across a whole library, on
// somebody's next login.

import { describe, expect, it } from 'vitest'

const { textOrderFrom } = await import('../../src/textOrderHost.jsx')

const DECLARED = JSON.stringify(['german'])

describe('two sources, and which wins', () => {
  it('the table\'s blob beats the declaration it replaces', async () => {
    // A reader who has used the new table and still has the old preference must
    // see the table's answer, or the feature appears not to save.
    expect(textOrderFrom({
      textOrder: '{"master":"quote-only"}',
      readLanguages: DECLARED,
    })).toEqual({ master: 'quote-only', byLanguage: {} })
  })

  it('and the declaration answers when there is no blob', async () => {
    // Exactly what the predicate did: declared reads as written, everything else
    // leads with its translation.
    expect(textOrderFrom({ readLanguages: DECLARED })).toEqual({
      master: 'trans-first',
      byLanguage: { german: 'quote-first' },
    })
  })

  // AN EMPTY BLOB IS NOT SETTINGS. The server stores nothing for a master at the
  // default with no custom rows, so "" is both "never opened the table" and "put
  // everything back" — and both have to fall through, or a reader who reset would
  // find their old declaration resurrected under them.
  it('and an empty blob falls through rather than counting as a choice', async () => {
    for (const blob of ['', '{}', '{"byLanguage":{}}', null, undefined]) {
      expect(textOrderFrom({ textOrder: blob, readLanguages: DECLARED }), String(blob))
        .toEqual({ master: 'trans-first', byLanguage: { german: 'quote-first' } })
    }
  })

  // BUT A BROKEN BLOB DOES NOT. Falling back on a parse error would reorder a
  // library's cards on the strength of a syntax mistake — and the reader whose
  // settings failed to load is precisely the one who should see the app's default,
  // not somebody's stale declaration.
  it('and a blob it cannot read is no settings at all, not the old declaration', async () => {
    for (const blob of ['{', 'null', '[]', '"quote-only"', '{"master":']) {
      const got = textOrderFrom({ textOrder: blob, readLanguages: DECLARED })
      expect(got.master, `${blob} fell back to the declaration`).not.toBe('trans-first')
    }
  })

  it('and a reader with neither gets what the app always did', async () => {
    expect(textOrderFrom({})).toEqual({ master: 'quote-first', byLanguage: {} })
    expect(textOrderFrom(undefined)).toEqual({ master: 'quote-first', byLanguage: {} })
  })
})
