// Every accent-filled control wears the accent grain, and every grain has an off
// switch THAT WORKS.
//
// Two invariants, and both fail silently. A new accent-filled control that nobody
// remembers to texture looks *fine* — it is the right colour, the right size, in
// the right place — and only reads as wrong beside the ones that are textured. That
// is how the ＋ Add pill, the top-bar search and help pills, the user chip, and both
// mobile selection states ended up as flat colour while every comparable control
// carried leather or rubber.
//
// The second is worse, because it is an accessibility promise. index.css drops every
// decorative layer under `prefers-contrast: more` and `prefers-reduced-transparency:
// reduce`, and its own comment says why that rule was written when it was: the
// alternative was shipping a release that added six textured surfaces with no way to
// turn any of them off.
//
// HOW THIS TEST USED TO BE WRONG, WHICH IS THE REASON FOR EVERYTHING BELOW IT.
// It asserted that each selector's *text appeared inside* the contrast block, and
// then said the promise was kept. Every selector was present, every assertion
// passed, and the block did nothing: it sat in `@layer components` where
// `html[data-theme="dark"] .grain-overlay` out-specified it, three later `::before`
// rules out-ordered it, and `.topbar::before` and the whole drawer group — which
// live after the last `@layer components` closes, and so are unlayered — beat it
// however specific it was. A reader who asked their operating system for more
// contrast got the grain anyway, and a green test said otherwise.
//
// So this no longer reads the stylesheet as prose. It parses it, tracks which layer
// and which media context every declaration is in, and RESOLVES the cascade —
// importance, then layer order (reversed for important declarations, which is the
// entire trick), then specificity, then source order. Then it asserts the resolved
// value, because the resolved value is the only thing a reader can see.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const css = readFileSync(join(SRC, 'index.css'), 'utf8')

// ---------------------------------------------------------------------------
// A cascade resolver, small enough to read
// ---------------------------------------------------------------------------

// Layer order, lowest priority first for NORMAL declarations. Tailwind's own
// `@import "tailwindcss"` declares `theme, base, components, utilities`, and this
// file's `@layer base` / `@layer components` blocks append into two of them.
// Unlayered sits at the end of this list because unlayered normal declarations beat
// layered ones — and, for important declarations, the order reverses and unlayered
// loses to every layer. That reversal is why `prefers-reduced-motion` has always
// worked (it is `!important` in `@layer base`) and why nothing else did.
const LAYERS = ['theme', 'base', 'components', 'utilities', null]

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

// Split a comma list at paren depth zero, so `:is(a, b)` survives intact.
function splitList(s) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// Selector specificity as [ids, classes, types]. `:is()`, `:not()` and `:has()`
// contribute the specificity of their most specific argument, per the spec.
function specificity(sel) {
  let a = 0
  let b = 0
  let c = 0
  let s = ` ${sel} `
  s = s.replace(/:(?:is|not|has|matches)\(([^()]*)\)/g, (_, inner) => {
    let best = [0, 0, 0]
    for (const arg of splitList(inner)) {
      const sp = specificity(arg)
      if (sp[0] !== best[0] ? sp[0] > best[0] : sp[1] !== best[1] ? sp[1] > best[1] : sp[2] > best[2]) best = sp
    }
    a += best[0]; b += best[1]; c += best[2]
    return ' '
  })
  s = s.replace(/:where\([^()]*\)/g, ' ')
  s = s.replace(/::[\w-]+(?:\([^()]*\))?/g, () => { c++; return ' ' })
  s = s.replace(/#[\w-]+/g, () => { a++; return ' ' })
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ' ' })
  s = s.replace(/\.[\w-]+/g, () => { b++; return ' ' })
  s = s.replace(/:[\w-]+(?:\([^()]*\))?/g, () => { b++; return ' ' })
  s.replace(/[A-Za-z][\w-]*/g, () => { c++; return ' ' })
  return [a, b, c]
}

// Everything after the last combinator: the compound that decides what element the
// rule lands on. `html[data-aesthetic="paper"] .film-frame::before` reduces to
// `.film-frame::before`.
const rightmost = (sel) => sel.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() || ''

