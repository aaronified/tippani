// WHAT A DRAG MEANS — the arithmetic, stated as the rule rather than as numbers.
//
// THE OWNER'S RULING: "the whole thing is responsive to drag, and has predefined
// anchors" — natural height, 76%, 94%, and a pull down from the smallest
// dismisses. 76 and 94 are the pack's own two (`book-detail.dc.html:4207-4208`),
// which it picks by KIND; this app's one panel is a list and a form at once, so
// anchors are what let it not pick.
//
// WHY THE ARITHMETIC AND NOT THE GESTURE: a drag has no meaning in jsdom, which
// lays nothing out and has no pointer. What CAN be stated here is the part that
// decides what a release means, and it is the part that is easy to get subtly
// wrong — a sheet that lands on the wrong stop, or dismisses when the reader was
// resizing. The gesture itself is watched in a browser.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that
// `src/sheetAnchors.js` exports `anchorsFor`, `landing` and `clampDrag` and no
// React at all.

import { describe, expect, it } from 'vitest'

import { DISMISS_FRACTION, anchorsFor, landing } from '../../src/sheetAnchors.js'

const VIEW = 844 // a phone, and the height the owner reports from

describe('where a release lands', () => {
  const anchors = anchorsFor({ viewport: VIEW, natural: 300 }) // [300, 641, 793]

  it('on the nearer anchor when a slow drag stops between two', () => {
    const between = Math.round((anchors[1] + anchors[2]) / 2)
    expect(landing({ height: between - 40, velocity: 0, anchors }).height).toBe(anchors[1])
    expect(landing({ height: between + 40, velocity: 0, anchors }).height).toBe(anchors[2])
  })

  // PROJECTION IS THE WHOLE DIFFERENCE between a sheet that feels thrown and one
  // that feels dragged: a short fast flick should reach the next stop even though
  // it stopped short of it.
  it('and dismisses when a pull takes it well below the smallest', () => {
    const smallest = anchors[0]
    expect(landing({ height: smallest * (1 - DISMISS_FRACTION) - 1, velocity: 0, anchors }).dismiss).toBe(true)
  })
})
