// ONE CARD FACE, AND IT IS .hand-card's.
//
// Twice in one release a card drew its own copy of the card's gradient instead of
// being a .hand-card: the phone's section index cards (no material at all — the
// tile and the dither live in .hand-card's ::before and ::after) and .pref-group
// (a shade off in dark, 7%/9% against 8%/10%). Both looked almost right, which is
// exactly why nobody saw them until the owner put one beside a quote card.
//
// So the card gradient — `color-mix(in srgb, var(--card), white N%)` over the card
// ground — may appear only in .hand-card's own rules and on the named surfaces
// below, which are not cards: a panel and two sheets draw the same paper on purpose.
// A new rule that wants the card's face adds the class, not the gradient.
//
// A source scanner, not a test: it reads the stylesheet.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(__dirname, '../../src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Not cards, and the reason each draws the paper itself.
const ALLOWED = [
  /\.hand-card\b/, // the face itself
  /\.tp-panel\b/, // a side panel: a surface over the page, not a card on it
  /\.tp-subsheet\b/, // a panel's child sheet, the same surface one step in
  /\.mobile-sheet-card\b/, // the phone's bottom sheet
  /\.film-frame\b/, // the film strip around sign-in and onboarding: it takes the material in .hand-card's own ::before rule
  // A STATE, NOT AN ELEMENT: the console toolbar and the section rail become a card
  // only while stuck, and .hand-card's position and border would fight their sticky
  // ring. They may copy the face only exactly — the test below holds each to
  // .hand-card's. Named, not `.is-stuck` at large: anything else that sticks and
  // wants the face is a new case to name here.
  /\.console-toolbar\.is-stuck\b/,
  /\.meta-rail-row\.is-stuck\b/,
]

// ONE SELECTOR AT A TIME. A rule's selector list is split before it is judged, so
// a stray cannot ride in on an allowed neighbour: `.film-frame, .stray-card { … }`
// is two selectors, and only one of them is allowed. Commas inside parentheses —
// `:is(a, b)`, `:not(a, b)` — belong to one selector and are not split.
const selectorsOf = (list) => {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const gradientsOf = (css, selectorRe) => {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    if (!selectorRe.test(m[1])) continue
    const g = /background:\s*(linear-gradient\([^;]*var\(--card\), white[^;]*);/.exec(m[2])
    if (g) out.push([/data-theme="dark"/.test(m[1]) ? 'dark' : 'light', g[1].replace(/\s+/g, ' ')])
  }
  return out
}

function rulesWithCardGradient(css) {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css))) {
    const [, selector, body] = m
    if (/color-mix\(in srgb, var\(--card\), white \d+%\)/.test(body)) {
      for (const one of selectorsOf(selector.replace(/\s+/g, ' '))) out.push(one)
    }
  }
  return out
}

describe('the card face', () => {
  it('is drawn by .hand-card and the named non-card surfaces only', () => {
    const found = rulesWithCardGradient(CSS)
    expect(found.length, 'the sweep found no card gradient at all, so it is looking for the wrong thing').toBeGreaterThan(0)
    const strays = found.filter((sel) => !ALLOWED.some((a) => a.test(sel)))
    expect(strays, 'these rules draw their own copy of the card face; give the element .hand-card instead').toEqual([])
  })

  it('is copied exactly where a state has to copy it', () => {
    const card = Object.fromEntries(gradientsOf(CSS, /^\s*html(\[data-theme="dark"\])? \.hand-card\s*$/))
    expect(card.light && card.dark, 'the card face itself was not found').toBeTruthy()
    for (const [name, re] of [['toolbar', /\.console-toolbar\.is-stuck/], ['section rail', /\.meta-rail-row\.is-stuck/]]) {
      const stuck = gradientsOf(CSS, re)
      expect(stuck.length, `the stuck ${name} draws no face at all`).toBeGreaterThan(0)
      for (const [theme, g] of stuck) expect(g, `the stuck ${name}'s ${theme} face drifted from the card's`).toBe(card[theme])
    }
  })
})
