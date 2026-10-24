// The action registry: one list of the things you can do to a quote.
//
// The registry exists to stop a divergence, so the tests are about the
// divergence rather than about any one action. Two surfaces will read this list —
// a card and a bulk bar today, a context menu next — and the failure it prevents
// is silent by construction: a menu that offers Delete beside a bar that does not
// looks completely normal on both screens, and nobody notices until somebody
// wonders why they cannot do to forty what they just did to one.
//
// So: every item action has a selection equivalent or is explicitly marked
// `single`, and the ONLY thing marked single is the one that genuinely does not
// generalise. A test that just listed the expected ids would pass for a registry
// that had quietly dropped one.

import { describe, expect, it, vi } from 'vitest'
import { actionsFor, bulkActionsFor } from '../../src/actions.jsx'

const ITEM = { id: 7, quote: 'Only in silence the word' }
// A selection of two. Some actions mean something over a SELECTION and nothing
// over one item that happens to be in one — see the cardinality block at the foot
// of this file — so the length of the list is now load-bearing.
const TWO = [ITEM, { id: 8, quote: 'The unread shelf' }]

// Every callback a screen can own, so nothing is filtered out for being absent.
const full = () => ({
  copy: vi.fn(),
  share: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  addTags: vi.fn(),
  setFields: vi.fn(),
})

describe('what you can do to one quote', () => {

  // A WORK IS NOT A QUOTE HERE EITHER (1.14.2). This list said copy and share
  // were available on a book for as long as it was quote-only — nothing broke,
  // because no work surface passed the callbacks, and the moment one did it
  // would have offered to put a cover on the clipboard.
  it.each(['book', 'movie'])('%s offers neither copy nor share, because there is nothing to copy', (kind) => {
    const ids = actionsFor(kind, ITEM, full()).map((a) => a.id)
    expect(ids).toEqual(['edit', 'delete'])
  })

})

// ---- two selections, one registry (1.11.1) ---------------------------------
//
// A selection of quotes and a selection of works have almost nothing in common: a
// book has no colour and no tag of its own, a quote has no shelf and nothing to
// look up. That could have been two components; it is one registry and a kind,
// and these are the assertions that keep it honest.

const everything = () => ({
  ...full(),
  setColour: vi.fn(),
  setSticker: vi.fn(),
  favourite: vi.fn(),
  fillGaps: vi.fn(),
  setShelf: vi.fn(),
  setReview: vi.fn(),
})

// ---- where an action sits, and how many it takes (1.12.0) -----------------
//
// The bar became three glyphs and an overflow. Both halves of that are decided
// here rather than in the component that draws them: WHICH three (`where`), and
// WHETHER an action means anything at this count. A component holding the second
// opinion is how a bar and a menu drift, which is the whole reason this file
// exists.

describe('the actions that depend on how many are picked', () => {

  it('drops Edit the moment a second is picked', () => {
    expect(bulkActionsFor('quote', TWO, everything()).map((a) => a.id)).not.toContain('edit')
  })

})
