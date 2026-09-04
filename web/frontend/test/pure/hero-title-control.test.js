// THE HERO'S TITLE ROW: THE CONTROL BESIDE THE NAME IS ON THE NAME'S LINE.
//
// THE REPORT THIS EXISTS FOR, in the owner's words: "headers with two rows look
// fine now. but not headers with one row." Measured in Chromium at 390px, the
// heart beside a one-line title drew 10px below the title's optical centre and
// the row carried 19px of paper the title never asked for — the gap that opened
// under the name. With two lines the same code looked right, because the title's
// box is then the taller of the two and the offset lands inside it.
//
// THE ARITHMETIC, which is the whole defect. The heart is the app's 44px tap
// target. A one-line title's box is font-size x leading — 22 x 1.15 = 25.3px on a
// phone. `align-items: start` aligns the two BOXES at the top, so all 18.7px of
// the difference falls below the line: half of it under the glyph (which is what
// the eye reads as misaligned) and all of it under the row (which is what pushes
// the genres down).
//
// WHY THE STYLESHEET AND NOT THE SCREEN. jsdom has no layout — every box is
// zero-sized there, so a DOM test cannot see a 10px offset and passes whatever
// the rule says. The browser harness can measure it and did, but it is not the
// suite: this file is the cheap guard that fails the moment somebody puts the
// row back to `start` or drops the compensating margin, which is exactly how the
// defect got in.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

// EVERY declaration block for a selector, joined — not the first one. A selector
// legitimately appears more than once in this stylesheet (`.work-hero-title` has
// a one-line `position: relative` rule beside the mark it anchors, and the flex
// rule further down), and taking the first match read the wrong one. The cascade
// is the union of them, so the union is what to assert on.
//
// Deliberately literal string matching: a test that parsed CSS properly would
// also accept shapes nobody writes.
function block(selector) {
  const needle = `\n  ${selector} {`
  let at = css.indexOf(needle)
  expect(at, `${selector} has no rule in index.css`).toBeGreaterThan(-1)
  const parts = []
  while (at > -1) {
    const open = css.indexOf('{', at)
    const close = css.indexOf('}', open)
    parts.push(css.slice(open + 1, close))
    at = css.indexOf(needle, close)
  }
  return parts.join('\n')
}

describe('the hero title row', () => {
  it('centres the row, so the control lands on the title whatever its height', () => {
    const b = block('.work-hero-title')
    expect(b).toMatch(/align-items:\s*center/)
    // `start` is the specific value that produced the report — a one-line title
    // with a 44px control beside it — so it is named rather than merely absent.
    expect(b).not.toMatch(/align-items:\s*(start|flex-start)/)
  })

  it('takes the tap target’s overhang out of the row', () => {
    // Without this the row is 44px tall for a 25px title and the genres sit 19px
    // lower than the block they belong to. The negative margin makes the heart's
    // OUTER box one line exactly, so the 44px a thumb needs bleeds above and
    // below the line instead of growing the header.
    const b = block('.work-hero-title .heart')
    expect(b).toMatch(/margin-block:\s*calc\(\(var\(--hero-title-line\)\s*-\s*44px\)\s*\/\s*2\)/)
  })

  it('derives the line box from the same properties the title resolves', () => {
    // A NUMBER TYPED TWICE IS A NUMBER THAT GOES STALE. The leading used to live
    // in `WorkDetail.jsx`'s titleStyle, where the stylesheet could not read it —
    // so the margin above would have been a guess at the h1's line box rather
    // than a statement of it. Both now come from --hero-title-lh.
    expect(css).toMatch(/--hero-title-lh:\s*1\.15/)
    expect(css).toMatch(/--hero-title-line:\s*calc\(var\(--hero-title,[^)]*\)[^;]*\*\s*var\(--hero-title-lh\)\)/)
  })

  it('is a descendant selector, because the heart is not a direct child', () => {
    // `Hearts` wraps its button in a Tooltip, so `.work-hero-title > .heart`
    // matches nothing at all — and a rule that matches nothing computes to
    // `margin: 0px`, which is indistinguishable from no rule. That cost a
    // measurement round.
    expect(css).not.toMatch(/\.work-hero-title\s*>\s*\.heart/)
  })
})
