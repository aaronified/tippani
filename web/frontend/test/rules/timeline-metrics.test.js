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

// designedSize resolves a type token back to the pixels it is at 100%.
//
// EVERY font-size IN THE APP IS A TOKEN NOW (type.js), and each token is named
// after its own default — `--type-ui-11` is eleven pixels at 100%, whatever the
// interface dial says today. So this reads the name, which is also the only honest
// thing it can read: there is no longer a literal in the stylesheet to compare.
function designedSize(selector) {
  const m = rule(selector).match(/font-size:\s*var\(--type-[a-z]+-(\d+)\)/)
  expect(m, `${selector} has no type token for its font-size — a size that opted out of the dials`).toBeTruthy()
  return Number(m[1])
}

describe('the folded gap is exactly as wide as the columns it replaces', () => {
  it('uses the column pitch the stylesheet actually draws', () => {
    expect(TL_COL_PX).toBe(px('.tl-col', 'min-width'))
    expect(TL_GAP_PX).toBe(px('.tl-row', 'gap'))
  })
})

// custom() reads one custom property off :root. The geometry moved out of literals
// and into two of them, for a reason the rule states: the plot holds dots and may
// be a px, the tick row holds TEXT and may not.
function custom(name) {
  const m = CSS.match(new RegExp(`\\n\\s*${name}:\\s*([^;]+);`))
  expect(m, `no :root declaration for ${name}`).toBeTruthy()
  return m[1].trim()
}

// The floor inside a `max(<px>, <token expression>)` — what the box is at the
// designed size, which is the size every number in this file is about.
function floorOf(expr) {
  const m = expr.match(/max\(\s*([\d.]+)px/)
  expect(m, `${expr} is not a max() with a px floor — a box that holds text must have one`).toBeTruthy()
  return Number(m[1])
}

describe('the plot has room for the dots it promises', () => {
  // The pitch is one dot plus one gap; the last dot needs no gap after it.
  const dot = px('.tl-dot', 'height')
  const between = px('.tl-dots', 'gap')
  const needed = TIMELINE_MAX_DOTS * dot + (TIMELINE_MAX_DOTS - 1) * between
  const plot = Number(custom('--tl-plot').replace('px', ''))

  it(`fits all ${TIMELINE_MAX_DOTS}`, () => {
    expect(plot).toBeGreaterThanOrEqual(needed)
  })

  // Without this the test above is satisfied by any large number, and a tick row
  // could be shrunk to nothing while the assertion stayed green.
  it('and is not tall enough for another one', () => {
    expect(plot).toBeLessThan(needed + dot + between)
  })

  // THE ROW IS THE SUM, and it is checked as a sum rather than as a total. The
  // three numbers used to be one literal 172 with the arithmetic in a comment, and
  // the tick row has to grow with the type dial — so a fixed total would have kept
  // the row still while the ticks inside it grew, which is what `make typescale`
  // caught: fifteen decade labels cut off at the bottom.
  it('and the row is the plot plus the ticks plus the gap between them', () => {
    const row = rule('.tl-row')
    expect(row, '.tl-row no longer states its height as a sum').toMatch(/height:\s*calc\(/)
    expect(row).toContain('var(--tl-plot)')
    expect(row).toContain('var(--tl-tick)')
    expect(row).toContain(`${px('.tl-col', 'gap')}px`)
  })
})

describe('the tick row is one row', () => {
  // Under a column and under a gap — and the same VARIABLE, not the same number.
  // Two literals that happened to agree is how this rule survives a change to one
  // of them: nothing errors, the two captions just sit at different baselines.
  it('under a column and under a gap alike', () => {
    expect(rule('.tl-gap-tick')).toMatch(/height:\s*var\(--tl-tick\)/)
    expect(rule('.tl-tick')).toMatch(/height:\s*var\(--tl-tick\)/)
  })

  // AND IT IS NOT A PX, because a tick is a rotated line of text and its height is
  // the length of the word. The floor is what it measures at the designed size.
  it('grows with the type dial, from a floor', () => {
    const tick = custom('--tl-tick')
    expect(tick).toMatch(/var\(--type-ui-\d+/)
    expect(floorOf(tick)).toBe(58)
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
    it(`${sel} is at least 10px as designed`, () => {
      // AS DESIGNED, and that qualifier is the whole of what the size dials changed
      // here. A reader who sets the interface to 75% gets 8px ticks, and that is not
      // this rule being broken — it is them asking for smaller text and being given
      // it. The floor governs what the app chooses for somebody who has chosen
      // nothing, which is the case both reports were about.
      expect(designedSize(sel)).toBeGreaterThanOrEqual(10)
    })
  }
})
