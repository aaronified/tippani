// A HOVER STYLE ON A CONTROL A THUMB PRESSES MUST BE GATED ON A HOVERING POINTER.
//
// THE BUG IT FIXES, in the owner's words: "the press effect is staying on the icon
// even after the action has been completed. until i click somewhere else on the
// screen." That is not a press effect. On a touch screen the last-tapped element
// KEEPS :hover until something else is tapped, so a dock key stayed lit for as
// long as the reader looked at whatever it had just done.
//
// WHY THE STYLESHEET AND NOT THE SCREEN. jsdom has no pointer and no layout, and
// the browser harness runs with a mouse — neither can reproduce sticky hover at
// all. The declaration is the defect and the declaration is greppable.
//
// THIS IS A LIST, NOT A BAN. Most hover styles in the app are on surfaces a thumb
// never keeps on screen: a menu row closes the menu, a card's ⋯ opens a panel over
// it. These are the controls that STAY under the finger after they are pressed.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

// Each entry is a selector that persists on screen after a touch and carries a
// hover style. Adding one here is how a new persistent control joins the rule.
const PERSISTENT = ['.mobile-dock-btn']

// Every `@media (hover: hover)` block's body, concatenated. Brace-counted rather
// than regexed to a closing brace: these blocks contain nested rules, and a lazy
// match would stop at the first `}` inside one.
function hoverGatedBlocks(text) {
  const out = []
  const marker = '@media (hover: hover)'
  let at = text.indexOf(marker)
  while (at !== -1) {
    const open = text.indexOf('{', at)
    let depth = 0
    let i = open
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}' && --depth === 0) break
    }
    out.push(text.slice(open + 1, i))
    at = text.indexOf(marker, i)
  }
  return out
}

const gated = hoverGatedBlocks(css).join('\n')

// Every rule whose selector mentions the class AND :hover, anywhere in the file.
const hoverRulesFor = (sel, text) =>
  [...text.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .map((m) => m[1].trim())
    .filter((s) => s.includes(sel) && s.includes(':hover'))

describe('a control that stays under the thumb', () => {
  for (const sel of PERSISTENT) {
    it(`${sel} has a hover style at all, so this test is testing something`, () => {
      expect(hoverRulesFor(sel, css).length).toBeGreaterThan(0)
    })

    it(`${sel} declares every one of them inside @media (hover: hover)`, () => {
      const all = hoverRulesFor(sel, css)
      const inside = hoverRulesFor(sel, gated)
      expect(
        all.filter((s) => !inside.includes(s)),
        'an ungated :hover on a control a thumb presses sticks until the next tap',
      ).toEqual([])
    })
  }
})
