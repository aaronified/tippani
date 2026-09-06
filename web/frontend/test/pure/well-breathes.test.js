// A ROW OF OBJECTS SITS IN ITS WELL, not against the top of it.
//
// THE REPORT, the owner's: "the cast (and also the works page in actor/character
// pages) images hug the top of the well, needs slightly more breathing room."
//
// WHAT A WELL IS FOR, in this app's own words at `.cs-strip`: the covers and the
// faces are objects with a shadow under them, and an object with a shadow needs
// something to cast it onto. A shelf that shows 4px above the artwork and 10px
// under it is not a shelf the object is sitting ON — it reads as artwork pushed
// up against a lid, which is what was reported.
//
// THE RULE, and it is the rule rather than the two numbers: the space between
// the top of a well and the row inside it equals the space beneath. Either may
// grow; they may not diverge. Both halves come from two rules — the well pads
// itself and the row pads itself — which is why reading one class cannot answer
// it, and why "hugging" was invisible in a diff that only ever touched one.
//
// WHY THE STYLESHEET AND NOT THE SCREEN: jsdom lays nothing out, so a rendered
// strip reports every box at zero and would "breathe" however it is declared.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a strip is a
// `.cs-strip` well wrapping a scrolling row — `.cs-tiles` for a person's works,
// `.cs-faces` for a work's cast.

import { describe, expect, it } from 'vitest'

import { declaredIn } from '../css-cascade.js'

const decl = (sel, prop) => {
  let out = null
  for (const r of declaredIn(sel)) if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  return out
}

// `padding: a b c` / `a b` / `a` — the top and bottom of a shorthand.
function vertical(sel) {
  const p = decl(sel, 'padding')
  expect(p, `${sel} declares no padding, so the well's spacing is coming from somewhere unread`).toBeTruthy()
  const parts = p.split(/\s+/)
  const px = (v) => {
    const n = Number(String(v).replace(/px$/, ''))
    expect(Number.isFinite(n), `${sel}'s padding is \`${p}\` — this reads px, and a unit it cannot read is a silent pass`).toBe(true)
    return n
  }
  if (parts.length === 1) return { top: px(parts[0]), bottom: px(parts[0]) }
  if (parts.length === 2) return { top: px(parts[0]), bottom: px(parts[0]) }
  return { top: px(parts[0]), bottom: px(parts[parts.length === 3 ? 2 : 2]) }
}

// Each row that scrolls inside the `.cs-strip` well. A third joins by being listed.
const ROWS = ['.cs-tiles', '.cs-faces']

describe('a row of objects in its well', () => {
  it.each(ROWS)('%s leaves as much shelf above it as below', (row) => {
    const well = vertical('.cs-strip')
    const inner = vertical(row)
    const above = well.top + inner.top
    const below = well.bottom + inner.bottom
    expect(above,
      `${row} sits ${above}px from the top of its well and ${below}px from the bottom — ` +
      'the artwork is pushed against one edge, which is what "hugging the top" was')
      .toBe(below)
  })

  it.each(ROWS)('%s leaves enough of it to see', (row) => {
    const well = vertical('.cs-strip')
    const above = well.top + vertical(row).top
    // Equal and nearly zero would satisfy the case above while leaving the
    // shadow nothing to fall on.
    expect(above, `${row} has ${above}px of shelf above it, which is not a shelf`).toBeGreaterThanOrEqual(8)
  })
})
