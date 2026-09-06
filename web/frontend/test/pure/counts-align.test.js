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

  it('and gives the number a column, so a 1 and an 11 leave the caption in one place', () => {
    const w = decl('.cs-count-fig', 'min-width')
    expect(w, 'the figure is shrink-wrapped, so its caption moves with the digit count').toBeTruthy()
    expect(w, `the figure's column is \`${w}\` — a box that holds text is measured in ch or em`)
      .toMatch(/ch|em/)
  })

  it('and the boxes themselves stay equal', () => {
    // The alignment above is only worth anything while the two boxes are the
    // same size; a flex basis that shrink-wrapped would move the second box's
    // whole group instead.
    expect(decl('.cs-count', 'flex'), 'the two boxes no longer share the row equally').toBe('1')
  })
})
