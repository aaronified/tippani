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

const { SuperTile } = await import('../../src/StatsPage.jsx')

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
