// A SUPPLIER'S MARK IS EITHER A FILL WITH A SHAPE CUT OUT OF IT, OR A GLYPH IN A
// BOX — AND THE TWO NEED OPPOSITE THINGS FROM THE SAME STYLESHEET.
//
// TWO OWNER REPORTS, ONE STYLESHEET, AND THE FIX FOR EACH BROKE THE OTHER:
//
//   "the provider icons are not visible at all" — seven Metadata rows drew a flat
//   beige rounded square. `.src-mark` painted `background-color: currentColor`
//   left over from a mask design, and the component in that box now puts an
//   inline `<svg>` inside it, so the fill covered the glyph.
//
//   "why did you remove the provider icons from the links section" — the fill was
//   deleted to fix the first report, on the stated grounds that nothing set
//   `mask-image` any more. Something did: the OTHER component on that class sets
//   one inline and draws no child, so it is only visible when the box is filled.
//   Every links pill, ids row and field-source tag in the app went blank.
//
// AND THE FIRST VERSION OF THIS FILE PASSED BOTH TIMES. Its invariant was "IF this
// class paints a background, a mask must be cutting a shape out of it" — which a
// class that paints NOTHING satisfies, so it blessed the second regression while
// being written to prevent the first.
//
// SO THE INVARIANT IS TWO-SIDED AND READ FROM THE COMPONENTS, not from a class
// name this file remembers. Whichever class the child-less mark renderer uses must
// be filled and must size its mask; whichever class the glyph renderer uses must
// not be filled. Rename either class and the guard follows it; swap their classes
// and it fails.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
// COMMENTS STRIPPED FIRST, because this stylesheet explains itself at length and
// the prose names the very classes being matched — a selector capture that ran
// over a comment mentioning `.src-mark` attributed the next rule to it, which is
// how the first run of this guard reported the mask rule as an offender against
// the glyph box it has nothing to do with.
const css = readFileSync(join(src, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
const ui = readFileSync(join(src, 'ui.jsx'), 'utf8')

// One function's own text, from its declaration to the next top-level one.
//
// NOT A FIXED NUMBER OF CHARACTERS, which this read first: `ui.slice(at, at + 2600)`
// held the whole of both functions until a comment was added to one of them, and
// then the code the guard was looking for fell off the end of the window. Two cases
// went from asserting something to asserting nothing found — silently, because
// "no className here" is indistinguishable from "no offending className here".
// A guard whose reach depends on how much prose sits above the code is a guard
// that expires without saying so.
const bodyOf = (fn) => {
  const at = ui.indexOf(`export function ${fn}(`)
  if (at < 0) return null
  const rest = ui.slice(at + 1)
  const next = rest.search(/\n(?:export )?function [A-Za-z]/)
  return next < 0 ? rest : rest.slice(0, next)
}

// The class names a component hands its own span, read out of the component.
// Whatever follows `className=` — a plain string, or an expression concatenating
// several — every literal in it is a class the span can carry, so all of them are
// pulled out and split. That is why neither class name appears in this file.
const classesOf = (fn) => {
  const body = bodyOf(fn)
  if (body === null) return null
  const m = body.match(/className=("[^"]*"|\{[^}]*\})/)
  if (!m) return null
  const literals = [...m[1].matchAll(/["'`]([^"'`]*)["'`]/g)].map((q) => q[1])
  const names = literals
    .join(' ')
    // A `${...}` slot inside a template is a class chosen at render time; the
    // prefix before it is still a literal and is kept.
    .replace(/\$\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return names.length ? [...new Set(names)] : null
}

// Whether the renderer puts anything INSIDE its span. That is the fact that
// decides which contract it needs, and it is why neither class name is hardcoded.
const hasChild = (fn) => /<Icon\s*\/>|\{children\}/.test(bodyOf(fn) || '')

// Every declaration block whose selector names exactly this class — `.src-mark`
// must not match `.src-mark-img`, which is the whole point of there being two.
const blocksFor = (cls) => {
  const out = []
  const re = new RegExp(`([^{}]*\\.${cls}(?![\\w-])[^{}]*)\\{([^}]*)\\}`, 'g')
  for (const m of css.matchAll(re)) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}

const paints = (b) => /background(-color)?\s*:\s*(?!none|transparent|0\b)/.test(b.body)

describe('the two things that draw a supplier', () => {
  it('are both still here, and only one of them has a child', () => {
    // A renamed or deleted component silently takes its half of the guard with it.
    expect(classesOf('ProviderMark'), 'ProviderMark no longer sets a className').toBeTruthy()
    expect(classesOf('SourceIcon'), 'SourceIcon no longer sets a className').toBeTruthy()
    expect(hasChild('ProviderMark'), 'ProviderMark draws a child now — it is not a mask any more').toBe(false)
    expect(hasChild('SourceIcon'), 'SourceIcon draws no glyph inside its box').toBe(true)
  })

  it('give the child-less mark a box that is actually filled', () => {
    // NO FILL, NO PICTURE. The span has no child, so the fill is the ink and the
    // mask is the shape. This is the case that was live and invisible for a day.
    const classes = classesOf('ProviderMark')
    const filled = classes.some((c) => blocksFor(c).some(paints))
    expect(filled, `none of ${classes.join('.')} paints a background — a mask with nothing to cut is an empty box`)
      .toBe(true)
  })

  it('and size that mask, so a mark is neither stretched nor tiled', () => {
    const classes = classesOf('ProviderMark')
    const bodies = classes.flatMap((c) => blocksFor(c)).map((b) => b.body).join('\n')
    // UNPREFIXED, and the lookbehind is the whole assertion. Written without it
    // this case passed on `-webkit-mask-repeat` alone — the substring match hit
    // the prefixed property — so deleting the standard declaration, which is the
    // one every current browser reads, changed nothing here.
    expect(bodies, 'the mask has no size — it defaults to the image’s own and crops or tiles')
      .toMatch(/(?<![\w-])mask-size\s*:/)
    expect(bodies, 'the mask repeats — one mark drawn several times in its own box')
      .toMatch(/(?<![\w-])mask-repeat\s*:\s*no-repeat/)
  })

  it('and leave the box holding a glyph unfilled', () => {
    // THE OTHER HALF, and the report that came first. A fill here is a solid
    // block over the `<svg>` inside it.
    const classes = classesOf('SourceIcon')
    const offenders = classes
      .flatMap((c) => blocksFor(c))
      .filter(paints)
      .map((b) => b.selector)
    expect(offenders, 'a rule fills the box SourceIcon puts a glyph in — that is a solid square over the icon')
      .toEqual([])
  })

  it('and both share a box that lays its contents out', () => {
    const shared = blocksFor('src-mark').find((b) => /display\s*:/.test(b.body))
    expect(shared, '.src-mark declares no display at all').toBeTruthy()
    expect(shared.body, '.src-mark no longer lays out what is inside it')
      .toMatch(/display\s*:\s*inline-flex/)
  })
})
