// A CATEGORY'S COLOUR IS DRAWN BY A CLASS, AND EXACTLY ONE FUNCTION NAMES IT.
//
// WHAT WENT WRONG. The board's category filter painted its dots itself:
//
//     style={{ background: `var(--${tok})` }}
//
// and the tokens are `yellow`, `blue`, `pink`… while the properties the app
// actually defines are `--hl-1`…`--hl-6`. `var(--yellow)` names a custom
// property nothing has ever declared, and an undefined custom property with no
// fallback is invalid at computed-value time — so no fill happened, every
// option drew the dot's own background, and the picker offered six identical
// grey circles on desktop and phone alike. Reported by the owner, who could see
// it and no test could: every existing assertion was on the class name, and the
// broken code's class name was right.
//
// WHY A CLASS AND NOT A COLOUR ASSERTION. jsdom resolves neither `var()` nor
// the cascade, so a computed-background check would have passed on the broken
// code too. What a class buys instead is a NAME that must exist on both sides:
// the function that produces it and the stylesheet that declares it, checked
// against each other here. That is the pair the bug broke.
//
// AND THE THIRD CASE IS THE ONE WORTH KEEPING. `.cat-opt-dot` must declare no
// background of its own. It did, so the broken picker looked deliberate rather
// than empty — a fallback fill is what turned an invalid declaration into six
// plausible grey dots instead of six missing ones. The row that genuinely has
// no category says so with its own class.

import { describe, expect, it } from 'vitest'

import { CATEGORY_SLOTS, categoryDotClass } from '../../src/theme.js'
import { cssRules } from '../css-rules.js'
import { readSource, sourcesUnder } from '../src-files.js'

const rules = cssRules(readSource('index.css'))
// Every rule whose selector list names this class on some compound. A compound
// is split on `.` so `.cat-opt-dot.cat-opt-none` answers to both of its classes,
// and on `:` so a pseudo does not become part of the name.
const named = (cls) =>
  rules.filter((r) =>
    r.sel.split(',').some((s) =>
      s.trim().split(/\s+/).some((part) => part.split(':')[0].split('.').includes(cls)),
    ),
  )

describe('categoryDotClass', () => {
  it('gives every slot its own class', () => {
    const out = CATEGORY_SLOTS.map(categoryDotClass)
    expect(out).toEqual(CATEGORY_SLOTS.map((tok) => `dot-${tok}`))
    // Six slots, six classes: a mapping that collapsed two would still satisfy
    // the shape above if the tokens were ever written out by hand.
    expect(new Set(out).size).toBe(CATEGORY_SLOTS.length)
  })

  it('gives a token it does not know no class at all', () => {
    // Not `dot-undefined`, which is what string concatenation produces and what
    // a stylesheet then silently ignores.
    for (const bad of ['', 'crimson', undefined, null, 'DOT-YELLOW']) {
      expect(categoryDotClass(bad)).toBe('')
    }
  })
})

describe('the stylesheet declares what the function names', () => {
  it('paints every slot class with a distinct --hl-N', () => {
    const seen = new Set()
    for (const tok of CATEGORY_SLOTS) {
      const decls = named(categoryDotClass(tok))
        .map((r) => r.body)
        .join(';')
      const hl = decls.match(/background:\s*var\(\s*(--hl-\d+)\s*\)/)
      expect(hl, `.dot-${tok} declares no --hl-N background`).toBeTruthy()
      expect(seen.has(hl[1]), `${hl[1]} paints two slots`).toBe(false)
      seen.add(hl[1])
    }
    expect(seen.size).toBe(CATEGORY_SLOTS.length)
  })

  it('leaves the dot itself unpainted, so the class is the only painter', () => {
    // `.cat-opt-dot` and `.color-dot` are the two bases these classes land on.
    for (const base of ['cat-opt-dot', 'color-dot']) {
      for (const r of named(base)) {
        // The "any category" row is the exception and carries its own class,
        // so it is a compound selector rather than the bare base.
        if (/\.cat-opt-none/.test(r.sel)) continue
        expect(r.body, `${r.sel} paints a background the slot class must beat`).not.toMatch(/(^|;)\s*background(-color)?\s*:/)
      }
    }
  })

  it('gives the no-category row a fill of its own', () => {
    const decls = named('cat-opt-none').map((r) => r.body).join(';')
    expect(decls).toMatch(/background:\s*var\(--faint\)/)
  })
})

describe('nothing builds a custom property name by hand', () => {
  it('has no var(--${...}) anywhere in src', () => {
    // The exact shape of the bug: a token interpolated into a property name.
    // Every real reference is either a literal `var(--hl-N)` or goes through
    // categoryVar/categoryDotClass, both of which check the token first.
    const offenders = sourcesUnder((n) => /\.(jsx?|css)$/.test(n))
      .filter((rel) => /var\(\s*--\$\{/.test(readSource(rel)))
    expect(offenders).toEqual([])
  })
})
