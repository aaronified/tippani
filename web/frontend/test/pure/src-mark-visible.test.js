// A SUPPLIER'S MARK MAY NOT PAINT OVER ITSELF.
//
// THE OWNER'S REPORT: "the provider icons are not visible at all." Seven rows of
// the Metadata sources block drew a flat beige rounded square where a mark should
// be, and nothing in 3,674 tests had anything to say about it — because the fault
// was in the stylesheet and jsdom applies none.
//
// WHAT HAPPENED. `.src-mark` had TWO rules. The live one is a flex box that sizes
// an inline `<svg>` child; the other was left over from an earlier design where
// each mark was a mask IMAGE — `background-color: currentColor` plus mask sizing,
// no child. When the marks became components (IconSrcGoogle and its neighbours in
// ui.jsx) the mask rule was not deleted, and with no `mask-image` anywhere there
// was nothing to mask the background: the box filled solid and the SVG drew
// underneath it.
//
// SO THE INVARIANT IS NOT "the rule is gone" — that is a fact about one deletion
// and would pass forever without checking anything. It is: IF this class paints a
// background, a mask must be cutting a shape out of it. A future mask-based
// design satisfies that; another orphaned half of one does not.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

// Every declaration block for a selector mentioning the class, however it is
// qualified — `.src-mark`, `.src-mark.has-state`, `.mobile-sticky-bar .src-mark`.
// A rule that reached it through a compound selector would be just as opaque.
const blocks = () => {
  const out = []
  const re = /([^{}]*\.src-mark[^{}]*)\{([^}]*)\}/g
  for (const m of css.matchAll(re)) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}

describe('the marks the Metadata rows draw', () => {
  it('are still styled at all', () => {
    // A class renamed away silently takes its guard with it.
    expect(blocks().length, '.src-mark is not declared in index.css any more').toBeGreaterThan(0)
  })

  it('never fill a background without a mask to cut it', () => {
    const opaque = blocks().filter((b) => /background(-color)?\s*:/.test(b.body))
    // SCOPED TO THIS CLASS, and the first draft of this test was not: it asked
    // whether the FILE contained a `mask-image` anywhere, which it does — the
    // paper grain and every scroller fade are masks — so the guard would have
    // been satisfied by rules that have nothing to do with these marks.
    const masked = blocks().some((b) => /(-webkit-)?mask-image\s*:/.test(b.body))
    expect(
      masked ? [] : opaque.map((b) => b.selector),
      'a .src-mark rule paints a background with no mask-image on the same class to cut a shape out of it — that is a solid block over the icon, which is exactly what the owner saw',
    ).toEqual([])
  })

  it('and the live rule still makes room for the glyph it contains', () => {
    // The mark holds an inline <svg>. `display: inline-block` was the mask
    // design's, and a box that does not lay its child out is the other way to
    // lose the icon.
    const sizing = blocks().find((b) => /display\s*:/.test(b.body))
    expect(sizing, '.src-mark declares no display at all').toBeTruthy()
    expect(sizing.body, '.src-mark no longer lays out the glyph inside it')
      .toMatch(/display\s*:\s*inline-flex/)
  })
})