// The simple selectors of a compound, as a set, so containment can be tested.
const simples = (compound) => new Set(compound.match(/::?[\w-]+(?:\([^()]*\))?|\.[\w-]+|#[\w-]+|\[[^\]]*\]|^[A-Za-z][\w-]*/g) || [])

// Two rules land on the same element when one compound refines the other — so the
// test is containment in EITHER direction, not one. `.preset-callout::before` and
// `.preset-callout.tex-paper::before` compete both ways round, which matters
// because the off switch is written as the general one and the texture as the
// specific one. Two compounds where neither contains the other (`.tex-paper`
// against `.tex-film`) share no element and are correctly left out.
//
// Any ancestor prefix is accepted: a rule narrowed to one theme or one aesthetic
// still applies in some reader's state, and the off switch has to win in every
// state, not the convenient one.
function competes(sel, target) {
  const mine = simples(rightmost(sel))
  const theirs = simples(target)
  const covers = (a, b) => { for (const s of b) if (!a.has(s)) return false; return true }
  return covers(mine, theirs) || covers(theirs, mine)
}

function parse(src) {
  const rules = []
  const stack = []
  let buf = ''
  let order = 0
  let i = 0

  const layerOf = () => {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].layer) return stack[k].layer
    return null
  }
  const rule = () => {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].decls) return stack[k]
    return null
  }
  const flush = () => {
    const r = rule()
    const at = buf.indexOf(':')
    if (r && at > 0) {
      const prop = buf.slice(0, at).trim()
      let value = buf.slice(at + 1).trim()
      const important = /!\s*important$/i.test(value)
      if (important) value = value.replace(/!\s*important$/i, '').trim()
      if (prop && !prop.startsWith('@')) r.decls[prop] = { value, important }
    }
    buf = ''
  }

  while (i < src.length) {
    const ch = src[i]
    if (ch === '"' || ch === "'") {
      // A quoted string can hold braces and semicolons; the SVG grain tile is one.
      const end = src.indexOf(ch, i + 1)
      const stop = end < 0 ? src.length : end + 1
      buf += src.slice(i, stop)
      i = stop
      continue
    }
    if (ch === '{') {
      const prelude = buf.trim()
      buf = ''
      i++
      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s({]/)[0].toLowerCase()
        if (name === 'keyframes' || name === 'font-face' || name === 'property') {
          // No selectors inside, and `from {}` / `to {}` would parse as ones.
          let depth = 1
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            i++
          }
          continue
        }
        stack.push({
          layer: name === 'layer' ? prelude.slice(6).replace(/\{$/, '').trim() || null : null,
          media: name === 'media' ? prelude : null,
        })
        continue
      }
      const entry = {
        selectors: splitList(prelude),
        decls: {},
        layer: layerOf(),
        media: stack.map((s) => s.media).filter(Boolean),
        order: order++,
      }
      rules.push(entry)
      stack.push(entry)
      continue
    }
    if (ch === '}') { flush(); stack.pop(); i++; continue }
    if (ch === ';') { flush(); i++; continue }
    buf += ch
    i++
  }
  return rules
}

const rules = parse(stripComments(css))

// True when `a` wins over `b` on the same element, both in the author origin.
function wins(a, b) {
  if (a.important !== b.important) return a.important
  const la = LAYERS.indexOf(a.layer)
  const lb = LAYERS.indexOf(b.layer)
  // Later layer wins for normal declarations; earlier layer wins for important
  // ones, and unlayered — last in LAYERS — flips from best to worst with it.
  if (la !== lb) return a.important ? la < lb : la > lb
  for (let k = 0; k < 3; k++) if (a.spec[k] !== b.spec[k]) return a.spec[k] > b.spec[k]
  return a.order > b.order
}

// The declaration a reader ends up with for `prop` on `target`, across every media
// context in the file. Media conditions are not evaluated: a rule inside
// `@media (max-width: 768px)` competes because a phone in high-contrast mode is a
// real reader, and the off switch must beat it there too.
function resolve(target, prop) {
  let best = null
  for (const r of rules) {
    const d = r.decls[prop]
    if (!d) continue
    for (const sel of r.selectors) {
      if (!competes(sel, target)) continue
      const cand = { ...d, layer: r.layer, order: r.order, spec: specificity(sel), sel, media: r.media }
      if (!best || wins(cand, best)) best = cand
    }
  }
  return best
}

