// A SUPERLATIVE'S NAME STAYS INSIDE ITS TILE.
//
// THE REPORT: the Stats superlatives overlap each other and spill out of their
// boxes. Not an ellipsis problem — this app never truncates a name — a SHRINKING
// problem. `.name-scroll` is the app's answer to a long name: it declares
// `min-width: 0`, `max-width: 100%` and `overflow-x: auto` on itself, and scrolls
// under a measured fade.
//
// AND DECLARING IT ON ITSELF IS NOT ENOUGH, which is the whole of this file. A
// box can only be narrower than its text if EVERY ancestor between it and the
// thing setting the width agrees to be narrower than ITS content — and a flex
// item's default `min-width` is `auto`, which refuses. One box in that chain
// without the signal pins the scroller open at the full width of the name, the
// scroller has nothing to scroll, and the name runs out of the tile and over the
// one beside it.
//
// The tile's chain was: the column (min-w-0), the baseline row (minWidth: 0), the
// Tooltip (min-w-0, which lands on .tp-tip-wrap) — and then a <button> with
// neither. Four boxes, three of them right, and the screen looked broken.
//
// WHY THE CHAIN AND NOT THE PIXELS. jsdom has no layout, so no assertion here can
// measure an overflow; and a case that only asserted the button's own classes
// would go green the day somebody wraps the name in one more <span>. Walking the
// chain is the invariant that actually holds: whatever the markup becomes, every
// box from the name up to the tile must be able to shrink.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

const { NameDoor, SuperTile } = await import('../../src/StatsPage.jsx')
const { readSource } = await import('../src-files.js')

// A real one, and long: the name that put this rule in the repo.
const LONG = 'Bibhutibhushan Bandyopadhyay'

// Whether this element has told the layout it may be narrower than its content.
// Either spelling counts — the tile uses both, and so does the rest of the app.
const canShrink = (el) =>
  el.classList.contains('min-w-0') ||
  el.style.minWidth === '0' ||
  el.style.minWidth === '0px' ||
  el.classList.contains('name-scroll') // declares it in the stylesheet

// Every box between the name and the tile, innermost first.
const chain = (root) => {
  const out = []
  let el = root.querySelector('.name-scroll')
  while (el && el !== root.parentElement) {
    out.push(el)
    el = el.parentElement
  }
  return out
}

describe('a superlative that is a doorway', () => {
  it('lets every box between the name and the tile shrink', () => {
    const { container } = render(
      <SuperTile label="Most quoted" title={LONG} count={42} onOpen={() => {}} />,
    )
    const tile = container.firstChild
    const boxes = chain(tile)
    expect(boxes.length, 'no .name-scroll in the tile at all').toBeGreaterThan(3)
    const pinned = boxes.filter((el) => !canShrink(el))
    expect(
      pinned.map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`),
      'these boxes refuse to be narrower than the name, so it overflows the tile',
    ).toEqual([])
  })

  it('still opens the doorway it is a doorway to', () => {
    // The fix adds layout classes to a button; a button that stopped being
    // pressable would be a worse defect than the overflow.
    let opened = 0
    const { container } = render(
      <SuperTile label="Most quoted" title={LONG} count={42} onOpen={() => { opened += 1 }} />,
    )
    const btn = container.querySelector('button')
    expect(btn).toBeTruthy()
    btn.click()
    expect(opened).toBe(1)
  })
})

describe('a superlative that is not a doorway', () => {
  it('lets every box shrink there too', () => {
    // The branch that was already right. It is here because the two branches
    // draw the same headline and the repo's rule is that two things that look
    // the same behave the same — a fix to one that leaves the other pinned is
    // the divergence, not the repair.
    const { container } = render(<SuperTile label="Most quoted" title={LONG} count={42} />)
    const pinned = chain(container.firstChild).filter((el) => !canShrink(el))
    expect(pinned.map((el) => el.tagName.toLowerCase())).toEqual([])
  })
})

// AND THE SITE THIS FIXED WAS ONE OF THREE.
//
// The report named the superlatives, the fix went in at the superlatives, and a
// rater found the same pinned <button> at two more places on the same screen —
// the breakdown row and the tag row — by READING, because nothing could run it:
// the cases above mount SuperTile and nothing else. Three copies of one control,
// one of them fixed, is precisely the shape "similar things act similarly" is
// written against, at the site that had just invoked the rule.
//
// So the shrink is NameDoor's now, and these are the two halves that keep it
// there: the component guarantees the chain, and nothing on this screen draws a
// name-door any other way.
describe('NameDoor', () => {
  it('gives every box between the name and the caller room to shrink', () => {
    const { container } = render(<NameDoor tip="Open" name={LONG} onOpen={() => {}} />)
    const pinned = chain(container.firstChild).filter((el) => !canShrink(el))
    expect(
      pinned.map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`),
      'these refuse to be narrower than the name',
    ).toEqual([])
  })

  it('is a doorway, and a caller cannot opt out of being shrinkable', () => {
    let opened = 0
    const { container } = render(
      // A caller's own style is for what a site genuinely differs in. It must not
      // be able to put the pinned box back.
      <NameDoor tip="Open" name={LONG} onOpen={() => { opened += 1 }} style={{ lineHeight: 1.3 }} />,
    )
    const btn = container.querySelector('button')
    expect(btn.className).toMatch(/\bmin-w-0\b/)
    btn.click()
    expect(opened).toBe(1)
  })
})

describe('the Stats screen draws no second copy of it', () => {
  it('has no <button> holding a NameScroll outside NameDoor', () => {
    const src = readSource('StatsPage.jsx')
    // A <NameScroll> is "inside a button" when the nearest tag BEFORE it, of
    // `<button` and `</button>`, is the opening one. Matching a button and its
    // contents with a lazy span does not work here — it happily reaches across a
    // closed button to a later scroller, and reported two where there is one.
    const inAButton = [...src.matchAll(/<NameScroll\b/g)].filter((m) => {
      const before = src.slice(0, m.index)
      return before.lastIndexOf('<button') > before.lastIndexOf('</button>')
    })
    expect(
      inAButton.length,
      'a name-door was written out by hand again instead of calling NameDoor',
    ).toBe(1)
  })
})
