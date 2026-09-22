// A MATERIAL IS DRAWN AT ITS OWN SCALE AND ITS OWN STRENGTH, or eight materials
// are one grey wash. A source scanner, not a test.
//
// WHAT WENT WRONG WITHOUT IT. theme.js has measured a scale and a strength for
// every texture since the material sets shipped — paper 220px at .10, satin 210px
// at .07, cotton 300px at .12 — and the rule that drew them threw BOTH away for
// one `--grain-card: 300px` at one `opacity: .16`. The owner reported the result:
// "add the card textures to the settings and metadata cards, they now look
// identical in all material sets". Measured over eight cards, the seven textured
// sets spanned 0.15 of a grey level and fifteen of their twenty-one pairs were
// identical to within a tenth of one.
//
// NOTHING CAUGHT IT, and nothing could have: every test in this repo that touches
// materials checks that theme.js WRITES the right custom property, and it always
// did. The gap was between a property written and a property read, which is the
// one place a source scanner can stand.
//
// SO THIS ASSERTS THE READ. The card's tile must take its size from the slot's own
// measured scale and its opacity from the slot's own measured strength. A rule
// that hardcodes either is the defect coming back.
//
// MUTATION-VERIFIED, one at a time, each restored before the next:
//   background-size back to `var(--grain-card)`      => "back on one hardcoded
//       scale for every material".
//   opacity back to `.16`                            => "back on one hardcoded
//       opacity", and the ratio case too, since it can no longer find a light
//       multiplier to compare against.
//   theme.js stops writing --tile-${slot}-strength   => "no longer writes each
//       slot's measured strength".
//   dark's multiplier set equal to light's           => "dark is 1.000 of light;
//       it has always been .6875".
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const css = readFileSync(join(SRC, 'index.css'), 'utf8')
const theme = readFileSync(join(SRC, 'theme.js'), 'utf8')

// The block that draws the card's tile: from the selector to its closing brace.
const cardTileRule = () => {
  const i = css.indexOf('html .hand-card::before {')
  return i < 0 ? null : css.slice(i, css.indexOf('}', i))
}

describe('the card’s material', () => {
  it('takes its scale from the slot rather than from one number', () => {
    const rule = cardTileRule()
    expect(rule, 'the rule that sizes the card’s tile is gone or renamed').toBeTruthy()
    expect(rule, 'the card’s tile is back on one hardcoded scale for every material')
      .toMatch(/background-size:\s*var\(--tile-card-size/)
  })

  it('and its strength from the slot rather than from one opacity', () => {
    const rule = cardTileRule()
    expect(rule, 'the card’s tile is back on one hardcoded opacity for every material')
      .toMatch(/opacity:\s*calc\(var\(--tile-card-strength/)
  })

  it('and theme.js still publishes both, for every slot', () => {
    // The other half of the seam. A rule reading a property nothing writes is the
    // same defect wearing the opposite hat: it would fall back to the default and
    // draw every set alike again, silently.
    expect(theme, 'theme.js no longer writes each slot’s measured scale')
      .toMatch(/--tile-\$\{slot\}-size/)
    expect(theme, 'theme.js no longer writes each slot’s measured strength')
      .toMatch(/--tile-\$\{slot\}-strength/)
  })

  it('and the dark multiplier keeps its ratio to the light one', () => {
    // .11/.16 is where the pair has always sat. If one is retuned and the other is
    // not, dark and light drift apart — which is invisible until somebody switches.
    const light = css.match(/html \.hand-card::before \{[^}]*?\*\s*([\d.]+)\)/)
    const dark = css.match(/html\[data-theme="dark"\] \.hand-card::before \{[^}]*?\*\s*([\d.]+)\)/)
    expect(light && dark, 'one of the two multipliers is gone').toBeTruthy()
    const ratio = Number(dark[1]) / Number(light[1])
    expect(ratio, `dark is ${ratio.toFixed(3)} of light; it has always been .6875`).toBeCloseTo(0.6875, 2)
  })
})