const CONTRAST = '(prefers-contrast: more), (prefers-reduced-transparency: reduce)'
const isTexture = (v) => /textures\/|feTurbulence/.test(v)
const inContrast = (d) => !!d && d.media.some((m) => m.includes('prefers-contrast: more'))

// A surface is off when it is faded to nothing, or when its fill no longer names a
// tile. Both techniques are in use and both are correct: a ::before overlay can be
// faded, but a tile riding inside a `background-image` stack has no pseudo-element
// to fade and has to be replaced outright.
function offState(target) {
  const op = resolve(target, 'opacity')
  const bg = resolve(target, 'background-image')
  const faded = !!op && parseFloat(op.value) === 0
  const untiled = !!bg && !isTexture(bg.value)
  return { off: faded || untiled, op, bg, faded, untiled }
}

// ---------------------------------------------------------------------------

// Controls that carry a full accent FILL and therefore the ::before grain overlay,
// leather on paper and rubber on film.
//
// .btn-film is deliberately absent from this list and present in the off-switch one
// below: it is the film-aesthetic button, so it is rubber in BOTH aesthetics by
// definition rather than by branch. Asserting a paper branch for it would be
// asserting a bug.
const GRAIN_OVERLAY = ['.btn-sticker', '.tp-btn-primary', '.topbar-add-btn', '.user-chip']
// Surfaces whose grain rides inside background-image, so it cannot be faded by a
// pseudo-element and has to be replaced outright in the contrast block.
const LAYERED_FILL = ['.tp-toggle-thumb', '.tp-select-thumb', '.tp-filter-chip.active', '.drawer-item.active', '.mobile-bottom-nav-btn.active']

describe('the stylesheet parses into something worth resolving', () => {
  it('finds the contrast block, in a layer, and every declaration important', () => {
    const inside = rules.filter((r) => r.media.some((m) => m.includes('prefers-contrast: more')))
    expect(inside.length, 'the contrast block was not found').toBeGreaterThan(2)
    // Cascade placement is the whole fix. Important declarations in the earliest
    // layer beat every later layer AND every unlayered rule; a normal declaration
    // in `components` beats nothing that matters.
    const misplaced = inside.filter((r) => r.layer !== 'base')
    expect(misplaced.map((r) => r.selectors[0]), 'a contrast rule outside @layer base').toEqual([])
    const soft = []
    for (const r of inside) {
      for (const [prop, d] of Object.entries(r.decls)) {
        if (!d.important) soft.push(`${r.selectors[0]} { ${prop} }`)
      }
    }
    expect(soft, 'a contrast-mode declaration with no !important').toEqual([])
  })

  it('never smuggles a tile through the background shorthand', () => {
    // resolve() reads `background-image`, so a tile set through the `background`
    // shorthand would be invisible to every assertion below it.
    const smuggled = rules
      .filter((r) => r.decls.background && isTexture(r.decls.background.value))
      .map((r) => r.selectors[0])
    expect(smuggled, 'a texture set through the background shorthand').toEqual([])
  })
})

describe('accent-filled controls are textured', () => {
  // Two tests over all nine selectors rather than one per selector: within each
  // family the assertion is identical and only the selector changes, so the
  // collected list names every untextured control at once. The two families stay
  // APART because they assert different things — a ::before overlay against a
  // tile inside the fill — not different data.
  it('every accent fill gets the grain overlay in both aesthetics', () => {
    // fabric on paper, rubber on film — the two halves of the same rule.
    const missing = []
    for (const sel of GRAIN_OVERLAY) {
      const esc = sel.replace('.', '\\.')
      if (!new RegExp(`html\\[data-aesthetic="paper"\\]\\s*${esc}::before`).test(css)) missing.push(`${sel} paper grain`)
      if (!new RegExp(`html\\[data-aesthetic="film"\\]\\s*${esc}::before`).test(css)) missing.push(`${sel} film grain`)
    }
    expect(missing).toEqual([])
  })

  it('every layered surface carries a texture tile in its fill', () => {
    const missing = []
    for (const sel of LAYERED_FILL) {
      const esc = sel.replace(/\./g, '\\.')
      if (!new RegExp(`html\\[data-aesthetic="paper"\\][^{]*${esc}[^{]*\\{[^}]*fabric\\.webp`).test(css)) missing.push(`${sel} paper tile`)
      if (!new RegExp(`html\\[data-aesthetic="film"\\][^{]*${esc}[^{]*\\{[^}]*rubber\\.webp`).test(css)) missing.push(`${sel} film tile`)
    }
    expect(missing).toEqual([])
  })
})

