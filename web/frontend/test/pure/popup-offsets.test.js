// A popup with a top AND a bottom has no height.
//
// The bug, shipped in 1.7.4: the collapsed colour picker renders as
// `className="cs-menu token-menu"` — two classes on one element, because
// .token-menu carries the popover's look (border, radius, shadow, animation)
// and .cs-menu was meant to carry its placement. But .token-menu also places
// itself: `position: absolute; top: calc(100% + 4px); left: 0`. .cs-menu set
// `bottom: calc(100% + 6px)` to open upwards and never cleared the `top`.
//
// Nothing conflicts in the way CSS usually conflicts — neither declaration
// loses. For an absolutely-positioned box with `height: auto`, `top` and
// `bottom` both set is not a tie to be broken; §10.6.4 says SOLVE for the
// height. Against a 44px anchor that arithmetic came out around −60px, clamped
// to zero, and what reached the screen was the 1.4px border, twice, with
// nothing in between: a 3px sliver where the list should have been.
//
// jsdom cannot catch this. It applies no layout, so every existing test for
// that menu passed — the elements were all present and correct, in a box with
// no height. So the test is an invariant over the stylesheet, in the shape
// scroll-containment.test.js already established for a bug of omission: the
// failure mode is not "someone wrote a wrong value", it is "someone composes
// two positioning classes next year and never thinks about the pair at all".

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// Every rule block, as { selector, body, at }. Lifted from
// scroll-containment.test.js: the file nests only one level deep, and the
// blocks that matter never nest inside each other.
function rules() {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(CSS))) {
    const sel = m[1].split('\n').pop().trim()
    if (!sel || sel.startsWith('@')) continue
    out.push({ sel, body: m[2], at: m.index })
  }
  return out
}

const ALL = rules()

// Every declaration of `prop` on a single-class selector, in source order.
// Specificity is equal across all of these (one class each), so source order is
// the cascade.
function declared(cls, prop) {
  const re = new RegExp(`(^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'i')
  return ALL.filter((r) => r.sel.split(',').map((s) => s.trim()).includes(`.${cls}`))
    .map((r) => {
      const m = re.exec(r.body)
      return m ? { value: m[2].trim(), at: r.at } : null
    })
    .filter(Boolean)
}

// What the element ends up with for `prop`, given the classes on it: the last
// declaration in source order wins.
function resolved(classes, prop) {
  const all = classes.flatMap((c) => declared(c, prop))
  if (!all.length) return null
  return all.sort((a, b) => a.at - b.at).pop().value
}

// `auto` is the absence of an offset, which is the whole point of writing it.
const pins = (v) => v !== null && v.toLowerCase() !== 'auto' && v.toLowerCase() !== 'unset'

// Every multi-class `className` in the app that includes a popup class. Plain
// string literals only — a computed class list is not something this test can
// resolve, and every current call site is a literal.
function composedWith(popup) {
  const found = new Set()
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!/\.jsx?$/.test(e.name)) continue
      const src = readFileSync(p, 'utf8')
      const re = /className=(?:"([^"]*)"|'([^']*)')/g
      let m
      while ((m = re.exec(src))) {
        const list = (m[1] ?? m[2]).split(/\s+/).filter(Boolean)
        if (list.includes(popup) && list.length > 1) found.add(list.join(' '))
      }
    }
  }
  walk(SRC)
  return [...found]
}

// The popover classes that place themselves. A class in this list carries
// offsets, so anything composed onto it inherits them.
const POPUPS = ['token-menu']

describe('a composed popup', () => {
  const cases = POPUPS.flatMap((p) => composedWith(p).map((list) => ({ popup: p, list })))

  it('there are some, so this test is testing something', () => {
    // The sweep's own failure mode: a regex that stops matching and quietly
    // asserts nothing about an empty list.
    expect(cases.length).toBeGreaterThan(0)
  })

  it('declares a self-placing popup class that actually places itself', () => {
    // If .token-menu ever stops setting offsets, the invariant below is vacuous
    // and should be deleted rather than left passing.
    for (const p of POPUPS) {
      const set = ['top', 'right', 'bottom', 'left'].filter((k) => declared(p, k).length)
      expect(set.length, `.${p} sets no offsets`).toBeGreaterThan(0)
    }
  })

  for (const { popup, list } of cases) {
    const classes = list.split(' ')

    // The two axes, each of which over-constrains the same way. `height`/`width`
    // set explicitly makes three-of-three legal again — CSS then drops the end
    // offset instead of solving for the size — so that is the one exemption.
    it(`"${list}" does not pin both top and bottom`, () => {
      if (pins(resolved(classes, 'height'))) return
      const top = resolved(classes, 'top')
      const bottom = resolved(classes, 'bottom')
      expect(
        pins(top) && pins(bottom),
        `top: ${top} and bottom: ${bottom} — an auto-height box solves for a negative height. ` +
          `Clear one with \`auto\` in .${classes.find((c) => c !== popup)}.`,
      ).toBe(false)
    })

    it(`"${list}" does not pin both left and right`, () => {
      if (pins(resolved(classes, 'width'))) return
      const left = resolved(classes, 'left')
      const right = resolved(classes, 'right')
      expect(
        pins(left) && pins(right),
        `left: ${left} and right: ${right} — an auto-width box is stretched between them.`,
      ).toBe(false)
    })

    // The other half of the 1.7.4 bug, and the quieter one. .token-menu caps at
    // `max-width: 100%` because it hangs under a full-width text input; the
    // colour menu hangs under a ~40px dot, so it inherited a 40px cap for a
    // 148px list. min-width happens to rescue it, which is luck, not design.
    it(`"${list}" is not capped by an anchor it does not fill`, () => {
      const cap = resolved(classes, 'max-width')
      if (cap !== '100%') return
      const min = resolved(classes, 'min-width')
      expect(
        min === null,
        `max-width: 100% is a cap on the ANCHOR's width, and this menu sets min-width: ${min}. ` +
          `One of them is wrong — set max-width: none if the popup is not anchor-width.`,
      ).toBe(true)
    })
  }
})
