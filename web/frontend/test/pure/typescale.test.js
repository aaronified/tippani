// The type scale: one multiplication, integers only, and no step that vanishes.
//
// The requirement this file exists for, in the owner's words: "every font on the
// screen should respond to the font size changes, either individually in the font
// section, or via the global size." Two halves — the arithmetic has to be right,
// and nothing on the screen may opt out. This file holds the first; the second is
// the sweep, asserted at the bottom by reading the stylesheet and the source.
//
// AND THE MODEL WAS CORRECTED BEFORE IT WAS BUILT, which is the reason the first
// describe is worth its length: "it will not be orig_size x local_dial x
// global_dial. it will be orig_size x scaling_factor." One factor per role. The
// global dial does not multiply anything — it writes itself into all four roles,
// which is what "renormalise" means and what the panel's own words claim.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SIZE_ROLES,
  TYPE_DEFAULT,
  TYPE_FACTORS,
  TYPE_STEPS,
  clampFactor,
  factorsFrom,
  globalOf,
  renormalise,
  scaled,
  sizePrefKey,
  typeTokens,
} from '../../src/type.js'

describe('the arithmetic', () => {
  it('is one multiplication and rounds to a whole pixel', () => {
    expect(scaled(13, 100)).toBe(13)
    expect(scaled(13, 150)).toBe(20) // 19.5, up
    expect(scaled(13, 125)).toBe(16) // 16.25, down
    expect(scaled(9, 75)).toBe(7) // 6.75, up
    expect(scaled(30, 200)).toBe(60)
    // Nothing fractional ever leaves this module: that is the whole point of
    // computing in JS rather than emitting calc() for the browser.
    for (const f of TYPE_FACTORS) {
      for (const px of TYPE_STEPS) expect(Number.isInteger(scaled(px, f))).toBe(true)
    }
  })

  it('never composes two dials', () => {
    // A role at 150 renders 150% of the design, not 150% of some other dial's
    // 150%. Asserted as an identity because the bug it guards against is a second
    // multiplication being added later "so the global still does something".
    const prefs = { sizeUi: 150 }
    expect(typeTokens(prefs)['--type-ui-13']).toBe(`${scaled(13, 150)}px`)
    expect(typeTokens(prefs)['--type-ui-13']).toBe('20px')
  })
})

describe('no step is lost to rounding', () => {
  // THE CONSTRAINT THAT CHOSE THE SCALE. At 75% a 10px step and an 11px step both
  // round to 8 — two designed sizes rendering identically, so the scale has one
  // fewer step than it claims and two things the design distinguished stop being
  // distinguishable. That is why there is no 10.
  it('at every factor the dial offers', () => {
    for (const factor of TYPE_FACTORS) {
      const rendered = TYPE_STEPS.map((px) => scaled(px, factor))
      expect(new Set(rendered).size, `two steps collapse at ${factor}%: ${rendered.join(',')}`).toBe(TYPE_STEPS.length)
    }
  })

  it('and the order never inverts', () => {
    for (const factor of TYPE_FACTORS) {
      const rendered = TYPE_STEPS.map((px) => scaled(px, factor))
      const sorted = [...rendered].sort((a, b) => a - b)
      expect(rendered).toEqual(sorted)
    }
  })

  it('the scale itself is integers, ascending, and has no 10', () => {
    expect(TYPE_STEPS).toEqual([...TYPE_STEPS].sort((a, b) => a - b))
    for (const px of TYPE_STEPS) expect(Number.isInteger(px)).toBe(true)
    expect(TYPE_STEPS).not.toContain(10) // it collides with 11 at 75%
    expect(TYPE_STEPS[0]).toBeGreaterThanOrEqual(9) // 7px text was a legibility bug
  })
})

describe('the dials', () => {
  it('offer a decrease as well as four increases', () => {
    expect(TYPE_FACTORS).toEqual([75, 100, 125, 150, 175, 200])
    expect(TYPE_FACTORS).toContain(TYPE_DEFAULT)
  })

  it('fall back to the designed size rather than to a guess', () => {
    // A preference written by a newer client — a 225 somebody adds later — must
    // render as designed, not as an approximation of something bigger.
    expect(clampFactor(225)).toBe(TYPE_DEFAULT)
    expect(clampFactor('150')).toBe(150)
    expect(clampFactor(undefined)).toBe(TYPE_DEFAULT)
    expect(clampFactor('enormous')).toBe(TYPE_DEFAULT)
    expect(clampFactor(0)).toBe(TYPE_DEFAULT)
  })

  it('read every role out of the preferences', () => {
    const prefs = {}
    for (const role of SIZE_ROLES) prefs[sizePrefKey(role)] = 125
    expect(factorsFrom(prefs)).toEqual({ display: 125, ui: 125, mono: 125, hand: 125 })
    expect(sizePrefKey('display')).toBe('sizeDisplay')
  })
})