describe('every texture is actually turned off, not merely mentioned', () => {
  // The list is DERIVED from the stylesheet rather than typed here, so a texture
  // added tomorrow to a surface nobody thought about is in scope the moment it
  // lands. That is the invariant the hand-written list could only approximate: it
  // asserted that ten names appeared in a block, and could say nothing at all
  // about an eleventh.
  const textured = [...new Set(
    rules.flatMap((r) => {
      const bg = r.decls['background-image']
      if (!bg || !isTexture(bg.value)) return []
      return r.selectors.map(rightmost)
    }),
  )].sort()

  it('found the textured surfaces to check', () => {
    expect(textured.length).toBeGreaterThan(8)
  })

  it('resolves to no visible texture for every one of them', () => {
    const on = []
    for (const t of textured) {
      const s = offState(t)
      if (!s.off) {
        const beat = s.op ? `opacity ${s.op.value} from \`${s.op.sel}\` (${s.op.layer || 'unlayered'})` : 'no opacity rule'
        on.push(`${t}: ${beat}`)
      }
    }
    expect(on, 'a texture still on screen for a reader who asked for more contrast').toEqual([])
  })

  it('lets the contrast block win, rather than merely contain the selector', () => {
    // The distinction this file exists for. Every surface the block names must
    // resolve THROUGH the block; a surface that happens to be off because some
    // other rule got there first is luck, not an off switch.
    const named = [...new Set(
      rules
        .filter((r) => r.media.some((m) => m.includes('prefers-contrast: more')))
        .flatMap((r) => r.selectors.map(rightmost)),
    )]
    const lost = []
    for (const t of named) {
      const s = offState(t)
      const byBlock = (s.faded && inContrast(s.op)) || (s.untiled && inContrast(s.bg))
      if (!byBlock) lost.push(`${t}: won by \`${(s.op || s.bg || {}).sel}\` in ${(s.op || s.bg || {}).layer || 'unlayered'}`)
    }
    expect(lost, 'the contrast block names a surface it does not win').toEqual([])
  })

  it('replaces layered fills rather than trying to fade them', () => {
    // The tile is inside background-image, so there is nothing to set opacity on.
    // The winning declaration must re-declare the stack WITHOUT a tile in it.
    for (const sel of LAYERED_FILL) {
      const bg = resolve(sel, 'background-image')
      expect(bg, `${sel} has no background-image at all`).not.toBeNull()
      expect(isTexture(bg.value), `${sel} still resolves to a texture tile`).toBe(false)
    }
  })
})

describe('a selected thing wears the selected material', () => {
  it('does not tint the mobile selections with a flat accent wash', () => {
    // What both of these used to be: `color-mix(in srgb, var(--accent) 13%, transparent)`.
    // It ignored the aesthetic entirely, so a phone showed the same rectangle on
    // paper and on film while every desktop selection wore grain.
    for (const sel of ['.drawer-item.active', '.mobile-bottom-nav-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      expect(at, `${sel} rule not found`).toBeGreaterThan(-1)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} is still a flat wash`).not.toMatch(/accent\)\s*13%/)
    }
  })

  it('rides its label on the ink meant for an accent fill', () => {
    for (const sel of ['.drawer-item.active', '.mobile-bottom-nav-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} label colour`).toContain('var(--on-accent)')
    }
  })

  it('keeps the drawer review dot visible on the selected row', () => {
    // accent-on-accent would be a waiting deck announcing itself in the one place
    // you cannot see it.
    expect(css).toMatch(/\.drawer-item\.active \.review-dot \{[^}]*var\(--on-accent\)/)
  })
})
