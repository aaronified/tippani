// THE THREE VERBS STAY SPLIT. A source scanner, not a test.
//
// `IconRefresh` was one circular arrow doing three jobs — fetch from a provider,
// reset a field, install a release — and the owner named it: "it is not just this
// row that uses refresh as fetch. all popups use that for fetch. even the update
// uses a refresh icon." The split into IconFetch / IconReset / IconUpdate is a
// CALL-SITE fact: nothing about the exported glyphs changes if every button goes
// back to the arrow tomorrow, which is exactly what a rater proved by reverting
// them and watching 3,557 tests stay green.
//
// A DOM test cannot hold this without pinning which drawing a given button wears,
// and `person-modal-icons.test.jsx` makes the case against that: pin a drawing and
// every redraw becomes a test edit. What is worth holding is the CONTRACT — the
// arrow has two callers and they are both local rescans — and a contract across
// files is what this directory is for.
//
// MUTATION-VERIFIED:
//   every `<IconFetch />` in MetadataPage.jsx back to `<IconRefresh />` => "the
//       refresh arrow is back on something that is not a local rescan".
//   every `<IconUpdate />` in Settings.jsx back to `<IconRefresh />` => the same,
//       AND "IconUpdate is exported and nothing draws it" — two cases, because a
//       reverted call site is both an arrow in the wrong place and a verb with
//       nowhere left to appear.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC, sourcesUnder } from '../src-files.js'

// THE SHARED WALK, NOT A `readdirSync` OF MY OWN — `one-walk.test.js` caught the
// first cut of this file doing exactly that, and its reason is the one that
// matters here: a hand-rolled walk that finds nothing leaves this guard green
// while it checks no file at all, and the two guards found silent that way were
// found by a reader rather than by a run.
const files = sourcesUnder()
const read = (f) => readFileSync(join(SRC, f), 'utf8')

// A USE, NOT A MENTION. `<IconFetch />` is a call site; the word inside a comment
// or an import list is not, and counting those would make this scanner fire on the
// paragraph above explaining itself — the same trap the gesture suite's `cls-1`
// guard fell into and had to be scoped out of.
const uses = (glyph) => {
  const re = new RegExp(`<${glyph}\\s*/?>|icon:\\s*<${glyph}\\s*/?>`, 'g')
  const out = []
  for (const f of files) {
    if (f === 'ui.jsx') continue // where they are DEFINED, and one may draw another
    const n = (read(f).match(re) || []).length
    if (n) out.push([f, n])
  }
  return out
}

describe('the circular arrow', () => {
  it('is only ever a LOCAL pass, and only on Checks', () => {
    // Two callers, both `CleanupPage.jsx`: rescan, and rescan after ignoring some.
    // Nothing leaves the machine on either, which is the whole reason the arrow
    // survived the split at all.
    const where = uses('IconRefresh').map(([f]) => f)
    expect(where, 'the refresh arrow is back on something that is not a local rescan').toEqual(['CleanupPage.jsx'])
  })

  it('and the three verbs it was standing in for are each somewhere', () => {
    // The other direction, and the one that rots quietly: a split nothing uses is
    // three exports and no change. Each of these has to be drawn SOMEWHERE outside
    // ui.jsx or the rewiring has been undone.
    for (const g of ['IconFetch', 'IconReset', 'IconUpdate']) {
      expect(uses(g).length, `${g} is exported and nothing draws it`).toBeGreaterThan(0)
    }
  })

  it('and update is the narrowest of them: a release, and nothing else', () => {
    // If IconUpdate ever spreads past Settings it has stopped meaning "the app
    // replaces itself", which is the only thing that tells it from IconFetch.
    expect(uses('IconUpdate').map(([f]) => f)).toEqual(['Settings.jsx'])
  })
})
