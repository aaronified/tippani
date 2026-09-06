// THE TWO COUNTS ON A CHARACTER SHEET LINE UP WITH EACH OTHER.
//
// THE REPORT, the owner's: "the quotes and scene counts are a little
// misaligned." Two boxes side by side, each holding a glyph, a number and a
// caption — `11 QUOTES` and `1 SCENE`.
//
// WHY IT HAPPENED. The boxes are equal (`flex: 1`) and each CENTRED its own
// group, so a wider group and a narrower one put their glyphs at two different
// offsets, their numbers at two more, and their captions at two more again. Six
// things on two rows, none of them agreeing — which is what "a little
// misaligned" looks like when you cannot see the boxes.
//
// THE PROPERTY. Anchor both groups to the same edge, and give the figure a
// column wide enough for two digits so a `1` and an `11` leave their captions in
// the same place. Then the two rows read as one pair rather than as two tiles
// that happen to be adjacent.
//
// AND THE COLUMN IS IN `ch`, NOT PX. The figure is display type and grows with
// the type dials; a px column would clip it at the top of the dial, which is the
// standing rule `make typescale` exists for.
//
// WHY THE STYLESHEET AND NOT THE SCREEN: jsdom has no layout, so a rendered
// sheet reports every box at zero and the two would "align" perfectly however
// they are declared. What decides it is the pair of declarations.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.

import { describe, expect, it } from 'vitest'

import { declaredIn } from '../css-cascade.js'

const decl = (sel, prop) => {
  let out = null
  for (const r of declaredIn(sel)) if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  return out
}

describe('the pair of counts', () => {
  it('anchors both boxes to the same edge instead of centring each on itself', () => {
    const j = decl('.cs-count', 'justify-content')
    expect(j, '.cs-count declares no main-axis alignment at all').toBeTruthy()
    expect(j, 'each box centres its own group, so nothing lines up between the two')
      .not.toBe('center')
  })

  it('and gives the number a column wide enough for the counts a library reaches', () => {
    // THE UNIT WAS ALL THIS CHECKED, and a unit is not a width: `min-width: 1ch`
    // would have passed while a 1 and an 11 still moved their captions apart.
    // Three characters is where a character's quote count stops in practice;
    // beyond that the column grows and the two boxes disagree again, which is
    // said out loud in the stylesheet rather than pretended away.
    const w = decl('.cs-count-fig', 'min-width')
    expect(w, 'the figure is shrink-wrapped, so its caption moves with the digit count').toBeTruthy()
    expect(w, `the figure's column is \`${w}\` — a box that holds text is measured in ch or em`)
      .toMatch(/ch|em/)
    const n = Number((w.match(/([\d.]+)\s*(?:ch|em)/) || [])[1])
    expect(n, `the column is ${w}, so a three-digit count still pushes its caption along`)
      .toBeGreaterThanOrEqual(3)
  })

  it('and the value beside a row can give way rather than squeezing its label', () => {
    // K10's OWN FIX WAS UNGUARDED, which is this round's headline lesson repeated
    // one file over: `credit-row.test.jsx` asserts the `name-scroll` CLASS, which
    // is a shape, so reverting `.cs-row-meta` to `flex: none` left every one of
    // 3,147 cases green. What decides it is the declaration, and this file was
    // already the place that reads declarations.
    const f = decl('.cs-row-meta', 'flex')
    expect(f, '.cs-row-meta declares no flex at all').toBeTruthy()
    expect(f, `.cs-row-meta is \`flex: ${f}\` — a value that cannot shrink takes its width out of the row and clips the label`)
      .not.toMatch(/^none\b|^0 0\b/)
    expect(decl('.cs-row-meta', 'min-width'),
      'the value keeps its content width, so it cannot shrink however its flex is written')
      .toBe('0')
  })

  it('and the boxes themselves stay equal', () => {
    // The alignment above is only worth anything while the two boxes are the
    // same size; a flex basis that shrink-wrapped would move the second box's
    // whole group instead.
    expect(decl('.cs-count', 'flex'), 'the two boxes no longer share the row equally').toBe('1')
  })
})