describe('the global dial renormalises rather than multiplying', () => {
  it('writes itself into every role', () => {
    const written = renormalise(150)
    expect(written).toEqual({ sizeDisplay: 150, sizeUi: 150, sizeMono: 150, sizeHand: 150 })
    // And that IS the rendered result — no second factor anywhere.
    expect(typeTokens(written)['--type-mono-12']).toBe(`${scaled(12, 150)}px`)
  })

  it('reads back as the value the roles share', () => {
    expect(globalOf(factorsFrom(renormalise(175)))).toBe(175)
    expect(globalOf(factorsFrom({}))).toBe(TYPE_DEFAULT)
  })

  it('and reads back as nothing once a role is tuned away from it', () => {
    // The honest answer, and the reason the global is derived and never stored: a
    // stored 150 beside a display role at 175 is two answers to one question, and
    // the panel would have to choose which to believe.
    const prefs = { ...renormalise(150), sizeDisplay: 175 }
    expect(globalOf(factorsFrom(prefs))).toBe(0)
    // The tuned role keeps its own value; the others keep the global's.
    expect(typeTokens(prefs)['--type-display-13']).toBe(`${scaled(13, 175)}px`)
    expect(typeTokens(prefs)['--type-ui-13']).toBe(`${scaled(13, 150)}px`)
  })

  it('and moving it again pulls a tuned role back in', () => {
    const tuned = { ...renormalise(150), sizeDisplay: 175 }
    const after = { ...tuned, ...renormalise(100) }
    expect(globalOf(factorsFrom(after))).toBe(100)
    expect(factorsFrom(after).display).toBe(100)
  })
})

describe('the tokens', () => {
  it('are one per step per role, and nothing else', () => {
    const tokens = typeTokens({})
    expect(Object.keys(tokens).length).toBe(SIZE_ROLES.length * TYPE_STEPS.length)
    for (const role of SIZE_ROLES) {
      for (const px of TYPE_STEPS) {
        expect(tokens[`--type-${role}-${px}`], `--type-${role}-${px}`).toBe(`${px}px`)
      }
    }
  })

  it('are named after the size they are at 100%', () => {
    // Which is what made the sweep of 255 call sites mechanical: `font-size: 13px`
    // with the interface family becomes `var(--type-ui-13)` and a reviewer can see
    // at a glance that nothing moved.
    expect(typeTokens({})['--type-display-30']).toBe('30px')
  })

  it('carry no size for the two script roles', () => {
    // bengali and devanagari are scripts, not places on the screen: their glyphs
    // are drawn inside a display/ui/mono/hand element and take its size. A dial for
    // them would be an optical adjustment against the Latin face, which is a
    // different control with a different name.
    const names = Object.keys(typeTokens({})).join(' ')
    expect(names).not.toMatch(/bengali|devanagari/)
  })
})

describe('nothing on the screen opts out', () => {
  // THE REQUIREMENT, and the only way to keep it: "every font on the screen should
  // respond to the font size changes, either individually in the font section, or
  // via the global size."
  //
  // A hardcoded size is a piece of the interface that has quietly left the
  // reader's control, and it fails in the way that never gets reported — somebody
  // sets the interface to 150%, one label stays at 11px, and it reads as a
  // rendering glitch rather than as a setting that does not reach there. There
  // were 255 of them before the sweep.
  //
  // READ AS TEXT, both halves, because that is where the sizes are: 103
  // declarations in the stylesheet and 152 inline style objects in the components.
  const SRC = process.env.TIPPANI_SRC
  const css = readFileSync(join(SRC, 'index.css'), 'utf8')

  const sources = (dir = SRC, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) sources(p, out)
      else if (/\.jsx?$/.test(name)) out.push(p)
    }
    return out
  }

  it('the stylesheet is consuming the tokens at all', () => {
    // A floor, so a sweep that silently reverted cannot pass the two checks below
    // by having nothing left to find.
    expect([...css.matchAll(/var\(--type-[a-z]+-\d+\)/g)].length).toBeGreaterThan(80)
  })

  it('and holds no font-size of its own', () => {
    const raw = []
    for (const m of css.matchAll(/font-size:\s*([0-9.]+)px/g)) raw.push(m[1] + 'px')
    expect(
      raw,
      'these sizes are hardcoded in index.css and will not answer the dials — use var(--type-<role>-<px>)',
    ).toEqual([])
  })

  it('and neither does any component', () => {
    // A COMMENT IS NOT A STYLE. type.js documents its own arithmetic with numbers,
    // and this very file names sizes in prose.
    const decommented = (t) =>
      t
        .split('\n')
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l))
        .join('\n')
    const raw = []
    for (const path of sources()) {
      const rel = path.replace(/\\/g, '/').split('/src/')[1]
      const text = decommented(readFileSync(path, 'utf8'))
      for (const m of text.matchAll(/fontSize:\s*([0-9.]+)(?![0-9.])/g)) raw.push(`src/${rel}: fontSize: ${m[1]}`)
    }
    expect(raw.sort(), 'these inline sizes will not answer the dials').toEqual([])
  })

  it('and every token a source names really exists', () => {
    // The other direction: the sweep mapped each size to its nearest step, and a
    // typo — `--type-ui-14`, which is not a step — resolves to nothing and the
    // browser falls back to the inherited size. Silent, and it looks like a
    // cascade problem rather than a spelling one.
    const valid = new Set()
    for (const role of SIZE_ROLES) for (const px of TYPE_STEPS) valid.add(`--type-${role}-${px}`)
    const bad = new Set()
    const scan = (text) => {
      for (const m of text.matchAll(/--type-[a-z]+-\d+/g)) if (!valid.has(m[0])) bad.add(m[0])
    }
    scan(css)
    for (const path of sources()) {
      if (path.endsWith('type.js')) continue // it builds the names rather than naming them
      scan(readFileSync(path, 'utf8'))
    }
    expect([...bad].sort(), 'these tokens are not on the scale, so they resolve to nothing').toEqual([])
  })
})
