// Popups are placed in one place, and it is not the stylesheet.
//
// TWO BUGS, ONE CAUSE, AND THIS IS THE GUARD AGAINST BOTH.
//
// The first was visible for one release. The collapsed colour picker rendered
// as `className="cs-menu token-menu"` — two classes on one element, because
// .token-menu carried the popover's look and .cs-menu was meant to carry its
// placement. But .token-menu also placed itself (`top: calc(100% + 4px)`), and
// .cs-menu set `bottom` without clearing the `top`. Neither declaration loses:
// for a box with `height: auto`, top and bottom both set means CSS SOLVES for
// the height, which came out negative. What shipped was a 3px sliver.
//
// The second was there from the beginning and nobody had named it. Every popup
// in the app placed itself with `position: absolute; top: calc(100% + N)`,
// which is correct exactly once — when there is room below the trigger. Open a
// dropdown near the bottom of a phone and its options rendered below the fold,
// so choosing one meant scrolling the page to find a menu that was supposed to
// be in front of you.
//
// CSS cannot fix the second one. To know it is off the screen a popup has to
// measure the VIEWPORT, and an absolutely-positioned element is placed against
// its offset parent, which knows nothing about where on the page it ended up.
// So placement moved into JS — useAnchoredPosition in ui.jsx — and the popups
// moved into portals.
//
// Which makes this test's invariant much stronger than the one it replaces.
// It used to check that composed classes did not contradict each other. Now it
// checks that no popup class places itself AT ALL: the arithmetic lives in
// placeAnchored (covered by anchored-popup.test.js), and a `top` reintroduced
// here would silently re-create both bugs at once — it would fight the inline
// style on some browsers, and it would restore the "always downward" behaviour
// on any popup that stopped passing a style.
//
// jsdom cannot see either bug: it applies no layout, so every element is
// present, correct and accessible inside a box of no size. Hence a sweep over
// the stylesheet, in the shape scroll-containment.test.js established.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
// Comments stripped FIRST. A declaration like
//   min-width: auto; /* never shrink below content */
// otherwise reads back as the comment text, and the first version of this test
// duly reported a min-width of "auto (never shrink below content)".
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Every rule block, as { sel, body, at }. Lifted from
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

// Every rule that applies to an element carrying exactly `classes`, ranked the
// way the cascade ranks them: more classes in the selector wins, and ties go to
// source order.
//
// The specificity half is not pedantry — without it this file reports a failure
// that is really its own blind spot. `.hand-card` sets `position: relative` and
// sits LATER in the stylesheet than `.tp-select-panel`, so on a source-order-only
// model a multi-select panel resolves to `relative`. The rule that actually wins
// is `.tp-select-panel.tp-multi` — two classes against one — and a model that
// only matches single-class selectors cannot see that rule at all.
//
// Only plain class compounds count. Descendant, pseudo and attribute selectors
// are skipped rather than guessed at.
function applicable(classes) {
  const set = new Set(classes)
  return ALL.flatMap((r) => r.sel.split(',').map((sel) => ({ sel: sel.trim(), body: r.body, at: r.at })))
    .filter(({ sel }) => {
      const parts = sel.match(/\.[A-Za-z0-9_-]+/g)
      if (!parts) return false
      // Anything left after removing the class tokens means it is not a plain
      // compound — a descendant combinator, a pseudo, an element.
      if (sel.replace(/\.[A-Za-z0-9_-]+/g, '').trim() !== '') return false
      return parts.every((p) => set.has(p.slice(1)))
    })
    .map((r) => ({ ...r, spec: (r.sel.match(/\./g) || []).length }))
    .sort((a, b) => a.spec - b.spec || a.at - b.at)
}

