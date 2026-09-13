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

import { inventName, inventProse, inventTitle, scriptOf } from '../../../../scripts/journeys/invent.mjs'

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

  it('answers in the script it was asked in', () => {
    const cases = [
      ['Latin', 'The Idiot', 'Fyodor Dostoyevsky', 'It was the best of times.'],
      ['Devanagari', 'जहाँ चाह वहाँ राह', 'अरुणा वनवासी', 'जहाँ चाह होती है वहाँ राह मिल जाती है।'],
      ['Bengali', 'যেখানে ইচ্ছা সেখানে পথ', 'অরুণা বনবাসী', 'যেখানে ইচ্ছা আছে সেখানে পথ আছে।'],
    ]
    for (const [want, title, name, prose] of cases) {
      expect(scriptOf(inventTitle(title)), `title in ${want}`).toBe(want)
      expect(scriptOf(inventName(name)), `name in ${want}`).toBe(want)
      expect(scriptOf(inventProse(prose)), `prose in ${want}`).toBe(want)
    }
  })

  it('says nothing of what it was given', () => {
    // The whole point: the output must not carry the input. A generator that
    // passed short strings through unchanged would look like it worked and would
    // publish somebody's shelf.
    for (const secret of ['Dostoyevsky', 'Middlemarch', 'Casablanca']) {
      expect(inventTitle(secret)).not.toContain(secret)
      expect(inventName(secret)).not.toContain(secret)
      expect(inventProse(secret)).not.toContain(secret)
    }
  })

  it('gives the same answer every time, so the recipe does not churn', () => {
    for (const input of ['The Idiot', 'Fyodor Dostoyevsky', 'जहाँ चाह वहाँ राह']) {
      expect(inventTitle(input)).toBe(inventTitle(input))
      expect(inventName(input)).toBe(inventName(input))
      expect(inventProse(input)).toBe(inventProse(input))
    }
  })

  it('keeps a long thing long, which is what the fixture is for', () => {
    // The real library's extremes: a 72-character title, a 2,378-character
    // quote, a 31-character credit. A generator that returned tidy short strings
    // would rebuild exactly the fixture CLAUDE.md says hides a class of defect.
    const longTitle = 'A Title Of Seventy Two Characters Which Is What The Longest One Actually Is'
    expect(inventTitle(longTitle).length).toBeGreaterThan(40)

    const longQuote = 'x'.repeat(2378)
    const prose = inventProse(longQuote)
    expect(prose.length).toBeGreaterThan(2000)
    expect(prose.length).toBeLessThanOrEqual(2378)

    expect(inventName('Kaisa Vallenceworth-Brightwater').length).toBeGreaterThan(20)
  })
})
