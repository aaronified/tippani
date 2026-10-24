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
// column wide enough for the counts a library actually reaches, so a `1` and an
// `11` and a `100` all leave their captions in the same place. Then the two rows
// read as one pair rather than as two tiles that happen to be adjacent.
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

  // A VALUE BESIDE A LABEL GIVES WAY — the rule, not the instance.
  //
  // K10's OWN FIX WAS UNGUARDED, which is this round's headline lesson: reverting
  // `.cs-row-meta` to `flex: none` left every one of 3,147 cases green, because
  // the nearest guard asserted the `name-scroll` CLASS — a shape. And the rule
  // was landed on ONE class while a second slot on the same family of screens
  // still held a character's name in a box that could not shrink, which is how a
  // fix becomes a special case. Both are here; a third joins by being listed.
  const GIVES_WAY = [
    // The value on a character sheet's row: "In this work", the note, the year.
    '.cs-row-meta',
    // The right-hand slot on the door a chip opens: a count phrase on one row and
    // the CHARACTER's name on another (`a.character`, identity.jsx).
    '.cs-choose-meta',
  ]

  it.each(GIVES_WAY)('%s can give way rather than squeezing the label beside it', (cls) => {
    const f = decl(cls, 'flex')
    expect(f, `${cls} declares no flex at all`).toBeTruthy()
    expect(f, `${cls} is \`flex: ${f}\` — a value that cannot shrink takes its width out of the row and clips the label`)
      .not.toMatch(/^none\b|^0 0\b/)
    expect(decl(cls, 'min-width'),
      'the value keeps its content width, so it cannot shrink however its flex is written')
      .toBe('0')
    const cap = decl(cls, 'max-width')
    expect(cap, `${cls} has no ceiling, so a long value can still take the whole row`).toBeTruthy()
    expect(cap, `${cls}'s ceiling is \`${cap}\` — a share of the container, not a px, because the row scales`)
      .not.toMatch(/px/)
  })

  it('and the boxes themselves stay equal', () => {
    // The alignment above is only worth anything while the two boxes are the
    // same size; a flex basis that shrink-wrapped would move the second box's
    // whole group instead.
    expect(decl('.cs-count', 'flex'), 'the two boxes no longer share the row equally').toBe('1')
  })
})
