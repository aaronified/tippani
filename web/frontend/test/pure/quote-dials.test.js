// THE QUOTE'S TWO READING DIALS — leading and measure (§6 access).
//
// WHAT THEY ARE FOR. docs/plans/access.md's argument, which is the reason measure
// is here at all: "line length is the single largest readability lever in a body
// of prose and the one no app offers". The paper and film looks are deliberately
// generous with width — right for reading a card, and exactly what somebody with
// low vision needs to be able to narrow.
//
// THE ONE THING THIS FILE IS REALLY FOR is the promise that a reader who never
// opens either dial sees what the app has always drawn. A reading-comfort control
// that quietly restyles everybody's library on upgrade is worse than no control,
// so "the zero value renders as before" is asserted first and from both ends: the
// token JS writes, and the value the stylesheet already carried.
//
// AND THE SERVER HAS ITS OWN COPY OF BOTH LISTS, because prefs is a Go struct and
// the endpoint has to refuse a value the client cannot draw. Two lists mean two
// chances to drift, so the last block below — "the server's copy of the two
// lists" — reads font_prefs.go and compares. (Named rather than numbered: this
// line said "the third block" and it was the fourth on the day it was written,
// which is the repo's own lesson about counting in prose.)
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  QUOTE_LEADINGS,
  QUOTE_LEADING_DEFAULT,
  QUOTE_MEASURES,
  QUOTE_MEASURE_DEFAULT,
  clampLeading,
  clampMeasure,
  quoteTokens,
  typeTokens,
} from '../../src/type.js'
import { QUOTE_TEXT } from '../../src/fonts.js'
import { SRC } from '../src-files.js'

const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')
const GO = readFileSync(join(SRC, '..', '..', '..', 'internal', 'httpapi', 'font_prefs.go'), 'utf8')

// The list as the Go file spells it: `var <name> = []int{...}`.
function goList(name) {
  const m = GO.match(new RegExp(`var ${name} = \\[\\]int\\{([^}]*)\\}`))
  return m ? m[1].split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)) : null
}

describe('a reader who never opens either dial', () => {
  it('gets the leading the stylesheet has always drawn', () => {
    // BOTH ENDS. The token JS writes for an untouched account, and the value
    // sitting on :root for the moment before JS has written anything — a page
    // that flashed one leading and settled on another would be this change
    // shipping a visible bug to everybody who changed nothing.
    expect(quoteTokens({})['--quote-leading']).toBe('1.55')
    expect(CSS, 'index.css no longer carries the leading JS falls back to')
      .toContain('--quote-leading: 1.55;')
    expect(QUOTE_LEADING_DEFAULT / 100).toBe(1.55)
  })

  it('gets no measure at all, which is what every screen drew before', () => {
    expect(quoteTokens({})['--quote-measure']).toBe('none')
    expect(CSS, 'index.css no longer carries the unset measure').toContain('--quote-measure: none;')
    expect(QUOTE_MEASURE_DEFAULT).toBe(0)
  })

  it('and an account that predates the dials reads as unset, not as broken', () => {
    // The zero value of the Go struct — which is what every existing account
    // stores — and the empty object a client has before the first load.
    for (const prefs of [{}, { quoteLeading: 0, quoteMeasure: 0 }, null, undefined]) {
      expect(quoteTokens(prefs)).toEqual({ '--quote-leading': '1.55', '--quote-measure': 'none' })
    }
  })
})

describe('the dials themselves', () => {
  it('write a ratio and a length in characters', () => {
    expect(quoteTokens({ quoteLeading: 190, quoteMeasure: 66 }))
      .toEqual({ '--quote-leading': '1.9', '--quote-measure': '66ch' })
  })

  it('measure a column of text in ch and never in px', () => {
    // The repo's own rule: "No box that holds text is measured in px — em, ch, or
    // a share of its container." A measure is counted in characters of the face
    // actually drawing them, which is also the unit the 45–75 rule is stated in,
    // so `ch` is the requirement rather than a preference.
    for (const n of QUOTE_MEASURES.filter(Boolean)) {
      expect(quoteTokens({ quoteMeasure: n })['--quote-measure']).toBe(`${n}ch`)
    }
  })

  it('fall to the DEFAULT on a value they do not have, not to the nearest step', () => {
    // clampFactor's reasoning, one file up: a preference written by a newer client
    // must render at the designed setting rather than at a half-understood
    // approximation of somebody's.
    for (const bad of [137, 1.55, '2', -1, NaN, null, undefined, 'loose']) {
      expect(clampLeading(bad), `leading ${String(bad)}`).toBe(QUOTE_LEADING_DEFAULT)
      expect(clampMeasure(bad), `measure ${String(bad)}`).toBe(QUOTE_MEASURE_DEFAULT)
    }
  })

  it('keep every value they do have', () => {
    for (const n of QUOTE_LEADINGS) expect(clampLeading(n)).toBe(n)
    for (const n of QUOTE_MEASURES) expect(clampMeasure(n)).toBe(n)
  })

  it('stay out of the size scale, which is a closed set', () => {
    // typescale.test.js asserts typeTokens holds one token per step per role and
    // NOTHING ELSE. Folding these two in there would have broken that guard, or
    // worse, loosened it.
    const names = Object.keys(typeTokens({})).join(' ')
    expect(names).not.toMatch(/quote/)
  })
})

describe('the quote slots read them', () => {
  it('QUOTE_TEXT carries both, so every inline slot answers both dials', () => {
    expect(QUOTE_TEXT.lineHeight).toBe('var(--quote-leading)')
    expect(QUOTE_TEXT.maxWidth).toBe('var(--quote-measure)')
  })
})

describe('the server’s copy of the two lists', () => {
  // A closed set the client draws and the server refuses has to be ONE set. It is
  // written twice because one side is Go and the other is JavaScript, so this is
  // the seam where the second copy is checked rather than trusted.
  it('accepts every step the client can draw', () => {
    expect(goList('quoteLeadings'), 'font_prefs.go no longer spells quoteLeadings the way this reads').toBeTruthy()
    expect(goList('quoteMeasures'), 'font_prefs.go no longer spells quoteMeasures the way this reads').toBeTruthy()
    for (const n of QUOTE_LEADINGS) expect(goList('quoteLeadings'), `leading ${n}`).toContain(n)
    for (const n of QUOTE_MEASURES) expect(goList('quoteMeasures'), `measure ${n}`).toContain(n)
  })

  it('and offers exactly one thing the client does not: 0, which is “not chosen”', () => {
    // The asymmetry is deliberate and is the only one allowed. The server must
    // accept 0 — it is the zero value of the struct and how a reader clears a
    // dial — while the picker never offers it for LEADING, because "not chosen"
    // and "Normal" draw the same page and a list with both in it would ask the
    // reader to tell apart two identical options. Measure is different: there 0 is
    // "full width", a real answer, so it IS offered.
    expect(goList('quoteLeadings').filter((n) => !QUOTE_LEADINGS.includes(n))).toEqual([0])
    expect(goList('quoteMeasures').filter((n) => !QUOTE_MEASURES.includes(n))).toEqual([])
    expect(QUOTE_MEASURES, 'full width is a real answer and the picker has to offer it').toContain(0)
  })
})
