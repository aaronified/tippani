// EVERY BLOCK IN A SHEET IS THE SAME WIDTH, AND THE GAPS BETWEEN THEM ARE EQUAL.
//
// THE REPORT, the owner's, over a screenshot of a character sheet: "the quote and
// scene are not taking the same width as other fields. and also the gap between
// fields are not equal (should be equal)."
//
// WHAT IT WAS, measured in a browser on a real library at 390 before it was
// touched: the three wrappers agreed at 364px and their INSETS did not — the
// rows padded 4px a side, the facts 6px and the counts 10px, so the rows drew
// 356px wide, the facts 352 and the counts 344. The counts also padded 2px above
// and below where the rows pad none, which is where the uneven gap came from: two
// rows meet at a hairline and a row meets the counts across 2px of nothing.
//
// THE RULE, and it is CLAUDE.md's: "Spacing is a constant. `var(--edge)` and
// `var(--row)`, restated per screen if a screen genuinely differs. A step typed
// into a row is a bug." Three steps typed into three siblings is that bug three
// times, so what is checked is that they READ THE SAME TOKEN rather than that
// they happen to equal 4px — a later hand may move the token and may not go back
// to typing a number per block.
//
// WHY THE STYLESHEET AND NOT THE SCREEN: jsdom lays nothing out, so a rendered
// sheet reports every block at zero width and they would "agree" however they are
// declared. The browser half is what found this in the first place.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that a sheet stacks
// `.cs-row-wrap` (an ordinary row and its pencil), `.cs-facts` (three short
// answers side by side) and `.cs-pair` (two counts) as siblings in one column.

import { describe, expect, it } from 'vitest'

import { declaredIn } from '../css-cascade.js'

const decl = (sel, prop) => {
  let out = null
  for (const r of declaredIn(sel)) if (r.decls[prop]) out = String(r.decls[prop].value).trim()
  return out
}

// The blocks a sheet stacks. A fourth joins the rule by being listed.
const BLOCKS = ['.cs-row-wrap', '.cs-facts', '.cs-pair']

describe('the blocks a sheet stacks', () => {
  it.each(BLOCKS)('%s takes its side inset from the token, not from a typed step', (sel) => {
    const pad = decl(sel, 'padding')
    expect(pad, `${sel} declares no padding, so its width comes from somewhere unread`).toBeTruthy()
    expect(pad, `${sel} pads \`${pad}\` — a step typed into a block is the bug the standing rule names`)
      .toContain('var(--cs-inset)')
  })

  it.each(BLOCKS)('%s adds no vertical padding, so the gaps between blocks are equal', (sel) => {
    const pad = decl(sel, 'padding')
    const top = String(pad).split(/\s+/)[0]
    expect(Number(String(top).replace('px', '')),
      `${sel} pads \`${pad}\` — the ${top} above and below it makes its neighbours further away than any other pair`)
      .toBe(0)
  })

  it.each(BLOCKS)('%s separates what is inside it by the same token too', (sel) => {
    const gap = decl(sel, 'gap')
    expect(gap, `${sel} declares no gap`).toBeTruthy()
    expect(gap, `${sel} gaps \`${gap}\` — two things side by side in a sheet are spaced one way`)
      .toContain('var(--cs-inset)')
  })

  it('and the token they all read exists, with a length in it', () => {
    const v = decl(':root', '--cs-inset')
    expect(v, '--cs-inset is not declared, so every block above falls back to nothing').toBeTruthy()
    expect(v, `--cs-inset is \`${v}\``).toMatch(/^[0-9.]+(px|em|rem)$/)
  })
})
