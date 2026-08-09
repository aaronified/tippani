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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

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
