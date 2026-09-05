// A CASCADE RESOLVER FOR THE TESTS THAT ASK WHAT A READER ACTUALLY SEES.
//
// WHY THIS IS A MODULE AND NOT A REGEX IN EACH FILE. A stylesheet read as prose
// answers "does this text appear", and that is a different question from "does
// this rule win". `accent-texture.test.jsx`'s own header records what the
// difference cost: a `prefers-contrast: more` block whose declarations were
// `!important` inside `@layer base`, which loses to every unlayered declaration
// however specific it was — "a reader who asked their operating system for more
// contrast got the grain anyway, and a green test said otherwise".
//
// AND WHY IT MOVED HERE. Three other suites assert stylesheet facts by matching
// exact bytes — `\{ width: 44px; \}` with its spaces, a selector pair with the
// newline between them — and the repo's audit lists all four together (§2.2): "The
// *value* is what matters." Reformatting the stylesheet, which changes nothing a
// reader can see, turned three of those red; a value they were never checking
// could change and leave them green. This module is what they check the value
// with, and one copy of it is one place the layer order has to be right.
//
// The audit said three of the four "already own a cascade resolver". They did not:
// exactly one did, and this is it, moved out of it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const CSS_TEXT = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

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
// AND THE TARGET IS REDUCED THE SAME WAY, which it was not. `simples(target)` on
// a DESCENDANT target — `.drawer-item.active .review-dot` — pooled the ancestor's
// classes in with the element's, so `.drawer-item.active` "competed" for the dot's
// background and won it: the resolver answered with the ROW's fill when asked
// about the dot sitting on it. Every target this started life with was a single
// compound, where the two readings coincide, so nothing showed it.
function competes(sel, target) {
  const mine = simples(rightmost(sel))
  const theirs = simples(rightmost(target))
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
//
// `skipContrast` is how a caller asks the OTHER question. The off switch is
// `!important` in the first layer, so it wins every resolution it takes part in —
// which is the point, and which would make "is this surface textured at all?"
// unanswerable, because the answer would always be the stripped value. Excluding
// that one block resolves the ordinary reader's screen; including it resolves the
// screen of a reader who asked for more contrast. Both are real and they are
// different questions.
// `without` is a substring or RegExp naming media conditions that are NOT in
// force — the way to ask what a phone sees, where `@media (hover: hover)` simply
// does not apply. Without it a resolver answers for a desktop and a suite about
// touch is asking the wrong machine.
function resolve(target, prop, { skipContrast = false, without = null } = {}) {
  const excluded = (m) => (without instanceof RegExp ? without.test(m) : without && m.includes(without))
  let best = null
  for (const r of rules) {
    const d = r.decls[prop]
    if (!d) continue
    if (without && r.media.some(excluded)) continue
    if (skipContrast && r.media.some((m) => m.includes('prefers-contrast: more'))) continue
    for (const sel of r.selectors) {
      if (!competes(sel, target)) continue
      const cand = { ...d, layer: r.layer, order: r.order, spec: specificity(sel), sel, media: r.media }
      if (!best || wins(cand, best)) best = cand
    }
  }
  return best
}


// ---- what the suites reach for ---------------------------------------------

const rules = parse(stripComments(CSS_TEXT))

// resolveOn — the winning declaration of `prop` for an element matching `target`,
// as { value, important, layer, order, spec, sel, media }, or null when nothing
// declares it. `skipContrast` leaves the `prefers-contrast: more` overrides out,
// for the suites asking what the ordinary reader sees.
export function resolveOn(target, prop, opts = {}) {
  return resolve(target, prop, opts)
}

// valueOf — the same thing, trimmed to the value, which is what most assertions
// want: `expect(valueOf('.tp-filter-chip.has-btn-icon', 'width')).toBe('44px')`.
export function valueOf(target, prop, opts = {}) {
  const d = resolveOn(target, prop, opts)
  return d ? String(d.value).trim() : null
}

// declaredIn — every rule whose selector list contains `sel` EXACTLY, with its
// declarations. For the handful of assertions that are about a rule rather than
// about an element: "these two selectors share one block", "this rule is inside a
// hover query". Whitespace and comment formatting cannot reach it.
export function declaredIn(sel, { media } = {}) {
  return rules.filter((r) => r.selectors.some((s) => s.replace(/\s+/g, ' ').trim() === sel.replace(/\s+/g, ' ').trim())
    && (!media || r.media.some((m) => m.includes(media))))
}

// mediaOf — which media queries a rule for `sel` sits inside, flattened. Answers
// "is this behind a hover query" without knowing how the block is written.
export function mediaOf(sel, prop) {
  const d = resolveOn(sel, prop)
  return d ? d.media : []
}

export { parse, specificity, stripComments, rules, rightmost, competes, splitList }
