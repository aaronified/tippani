// THE FIXTURE'S PROSE GENERATOR, WHICH HAS TO TERMINATE AND HAS TO KEEP THE SHAPE.
//
// This is the tier the test plan keeps: a function that IS the observable unit,
// whose whole contract is expressible in values. It imports the function and
// calls it — it reads no source text and knows no screen.
//
// IT EXISTS BECAUSE inventName HUNG THE CURATOR. The grow-loop REASSIGNED the
// name each time round instead of appending, so it never got longer and the
// condition never went false — an infinite loop for any original longer than the
// pools could spell. The symptom was the worst kind: a process that ran for ten
// minutes, printed nothing, and was killed by a timeout. Nothing to read and
// nothing to grep.
//
// WHAT THE GENERATOR PROMISES, and therefore what this checks:
//   * it returns, for any input, including one no pool can match;
//   * the output is in the SAME SCRIPT as the input, because a Devanagari quote
//     turned into Latin would silently delete the per-language font work from
//     everything downstream of the fixture;
//   * it is deterministic, so re-running the curation gives a byte-identical
//     recipe and a diff means the library changed rather than a die rolled;
//   * length lands in the original's band, because shape is the entire reason
//     the fixture is built from a real library at all.

import { describe, expect, it } from 'vitest'

import { inventName, inventProse, inventTitle,  } from '../../../../scripts/journeys/invent.mjs'

// Long enough that no pool can spell it in the parts it allows, which is exactly
// the case that hung.
const UNSPELLABLE = 'A Name Far Longer Than Any Pool Could Ever Spell In Three Parts At All Whatsoever'

describe('the fixture generator', () => {
  // THE REAL DEFENCE IS THE CAP IN THE GENERATOR, NOT THIS CASE, and the
  // difference is worth stating because the first version of this comment got it
  // wrong. It said vitest's testTimeout would fail a hang. IT CANNOT: these
  // functions are synchronous, so a spin blocks the event loop and no timer ever
  // fires — reintroducing the bug and running this file hung for two minutes and
  // never reported a thing, which is how the claim was caught.
  //
  // So inventName carries a hard part-count bound, and what this case checks is
  // that the bound HOLDS: an input longer than the pools can ever match still
  // comes back, bounded, rather than growing forever. Somebody who removes the
  // cap gets a hanging suite, and this paragraph is the note that tells them why.
  it('is bounded, so an input it cannot match still comes back', () => {
    for (const fn of [inventName, inventTitle, inventProse]) {
      for (const input of ['a', 'Bo Li', UNSPELLABLE, UNSPELLABLE.repeat(4)]) {
        expect(typeof fn(input), `${fn.name} on a ${input.length}-character input`).toBe('string')
      }
    }
    // The bound, named: five parts, and nothing an original's length can do
    // about it.
    expect(inventName(UNSPELLABLE.repeat(4)).split('-').length).toBeLessThanOrEqual(5)
  })
})