function resolved(classes, prop) {
  const re = new RegExp(`(^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'i')
  let val = null
  for (const r of applicable(classes)) {
    const m = re.exec(r.body)
    if (m) val = m[2].trim()
  }
  return val
}

// `auto` is the deliberate absence of an offset, which is why it is written.
const pins = (v) => v !== null && !['auto', 'unset', 'initial'].includes(v.toLowerCase())

const OFFSETS = ['top', 'right', 'bottom', 'left']

// Every class that styles a JS-placed popup. Adding a popup means adding it
// here — the list is the contract.
const POPUPS = ['token-menu', 'tp-select-panel', 'more-menu', 'date-pop', 'cs-menu']

describe('a JS-placed popup', () => {
  it('the classes still exist, so this test is testing something', () => {
    // The sweep's own failure mode: a renamed class quietly asserting nothing.
    for (const p of POPUPS) {
      expect(applicable([p]).length, `.${p} has no rule`).toBeGreaterThan(0)
    }
  })

  it('is fixed, not absolute — it is a child of <body>', () => {
    for (const p of POPUPS) {
      expect(resolved([p], 'position'), `.${p}`).toBe('fixed')
    }
  })

  it('does not place itself in CSS', () => {
    // The whole point. top/left/max-height arrive as an inline style from the
    // measured anchor; a value here either fights it or silently restores the
    // "always downward, never clamped" behaviour this replaced.
    const offenders = []
    for (const p of POPUPS) {
      for (const prop of OFFSETS) {
        const v = resolved([p], prop)
        if (pins(v)) offenders.push(`.${p} { ${prop}: ${v} }`)
      }
    }
    expect(offenders, 'placement belongs in useAnchoredPosition, not the stylesheet').toEqual([])
  })

  it('does not cap its own height', () => {
    // max-height is computed from the room actually available above or below
    // the trigger. A fixed cap here would be either too small on a tall screen
    // or too tall on a phone, which is the bug.
    const capped = POPUPS.filter((p) => pins(resolved([p], 'max-height')))
    expect(capped, 'max-height is computed per-open from the viewport').toEqual([])
  })
})

// The composition check that caught the 1.7.4 sliver, kept because composing a
// class onto a popup is still legal (.cs-menu does it for the popover skin) and
// the failure is still invisible to every other kind of test.
describe('a composed popup', () => {
  function composedWith(popup) {
    const found = new Set()
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { walk(p); continue }
        if (!/\.jsx?$/.test(e.name)) continue
        const re = /className=(?:"([^"]*)"|'([^']*)')/g
        const src = readFileSync(p, 'utf8')
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

  const cases = POPUPS.flatMap((p) => composedWith(p).map((list) => ({ popup: p, list })))

  it('there are some, so this test is testing something', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  // Three tests over every composition rather than three PER composition: within
  // each family the assertion is identical and only the class list changes, and
  // the class list already rode in the failure message rather than the title. The
  // collected list names every offending composition at once instead of the run
  // dying on the first. `cases` is discovered by scanning src/, so a list holding
  // two popup classes ("cs-menu token-menu") is still visited once per popup name
  // — a repeated iteration over identical input, which costs nothing but is worth
  // knowing about if the numbers look odd.
  it('does not pin both top and bottom', () => {
    const offenders = []
    for (const { list } of cases) {
      const classes = list.split(' ')
      if (pins(resolved(classes, 'height'))) continue
      const top = resolved(classes, 'top')
      const bottom = resolved(classes, 'bottom')
      if (pins(top) && pins(bottom)) offenders.push(`"${list}" top: ${top} and bottom: ${bottom}`)
    }
    expect(
      offenders,
      'an auto-height box solves for a NEGATIVE height ' +
        'and renders as its own borders. Clear one with `auto`.',
    ).toEqual([])
  })

  it('does not pin both left and right', () => {
    const offenders = []
    for (const { list } of cases) {
      const classes = list.split(' ')
      if (pins(resolved(classes, 'width'))) continue
      const left = resolved(classes, 'left')
      const right = resolved(classes, 'right')
      if (pins(left) && pins(right)) offenders.push(`"${list}" left: ${left} and right: ${right}`)
    }
    expect(offenders).toEqual([])
  })

  // The max-width check that used to sit here is gone deliberately. It caught
  // .token-menu's `max-width: 100%` becoming a 40px cap when composed onto a
  // colour dot — a hazard of ABSOLUTE positioning, where 100% means the
  // offset parent. Every popup is `fixed` now, so 100% means the viewport and
  // the trap no longer exists. Asserting it would be theatre.
  //
  // This is the replacement, and it is the thing that would actually break:
  // the popup class is only `fixed` while nothing composed over it says
  // otherwise. .hand-card gaining a `position` — entirely plausible, it is
  // the app's most-composed class — would turn every menu wearing it back
  // into an absolutely-positioned one, silently, and the flip and the clamp
  // would stop working with no error anywhere.
  it('still resolves to position: fixed', () => {
    const offenders = []
    for (const { popup, list } of cases) {
      const position = resolved(list.split(' '), 'position')
      if (position !== 'fixed') {
        offenders.push(`"${list}" is ${position} — something composed over .${popup} changed its position`)
      }
    }
    expect(offenders).toEqual([])
  })
})
