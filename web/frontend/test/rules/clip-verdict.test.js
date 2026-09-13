// WHAT COUNTS AS TEXT THE TYPE DIAL TOOK AWAY.
//
// `typescale.mjs` turns every type dial to its top, scales the root with it, and
// fails when a screen clips something it did not clip before. The whole gate rests
// on one predicate, and that predicate lived inside a `page.evaluate` string —
// which means the only way to ask whether it was right was to boot a server,
// restore a library and walk thirteen screens. It was wrong for half an hour and a
// rater found it by reading rather than by running:
//
//     if (CLAMPED(cs)) continue        // ← skips the element ENTIRELY
//
// A `-webkit-line-clamp` box is exempt because it holds N LINES at every type size,
// so the dial cannot break it downwards — what changes at 175% is how many words
// fit on those lines, which is the clamp working and not a box failing. That
// argument says nothing about WIDTH. Skipping the element took every clamped box
// out of the horizontal ratchet too, and a clamped box cut off sideways is cut off
// for the ordinary reason: a px box that stopped holding its text.
//
// THE OTHER TWO EXEMPTIONS ARE OLDER and are the reason the predicate takes
// `overflowX`/`overflowY` rather than a boolean. An `overflow: auto` box that
// outruns its size is a SCROLLER, and by now it wears a fade saying so; an
// `overflow: visible` box that outruns its size SPILLS, which is ugly and not
// lost. Only `hidden` and `clip` take the text away for good.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `clipOf` takes a flat bag of measurements —
// the four sizes, the two overflow values, and the computed `-webkit-line-clamp` —
// and answers `{ wide, tall }`. It is the SAME function the page runs:
// `typescale.mjs` stringifies it into its probe rather than keeping a copy, because
// a copy is what let the two disagree.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

const { clipOf } = await import(pathToFileURL(join(SHOTS, 'clipverdict.mjs')).href)

// A box that fits, in both directions, with nothing clipping.
const fits = {
  scrollWidth: 200, clientWidth: 200, scrollHeight: 100, clientHeight: 100,
  overflowX: 'visible', overflowY: 'visible', lineClamp: 'none',
}
const box = (over) => ({ ...fits, ...over })

describe('what the type-scale ratchet counts', () => {
  it('nothing, when the box holds its text', () => {
    expect(clipOf(fits)).toEqual({ wide: false, tall: false })
  })

  it('and a hidden box that outruns its height', () => {
    expect(clipOf(box({ scrollHeight: 140, overflowY: 'hidden' })).tall).toBe(true)
    expect(clipOf(box({ scrollHeight: 140, overflowY: 'clip' })).tall).toBe(true)
  })

  it('and a hidden box that outruns its width', () => {
    expect(clipOf(box({ scrollWidth: 260, overflowX: 'hidden' })).wide).toBe(true)
  })

  it('but not a scroller, because a reader can get at it', () => {
    // And by now it wears a measured edge fade saying so — the repo's standing rule.
    expect(clipOf(box({ scrollHeight: 140, overflowY: 'auto' })).tall).toBe(false)
    expect(clipOf(box({ scrollWidth: 260, overflowX: 'scroll' })).wide).toBe(false)
  })

  it('and not a box that spills, because the words are still on the screen', () => {
    expect(clipOf(box({ scrollHeight: 140, overflowY: 'visible' })).tall).toBe(false)
  })

  it('and not one pixel of rounding', () => {
    // Sub-pixel layout makes scrollHeight exceed clientHeight by a fraction on
    // boxes that are visually exact, and a ratchet that fires on those is a
    // ratchet nobody can keep at zero.
    expect(clipOf(box({ scrollHeight: 101, overflowY: 'hidden' })).tall).toBe(false)
    expect(clipOf(box({ scrollWidth: 201, overflowX: 'hidden' })).wide).toBe(false)
    expect(clipOf(box({ scrollHeight: 102, overflowY: 'hidden' })).tall).toBe(true)
  })
})

describe('a line clamp is exempt downwards and only downwards', () => {
  it('so a clamped box that outruns its height is not counted', () => {
    // THE READING THAT PROVOKED THIS. Home's favourite tile clamps its quote and
    // puts a chevron under it; at 100% the quote fitted the clamp and at 175% it
    // did not, so a ratchet whose floor is zero went to one with nothing wrong.
    expect(clipOf(box({ scrollHeight: 140, overflowY: 'hidden', lineClamp: '3' })).tall).toBe(false)
  })

  it('but a clamped box cut off SIDEWAYS still is', () => {
    // THE DEFECT. `continue` on a clamped element took it out of both checks, and
    // the argument for the exemption is about line count. A clamp promises N
    // lines; it promises nothing about the width.
    expect(clipOf(box({ scrollWidth: 260, overflowX: 'hidden', lineClamp: '3' })).wide,
      'a clamped box clipping sideways was exempted by an argument about line count').toBe(true)
  })

  it('and both at once are judged separately', () => {
    const both = clipOf(box({
      scrollWidth: 260, scrollHeight: 140, overflowX: 'hidden', overflowY: 'hidden', lineClamp: '2',
    }))
    expect(both).toEqual({ wide: true, tall: false })
  })

  it('and "none" or "0" is not a clamp', () => {
    // `getComputedStyle` answers `none` for an unclamped box, and a browser or two
    // has answered `0`. Treating either as a clamp would exempt every hidden box
    // in the app, which is the gate switched off.
    for (const n of ['none', '0', '', undefined, null]) {
      expect(clipOf(box({ scrollHeight: 140, overflowY: 'hidden', lineClamp: n })).tall,
        `a lineClamp of ${JSON.stringify(n)} was taken for a clamp`).toBe(true)
    }
  })
})

describe('and the page runs this exact function', () => {
  it('so the probe carries it rather than a copy', async () => {
    // A COPY IS WHAT LET THE TWO DISAGREE. The predicate was inline in the probe
    // string; this file can only speak for the page if the page is running what it
    // just tested.
    const src = await import('node:fs').then((fs) => fs.readFileSync(join(SHOTS, 'typescale.mjs'), 'utf8'))
    expect(src, 'typescale.mjs no longer imports the predicate').toMatch(/from '\.\/clipverdict\.mjs'/)
    expect(src, 'the probe no longer stringifies the predicate into itself, so it has a second copy')
      .toMatch(/const clipOf = \$\{clipOf\.toString\(\)\}/)
    expect(src, 'the probe still has its own line-clamp arm, so there are two rules again')
      .not.toMatch(/CLAMPED\(cs\)/)
  })
})
