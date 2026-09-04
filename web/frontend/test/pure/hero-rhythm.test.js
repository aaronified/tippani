// THE HERO'S RHYTHM, PINNED TO WHAT THE PROTOTYPE ACTUALLY MEASURES.
//
// THE COMPLAINT, AND THREE WRONG ANSWERS TO IT. The hero's vertical spaces read
// as "highly uneven". Every declared step was honoured exactly — 11px between
// the hero's blocks, 9px between the facts, 7 on a phone — so the first pass
// filed the unevenness as optical and left it. The second pulled the shelf-state
// row in by a constant derived from `.tp-filter-chip`'s height, on the theory
// that a touch-sized row must be trimmed back into the rhythm. The third argued
// from the prototype's SOURCE, because the prototype would not render.
//
// WHAT SETTLED IT. docs/design/prototypes now carries its support.js, so the
// pack renders and can be measured. Its facts column, at 1480px:
//
//     Book · 1967 · Russian     box 13.0   air 0.5/0.5   → ink gap 9.5
//     The Master and Margarita  box 67.2   air 0.0/0.6   → ink gap 9.6
//     satire magical realism    box 12.0   air 0.0/0.0   → ink gap 9.0
//     128 quotes                box 23.0   air 0.0/-1.0  → ink gap 24.0
//     Reading · 62% · read 3d   box 44.0   air 16.0/16.0
//
// Two facts fall out of that, and both are the opposite of the second attempt:
//
//   TEXT ROWS HUG THEIR INK. 0.0-0.5px of leading, so the declared 9px IS the
//   seen gap. The app's rows carried 2.0px top and bottom and so read 11.0.
//   That difference — body leading on a header's one-line facts — was the error.
//
//   THE TOUCH ROW IS LEFT BREATHING. 44px around a 12px chip, 16px of air each
//   side, 24px from the count above it. The pull made that gap 7.1px, tighter
//   than every text gap around it, which is why the column still read as uneven
//   after the "fix". A thumb target is not a line of type, and the pack does not
//   pretend otherwise.
//
// WHY A STYLESHEET TEST. jsdom has no layout, so it cannot measure an ink gap.
// The browser harness that can is scripts/screenshots/ — now engine-selectable,
// so it runs on Chromium where Firefox cannot be installed. What is checkable
// everywhere is the RELATIONSHIP: that the leading is one constant on the
// component, that no row is pulled, and that the state row is the one-line
// control. The same bargain no-truncated-names.test.js strikes — the declaration
// is the defect, and the declaration is greppable.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = process.env.TIPPANI_SRC
const css = readFileSync(join(src, 'index.css'), 'utf8')
const workDetail = readFileSync(join(src, 'WorkDetail.jsx'), 'utf8')

// The declaration block for a selector, as written.
function blockFor(sel) {
  const at = css.indexOf(sel + ' {')
  if (at === -1) return null
  return css.slice(at, css.indexOf('}', at))
}

describe("the hero's text rows", () => {
  it('take their leading from one constant on the component', () => {
    const facts = blockFor('.work-hero-facts')
    expect(facts, '.work-hero-facts is not declared any more').not.toBeNull()
    // ONE CONSTANT ON THE COMPONENT is what the standing rule allows, and what
    // --row beside it already does. A leading typed into a row is the thing
    // spacing-debt.test.js counts.
    expect(facts).toMatch(/--hero-lh:\s*[\d.]+/)
  })

  it('is tighter than body leading, which is what packs the column', () => {
    const facts = blockFor('.work-hero-facts')
    const lh = Number(facts.match(/--hero-lh:\s*([\d.]+)/)[1])
    // The measured target is ~0px of air on a one-line fact. Body leading in
    // this app is ~1.45 and carried 2px top and bottom; anything at or above it
    // puts the error straight back.
    expect(lh).toBeLessThan(1.3)
    // And not so tight that a descender clips — the type suite owns legibility,
    // but a floor here says the number is a leading and not a crop.
    expect(lh).toBeGreaterThanOrEqual(1.1)
  })

  it('applies it to every text row in the column and to none of the others', () => {
    // The rows that are ONE LINE OF TYPE. The title is excluded on purpose: its
    // leading is set inline on the h1 by WorkHero (titleSize + 1.12), and a rule
    // aimed at it from here loses to that and reads as though it worked.
    const rule = css.match(/\.work-hero-kind,\s*\.work-hero-genres,\s*\.work-hero-counts\s*\{([^}]*)\}/)
    expect(rule, 'the text rows no longer share one leading').not.toBeNull()
    expect(rule[1]).toMatch(/line-height:\s*var\(--hero-lh\)/)
  })
})

describe('the touch-sized state row', () => {
  it('is never pulled back into the rhythm', () => {
    // THE ASSERTION THAT KEEPS THE SECOND ATTEMPT FROM COMING BACK. The
    // prototype gives this row 16px of air on each side and a 24px gap above it.
    // A negative block margin on any child of the facts column is the defect.
    const pulls = [...css.matchAll(/\.work-hero-facts\s*>\s*\.([a-z-]+)\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => /margin-block:\s*(calc\([^)]*\*\s*-|-)/.test(body))
      .map(([, cls]) => cls)
    expect(pulls, 'a facts row is spending its air out of the gap again').toEqual([])
  })

  it('has no compensation constant left to reach for', () => {
    // --hero-pill-air was the constant the pull was derived from. Its presence
    // as a DECLARATION (not in prose explaining why it went) would mean the
    // approach is still wired up somewhere.
    expect(css).not.toMatch(/--hero-pill-air:\s*\d/)
  })

  it('is the one-line control at every width, as the pack draws it', () => {
    // `compact` is ShelfControl minus the full-width progress track. The hero
    // asked for it on a phone only, so the desk header drew a chip, a second
    // chip and a track on three lines — 59.8px measured, against the rendered
    // prototype's 44px on one line, the largest single departure from its
    // density. A width-conditional here is that regression.
    expect(workDetail).not.toMatch(/compact=\{mobile\}/)
    expect(workDetail, 'the hero no longer asks for the one-line shelf row')
      .toMatch(/<ShelfControl[\s\S]{0,900}?\n\s*compact\n/)
  })
})
