// THE HERO'S RHYTHM IS EVEN IN THE INK, not just in the declared gap.
//
// THE COMPLAINT THIS ANSWERS, and why the first investigation got it wrong. The
// hero's vertical spaces read as "highly uneven". Measured, every declared step
// was honoured exactly — 11px between the hero's blocks, 9px between the facts
// (7 on a phone) — so the first pass recorded the unevenness as optical and left
// it, which was a true observation and an unfinished job.
//
// WHAT IS ACTUALLY WRONG. `.tp-filter-chip` is 34px tall on a desk and 44px on a
// phone. That is a THUMB measurement, not a type one, and it wraps a 13px line —
// so the shelf-state row's box is correct while its ink sits about 8px (13 on a
// phone) inside the box, top and bottom. Every gap that row takes part in
// therefore READS as 19px where the text rows beside it read 11. Correcting
// --hero-block cannot fix that: the number was never wrong, the row was spending
// its own air on top of it.
//
// THE FIX IS THAT THE ROW SPENDS ITS AIR OUT OF THE GAP — a negative block margin
// equal to the air inside it, so the INK gap comes out at the declared number
// against a text row and against another chip row alike.
//
// WHY A STYLESHEET TEST. jsdom has no layout, so it cannot measure an ink gap;
// the browser harness the repo keeps for this (`run-frame-scroll.sh`) needs
// Firefox. What IS checkable everywhere is the RELATIONSHIP: that the row's pull
// is exactly the constant, that the constant is declared at both widths, and that
// the pull is not typed in as a number beside it. That is the same bargain
// no-truncated-names.test.js strikes — the declaration is the defect, and the
// declaration is greppable.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

// The declaration block for a selector, as written.
function blockFor(sel) {
  const at = css.indexOf(sel + ' {')
  if (at === -1) return null
  return css.slice(at, css.indexOf('}', at))
}

describe('the hero pill-air constant', () => {
  it('is declared on the component, beside the rhythm it corrects', () => {
    const hero = blockFor('.work-hero')
    expect(hero, '.work-hero is not declared any more').not.toBeNull()
    // ONE CONSTANT ON THE COMPONENT is what the standing rule allows — and what
    // --row above it already does. A step typed into a row is the thing
    // spacing-debt.test.js counts.
    expect(hero).toMatch(/--hero-pill-air:\s*\d+px/)
    expect(hero, 'the block rhythm is still derived from --row').toMatch(/--hero-block:\s*calc\(var\(--row\)/)
  })

  it('is restated for the phone, where the chip is 44px rather than 34', () => {
    // The chip grows for a thumb at the narrow width, so the air it carries grows
    // with it. A single constant for both widths would over-pull on a desk or
    // under-pull on a phone.
    const decls = [...css.matchAll(/--hero-pill-air:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(decls.length, 'declared once per width').toBe(2)
    const [desk, phone] = decls
    expect(phone, 'the phone carries more air, because its chip is taller').toBeGreaterThan(desk)
  })

  it('matches the air a filter chip actually carries at each width', () => {
    // Derived rather than asserted as a magic pair: (min-height − line) / 2,
    // where the line is a 13px face at the app's own body leading. If somebody
    // changes the chip's height, this is the test that says the constant moved
    // with it — a chip and a compensation that disagree are worse than neither.
    const chipHeights = [...css.matchAll(/\.tp-filter-chip\s*\{[^}]*min-height:\s*(\d+)px/g)]
      .map((m) => Number(m[1]))
    expect(chipHeights.length, 'the chip declares a height per width').toBe(2)
    const airs = [...css.matchAll(/--hero-pill-air:\s*(\d+)px/g)].map((m) => Number(m[1]))
    for (let i = 0; i < 2; i++) {
      // A 13px face leads at roughly 1.3 in this app, so the ink is ~17px. The
      // tolerance is 2px: the point is that the constant tracks the chip, not
      // that it is computed to the pixel from a line-height nobody declares here.
      const expected = Math.round((chipHeights[i] - 17) / 2)
      expect(Math.abs(airs[i] - expected), `--hero-pill-air ${airs[i]}px against a ${chipHeights[i]}px chip`)
        .toBeLessThanOrEqual(2)
    }
  })
})

describe('the row that carries the air', () => {
  it('pulls itself in by exactly the constant, never by a typed number', () => {
    const rule = css.match(/\.work-hero-facts\s*>\s*\.work-hero-state\s*\{([^}]*)\}/)
    expect(rule, 'the state row no longer spends its own air').not.toBeNull()
    expect(rule[1]).toMatch(/margin-block:\s*calc\(var\(--hero-pill-air\)\s*\*\s*-1\)/)
    // A raw negative px here would be the step the rule forbids, and it would
    // stop tracking the chip at the other width.
    expect(rule[1], 'a typed pull instead of the constant').not.toMatch(/margin-block:\s*-\d+px/)
  })

  // THE STATE ROW ALONE, and this is the assertion that stops the fix spreading
  // to rows that are already right: the genres are `.tp-chip` at 2px of padding
  // and the counts are a baseline-aligned line of text. Compensating those would
  // pull correct rows out of true.
  it('is the only child of the facts column that is compensated', () => {
    const pulls = [...css.matchAll(/\.work-hero-facts\s*>\s*\.([a-z-]+)\s*\{[^}]*--hero-pill-air/g)]
      .map((m) => m[1])
    expect(pulls).toEqual(['work-hero-state'])
  })
})
