// Scroll stops at the thing you are scrolling.
//
// The bug: a wheel or a swipe that runs past the end of a popup carries on into
// the page behind it. Nothing throws, nothing looks broken while it happens —
// the page you cannot see moves under the dialog you are reading, and it is
// still moved when you close it, so you come back to somewhere you never
// navigated to.
//
// It is a bug of OMISSION, which is why the test is an invariant over the
// stylesheet rather than a case per popup. Every scroll container needs
// `overscroll-behavior`; the failure mode is not "someone wrote the wrong
// value", it is "someone adds `overflow-y: auto` next year and never thinks
// about chaining at all", and only a sweep catches that.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// Every rule block, as { selector, body }. A hand-rolled split rather than a
// parser: the file is nested only one level deep (@layer / @media around plain
// rules), and the blocks that matter never nest inside each other.
function rules() {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(CSS))) {
    const sel = m[1].split('\n').pop().trim()
    if (!sel || sel.startsWith('@')) continue
    out.push({ sel, body: m[2] })
  }
  return out
}

// A scroll container in the sense that matters: something the user can scroll
// and therefore something whose end can chain.
const SCROLLS = /overflow(-x|-y)?:\s*(auto|scroll)/
const CONTAINS = /overscroll-behavior(-x|-y)?:\s*(contain|none)/

// Scrollers that ARE the page. Nothing else is exempt — including the sideways
// ones, where chaining is the browser's back gesture and a trackpad swipe off
// the end of a wide table would navigate away from what you were reading.
const EXEMPT = ['html', 'body', ':root']

// ---- and the scroll containers the stylesheet cannot see ------------------
//
// A `className="… overflow-y-auto …"` is a scroll container the sweep above has
// no way to reach: the declaration is never written in `index.css` at all, it is
// assembled by the utility framework from a word in a JSX attribute. Nine of them
// exist across seven files, and the sweep's own header names this exact failure —
// "someone adds `overflow-y: auto` next year and never thinks about chaining" —
// which is precisely what typing the word into a className does.
//
// THE RULE IS THE SAME RULE, so the answer is not a second list of exceptions: an
// element that scrolls must ALSO carry something that contains the scroll. That
// can be a utility (`overscroll-contain`) or one of this app's own classes whose
// stylesheet rule sets `overscroll-behavior` — which is how all nine currently
// pass, every one of them wearing `.tp-scrim`. Resolving it through the stylesheet
// rather than naming `.tp-scrim` is what keeps this honest: rename the class or
// drop the property from it and this fails, where a hard-coded allowance would
// not.
const OVERFLOW_UTIL = /\boverflow(-[xy])?-(auto|scroll)\b/
const CONTAIN_UTIL = /\boverscroll-(contain|none)\b/

// Every class the stylesheet gives an `overscroll-behavior`, from the same parse
// the sweep above uses. A selector like `.a, .b` contributes both.
function containingClasses() {
  const out = new Set()
  for (const r of rules()) {
    if (!CONTAINS.test(r.body)) continue
    for (const m of r.sel.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(m[1])
  }
  return out
}

// EVERY CLASS LIST, WHEREVER IT IS WRITTEN — a `className="…"` on an element, or
// a shared constant like ui.jsx's `SCRIM`. The first draft looked only at
// `className="…"` and went blind the day nine of those literals moved into one
// exported constant: it found nothing and said so, which is the one thing the
// "there are some" case above is for. A class list is a quoted string containing
// an overflow utility, and it does not matter which side of an `=` it sits on.
function classListsWithOverflow() {
  const out = []
  const files = readdirSync(SRC).filter((f) => f.endsWith('.jsx') || f.endsWith('.js'))
  for (const file of files) {
    const text = readFileSync(join(SRC, file), 'utf8')
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
        if (!OVERFLOW_UTIL.test(m[1])) continue
        out.push({ where: `${file}:${i + 1}`, classes: m[1].split(/\s+/).filter(Boolean) })
      }
    })
  }
  return out
}

describe('a scroll container written as a utility class', () => {
  const found = classListsWithOverflow()

  it('there are some, so this test is testing something', () => {
    // ONE, AND THAT IS THE POINT OF IT BEING ONE. Nine files wrote this class
    // list out in full until they were folded into ui.jsx's `SCRIM` /
    // `SCRIM_CENTERED`; the sweep follows the constant, so the number it finds
    // fell from nine to one WITHOUT the coverage falling — every overlay still
    // wears the list this checks. What the case guards is the extraction itself:
    // a regex that stops matching reports zero and asserts nothing about it.
    expect(found.length, 'the extraction found no utility scrollers at all').toBeGreaterThan(0)
  })

  it('and the shared one is what the overlays actually wear', () => {
    // The count above can only stay honest while the constant is the thing the
    // overlays use. `nested-dismiss.test.jsx` keeps the roll of who draws a
    // scrim; this is the other half — that the roll's members take the class
    // from here rather than writing their own.
    const ui = readFileSync(join(SRC, 'ui.jsx'), 'utf8')
    expect(ui, 'ui.jsx no longer exports a shared scrim class').toMatch(/export const SCRIM\b/)
    const users = readdirSync(SRC)
      .filter((f) => f.endsWith('.jsx') && f !== 'ui.jsx')
      .filter((f) => /\bSCRIM(_CENTERED)?\b/.test(readFileSync(join(SRC, f), 'utf8')))
    expect(users.length, 'no screen takes the scrim from ui.jsx — they have gone back to their own')
      .toBeGreaterThan(3)
  })

  it('stops its scroll at its own edge too', () => {
    const contains = containingClasses()
    const chaining = found
      .filter(({ classes }) => !classes.some((c) => CONTAIN_UTIL.test(c) || contains.has(c)))
      .map(({ where }) => where)
    expect(chaining, 'these scroll the page behind them').toEqual([])
  })
})

describe('every scroll container', () => {
  const scrollers = rules().filter((r) => SCROLLS.test(r.body) && !EXEMPT.includes(r.sel))

  it('there are some, so this test is testing something', () => {
    // The sweep's own failure mode: a regex that stops matching and quietly
    // asserts nothing about an empty list.
    expect(scrollers.length).toBeGreaterThan(5)
  })

  it('stops its scroll at its own edge', () => {
    const chaining = scrollers.filter((r) => !CONTAINS.test(r.body)).map((r) => r.sel)
    expect(chaining, 'these scroll the page behind them').toEqual([])
  })
})

describe('the overlay scrim', () => {
  it('contains scroll for every dialog at once', () => {
    // .tp-scrim is on eleven full-viewport overlays, each of which is its own
    // scroll container. One rule is the difference between fixing this and
    // fixing it eleven times and missing the twelfth.
    const scrim = rules().find((r) => r.sel === '.tp-scrim')
    expect(scrim, '.tp-scrim rule').toBeTruthy()
    expect(scrim.body).toMatch(CONTAINS)
  })
})
