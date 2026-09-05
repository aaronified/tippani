// EVERY HEADER IS LEFT-ALIGNED, AND THE EXCEPTIONS ARE NAMED HERE.
//
// THE RULE, the owner's, after the third report of the same thing: "all headers
// need left alignment barring very specific and rare exceptions." A centred
// title is the one that looks deliberate and is not — nothing on the screen
// tells a reader whether the app meant to centre it, so it drifts one screen at
// a time and only a rendered page shows it.
//
// WHY IT MATTERS ON A PANEL IN PARTICULAR. `character-popup.dc.html:33` sets the
// header as one block: the work's cover, the medium glyph laid OVER it in the
// slot a back key would otherwise hold, then the name with its crumb beneath —
// starting where the cover ends. Drawn centred instead, the name floats in the
// middle of the bar with a gap on its left, wraps inside the third of the bar it
// was left, and reads as a caption for the thumbnail rather than as the screen's
// own name. The owner: "it is not left aligned right beside the cover image,
// rather middle aligned, AGAINST THE PROTOTYPE DESIGN. Nobody gave you the
// permission to deviate from the prototype for such frivolous things."
//
// THIS IS A SWEEP, NOT A CASE. A test for the one header that was reported would
// pass the day it was written and say nothing about the next one. It reads the
// stylesheet and reports EVERY heading rule that centres itself; a genuinely
// centred header adds itself to EXCEPTIONS below with a sentence, in a review
// where somebody has to read the sentence.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ScreenHead } from '../../src/characterRows.jsx'
import { resolveOn, rules } from '../css-cascade.js'

afterEach(() => cleanup())

// What counts as a header: the classes this app names its titles and heading
// bars with. Matched on the selector's own words, so a new one is caught by the
// convention it was named under rather than by being listed here.
const HEADER = /(^|[.\s-])(head|header|title|heading|crumb|wordmark|section|legend)([-\s.:[]|$)/i

// THE EXCEPTIONS, each with the reason it is one. A centred thing here is
// centred BECAUSE OF ITS OWN GEOMETRY — it is alone in a box it fills — not
// because a designer liked it there.
const EXCEPTIONS = [
  // A dialog is a small card the reader is asked a question in; its title sits
  // over a body that is itself centred, and there is no cover or back key beside
  // it for a left edge to line up with. The pack draws it centred
  // (`book-detail.dc.html:566`, the alertdialog's own head).
  { match: /alertdialog|confirm/i, why: 'a question card centres its own title — the pack does too' },
  // An empty state is one block centred in the space where rows would be; its
  // heading is part of that block and cannot be aligned to rows that are absent.
  { match: /empty/i, why: 'an empty state is one centred block, heading included' },
  // The unscoped panel title, which is centred ON THE BOX between two equal
  // 44px slots — the case the scoped header is the exception to, not the rule.
  // Guarded separately below.
  { match: /^\.tp-panel-title$/, why: 'the unscoped panel head centres between two equal key slots' },
]

function centredHeaders() {
  const out = []
  for (const r of rules) {
    const centred = r.decls && r.decls['text-align']
    if (!centred || !/center/i.test(String(centred.value))) continue
    for (const sel of r.selectors) {
      if (!HEADER.test(sel)) continue
      if (EXCEPTIONS.some((e) => e.match.test(sel))) continue
      out.push(`${sel} { text-align: ${String(centred.value).trim()} }`)
    }
  }
  return out
}

describe('header hygiene', () => {
  it('centres no heading the exceptions do not name', () => {
    const found = centredHeaders()
    expect(found, 'these headers are centred and nothing says why:\n  ' + found.join('\n  '))
      .toEqual([])
  })

  it('and there is something to sweep, so this is not passing on an empty read', () => {
    // The extraction's own failure mode: a parser that returned nothing would
    // report zero centred headers and mean nothing at all.
    const headers = rules.flatMap((r) => r.selectors).filter((s) => HEADER.test(s))
    expect(headers.length, 'no header rules found at all — the stylesheet did not parse')
      .toBeGreaterThan(20)
  })

  it('and every exception carries its reason', () => {
    for (const e of EXCEPTIONS) {
      expect(e.why, `${e.match} is exempt with no reason given`).toBeTruthy()
      expect(e.why.length, `${e.match}'s reason is too short to be one`).toBeGreaterThan(20)
    }
  })
})

// ---- and the panel header the pack actually draws ---------------------------

describe('a panel header that names a record', () => {
  it('sets the name and its crumb as one block', () => {
    render(<ScreenHead title="Delia Surridge" crumb="in V for Vendetta" art="poster.jpg" artKind="movie" glyph={<svg />} />)
    const names = document.querySelector('.cs-head-names')
    expect(names, 'the name and the crumb are not one block').toBeTruthy()
    expect(names.textContent).toContain('Delia Surridge')
    expect(names.textContent).toContain('in V for Vendetta')
  })

  it('starts that block where the cover ends, rather than centring it on the bar', () => {
    // A header slot that GROWS (`flex: 1 1 0`) takes a third of the bar and
    // pushes the name to the middle; a slot sized to its own 44px control leaves
    // the name against the cover. jsdom has no layout, so the declaration that
    // decides it is what can be read here — the probe measures the pixels.
    const grow = resolveOn('.tp-panel-head.has-scope .tp-panel-slot', 'flex')
    expect(grow && String(grow.value).trim(),
      'the header slots still grow, which centres the name on the bar').toMatch(/^0 0\b/)
    expect(String(resolveOn('.tp-panel-title.is-scoped', 'text-align')?.value || '').trim(),
      'a centred title over a 32px thumbnail reads as its caption').toBe('left')
  })

  it('and lets the name shrink, because a box that cannot shrink cannot scroll', () => {
    // The name never truncates — the standing rule — so the box scrolls under a
    // fade. `overflow-x: auto` does nothing on a flex item that refuses to be
    // narrower than its content: it runs out of the head instead.
    const f = String(resolveOn('.tp-panel-title.is-scoped', 'flex')?.value || '').trim()
    expect(f, 'the title is fixed at its content width, so a long name leaves the head')
      .not.toMatch(/^(none|0 0\b)/)
  })
})

// ---- the medium glyph is ON the cover ---------------------------------------

describe('the medium glyph in a panel header', () => {
  it('is drawn inside the artwork, not beside it', () => {
    render(<ScreenHead title="Delia Surridge" crumb="in V for Vendetta" art="poster.jpg" artKind="movie" glyph={<svg />} />)
    const art = document.querySelector('.cs-scope-art')
    const badge = document.querySelector('.cs-scope-overlay')
    expect(art, 'the head drew no artwork at all').toBeTruthy()
    expect(badge, 'the head drew no medium glyph').toBeTruthy()
    expect(art.contains(badge), 'the glyph is a sibling of the cover, so it cannot be over it').toBe(true)
  })

  it('and is taken out of the flow, so it lies ON the cover rather than sharing its row', () => {
    // `.cs-scope-art` is a flex container, and an in-flow child of a flex
    // container is a flex ITEM — laid out BESIDE its siblings. That one word is
    // the whole of a defect reported three times.
    expect(String(resolveOn('.cs-scope-art', 'display')?.value || '').trim(),
      'the artwork is not the flex box this rule is about').toBe('flex')
    expect(String(resolveOn('.cs-scope-overlay', 'position')?.value || '').trim(),
      'an in-flow child of a flex box is laid out beside the cover, not on it').toBe('absolute')
    expect(String(resolveOn('.cs-scope-art', 'position')?.value || '').trim(),
      'the badge is positioned against the page instead of against the cover').toBe('relative')
  })
})
