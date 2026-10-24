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

  // AN EMPTY BLOB IS NOT SETTINGS. The server stores nothing for a master at the
  // default with no custom rows, so "" is both "never opened the table" and "put
  // everything back" — and both have to fall through, or a reader who reset would
  // find their old declaration resurrected under them.

  // BUT A BROKEN BLOB DOES NOT. Falling back on a parse error would reorder a
  // library's cards on the strength of a syntax mistake — and the reader whose
  // settings failed to load is precisely the one who should see the app's default,
  // not somebody's stale declaration.

})
