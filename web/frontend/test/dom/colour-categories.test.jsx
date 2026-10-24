// Colour categories — what a slot is called, what it looks like, and whether it
// is offered.
//
// The rule underneath all of it: the stored TOKEN never moves. Everything here
// is presentation, and the moment that stops being true a Markdown export stops
// round-tripping and nobody finds out until they re-import a year of
// highlights. The Go side asserts the export directly; this side asserts the
// three things a client can get wrong on its own — naming the default bucket,
// hiding a colour off a quote that already wears it, and copying a hex where a
// custom property was needed.
//
// theme.js holds module-level state, so every case re-imports a fresh copy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => {
  vi.resetModules()
  return import('../../src/theme.js')
}

beforeEach(() => {
  document.documentElement.removeAttribute('style')
})
afterEach(() => {
  vi.resetModules()
})

const hl = (n) => document.documentElement.style.getPropertyValue('--hl-' + n)

describe('hiding', () => {

  it('does NOT take it off a quote that already wears it', async () => {
    // The single most important rule here. Hiding is about tidying a picker you
    // have stopped using; a quote silently changing colour because of that would
    // be the app editing your library to match a preference you were not
    // thinking about it with.
    const { applyColors, categoryHex, categoryName, CATEGORY_DEFAULT_HEX } = await load()
    applyColors({ catHidden4: true, catName4: 'Inspirational' })
    expect(categoryHex('orange')).toBe(CATEGORY_DEFAULT_HEX[3])
    expect(categoryName('orange')).toBe('Inspirational')
  })
})

// The name cap. It is fifteen because that is what the Stats breakdown's label
// column is cut to hold outright — the cap and the layout are one number, and
// this is the file that stops them drifting apart.
//
// Lowering it from 24 was not retroactive: rows stored under the old limit are
// still in the database. So the cap is applied on the way IN, where every reader
// sees the same string, rather than in one screen — otherwise Settings would show
// a name capped and the group headings would show it whole.
