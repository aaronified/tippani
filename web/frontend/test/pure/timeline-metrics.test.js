// The timeline's numbers live in two files, and this is the only thing that makes
// them agree.
//
// Three of the chart's claims are arithmetic split across StatsPage.jsx and
// index.css, and every one of them fails QUIETLY when the two drift:
//
//   - A folded gap is drawn N columns wide by JS (gapWidth) using its own copy of
//     the column pitch. Change .tl-col's min-width and the gap is still drawn, just
//     at the wrong width — and "the gap is as wide as it was long" is the rule the
//     whole design exists to keep. The chart would start lying about time with
//     nothing on screen looking broken.
//   - TIMELINE_MAX_DOTS says the tallest column reaches twelve dots. That is only
//     true if the CSS leaves room for twelve. Take some of it away and the top dot
//     is simply clipped, which looks exactly like a column that had fewer.
//   - The tick row under the columns and the one under a gap are one row. Move one
//     height and the captions sit at two different baselines.
//
// The fourth group is the legibility fix in 1.13.2, pinned because it was reported
// twice. Years must not be set in the mono face and must not have a slashed zero:
// Plex Mono draws 0 with a slash of its own, `font-variant-numeric: slashed-zero`
// puts one into a face that has none, and a slash through a small bowl closes into
// the same silhouette as an 8's waist. These labels are YEARS — a misread digit
// moves a landmark by centuries, which is worse than having no label.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TIMELINE_MAX_DOTS, TL_COL_PX, TL_GAP_PX } from '../../src/StatsPage.jsx'

const CSS = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

// rule() returns one selector's declaration block. Anchored on a newline so
// `.tl-tick` cannot be matched inside `.tl-gap-tick`, which is the mistake this
// file would otherwise make about the two heights it is comparing.
function rule(selector) {
  const at = CSS.indexOf(`\n${selector} {`)
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1)
  const open = CSS.indexOf('{', at)
  return CSS.slice(open + 1, CSS.indexOf('}', open))
}

// px() reads one declaration as a number, so a unit change (to rem, say) fails
// loudly here instead of comparing NaN and passing.
function px(selector, prop) {
  const m = rule(selector).match(new RegExp(`(?:^|;|\\s)${prop}:\\s*([\\d.]+)px\\s*(?:;|$)`, 'm'))
  expect(m, `${selector} has no ${prop} in px`).toBeTruthy()
  return Number(m[1])
}

describe('the folded gap is exactly as wide as the columns it replaces', () => {
  it('uses the column pitch the stylesheet actually draws', () => {
    expect(TL_COL_PX).toBe(px('.tl-col', 'min-width'))
    expect(TL_GAP_PX).toBe(px('.tl-row', 'gap'))
  })
})

describe('the plot has room for the dots it promises', () => {
  // The pitch is one dot plus one gap; the last dot needs no gap after it.
  const dot = px('.tl-dot', 'height')
  const between = px('.tl-dots', 'gap')
  const needed = TIMELINE_MAX_DOTS * dot + (TIMELINE_MAX_DOTS - 1) * between

  // .tl-plot is flex: 1 1 auto inside .tl-row, so its height is what is left after
  // the tick row and the gap between the two.
  const plot = px('.tl-row', 'height') - px('.tl-tick', 'height') - px('.tl-col', 'gap')

  it(`fits all ${TIMELINE_MAX_DOTS}`, () => {
    expect(plot).toBeGreaterThanOrEqual(needed)
  })

  // Without this the test above is satisfied by any large number, and a tick row
  // could be shrunk to nothing while the assertion stayed green.
  it('and is not tall enough for another one', () => {
    expect(plot).toBeLessThan(needed + dot + between)
  })
})

describe('the tick row is one row', () => {
  it('under a column and under a gap alike', () => {
    expect(px('.tl-gap-tick', 'height')).toBe(px('.tl-tick', 'height'))
  })
})

describe('a year is legible', () => {
  // Both labels that carry a year: the tick under each column, and the landmarks
  // riding inside a folded gap.
  for (const sel of ['.tl-tick', '.tl-gap-mark']) {
    it(`${sel} is not set in the mono face`, () => {
      expect(rule(sel)).toMatch(/font-family:\s*var\(--font-ui\)/)
    })
    it(`${sel} has no slashed zero`, () => {
      expect(rule(sel)).not.toMatch(/slashed-zero/)
    })
    it(`${sel} is at least 10px`, () => {
      expect(px(sel, 'font-size')).toBeGreaterThanOrEqual(10)
    })
  }
})
