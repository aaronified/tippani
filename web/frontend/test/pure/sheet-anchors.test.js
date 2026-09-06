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

import { DISMISS_FRACTION, PROJECT_MS, SHEET_STOPS, anchorsFor, clampDrag, landing } from '../../src/sheetAnchors.js'

const VIEW = 844 // a phone, and the height the owner reports from

describe('the anchors a sheet may settle at', () => {
  it('are the pack\'s two, as a share of the viewport', () => {
    expect(anchorsFor({ viewport: VIEW })).toEqual(SHEET_STOPS.map((f) => Math.round(VIEW * f)))
  })

  it('and the height the content actually wants, when it wants less', () => {
    const a = anchorsFor({ viewport: VIEW, natural: 300 })
    expect(a[0], 'a three-row chooser opens as a half-empty sheet').toBe(300)
    expect(a.length, 'the two stops went missing when a natural height joined them').toBe(3)
  })

  it('but not when the content wants MORE than the first stop', () => {
    // A natural height above 76% has no smaller stop to come back to, so it would
    // be an anchor with nothing below it and a dismissal one pull away.
    const a = anchorsFor({ viewport: VIEW, natural: Math.round(VIEW * 0.9) })
    expect(a).toEqual(anchorsFor({ viewport: VIEW }))
  })

  it('and never twice — a sheet whose content is exactly a stop has two, not three', () => {
    const a = anchorsFor({ viewport: VIEW, natural: Math.round(VIEW * 0.76) })
    expect(a).toEqual([...new Set(a)])
  })

  it('and come back empty rather than guessing when there is no viewport yet', () => {
    expect(anchorsFor({ viewport: 0, natural: 300 })).toEqual([])
  })

  it('and are ordered smallest first, which everything below reads', () => {
    const a = anchorsFor({ viewport: VIEW, natural: 300 })
    expect([...a].sort((x, y) => x - y)).toEqual(a)
  })
})

describe('where a release lands', () => {
  const anchors = anchorsFor({ viewport: VIEW, natural: 300 }) // [300, 641, 793]

  it('on the anchor it is already at, when nothing moved', () => {
    for (const a of anchors) {
      expect(landing({ height: a, velocity: 0, anchors }).height, `${a} did not stay put`).toBe(a)
    }
  })

  it('on the nearer anchor when a slow drag stops between two', () => {
    const between = Math.round((anchors[1] + anchors[2]) / 2)
    expect(landing({ height: between - 40, velocity: 0, anchors }).height).toBe(anchors[1])
    expect(landing({ height: between + 40, velocity: 0, anchors }).height).toBe(anchors[2])
  })

  it('and on the SMALLER one from exactly between them', () => {
    // The reader let go without reaching; down is the direction they were going.
    const between = (anchors[1] + anchors[2]) / 2
    expect(landing({ height: between, velocity: 0, anchors }).height).toBe(anchors[1])
  })

  // PROJECTION IS THE WHOLE DIFFERENCE between a sheet that feels thrown and one
  // that feels dragged: a short fast flick should reach the next stop even though
  // it stopped short of it.
  it('on the next anchor up when a short flick is moving fast enough to get there', () => {
    const from = anchors[1]
    const reach = (anchors[2] - anchors[1]) / PROJECT_MS
    const still = landing({ height: from + 20, velocity: 0, anchors })
    const flicked = landing({ height: from + 20, velocity: -reach, anchors })
    expect(still.height, 'a slow drag that stopped short should fall back').toBe(anchors[1])
    expect(flicked.height, 'a flick with the speed to reach the next stop did not').toBe(anchors[2])
  })

  it('and dismisses when a pull takes it well below the smallest', () => {
    const smallest = anchors[0]
    expect(landing({ height: smallest * (1 - DISMISS_FRACTION) - 1, velocity: 0, anchors }).dismiss).toBe(true)
  })

  it('and does NOT dismiss on a pull that has not got there yet', () => {
    const smallest = anchors[0]
    expect(landing({ height: smallest * (1 - DISMISS_FRACTION) + 20, velocity: 0, anchors }).dismiss).toBe(false)
  })

  it('and a downward flick from the smallest dismisses without dragging it all the way', () => {
    // This is the gesture a reader actually makes: a flick, not a haul.
    const out = landing({ height: anchors[0] - 10, velocity: 4, anchors })
    expect(out.dismiss, 'a flick down from the smallest anchor did not dismiss').toBe(true)
  })

  it('and an upward flick never dismisses, however fast', () => {
    expect(landing({ height: anchors[0], velocity: -9, anchors }).dismiss).toBe(false)
  })

  it('and answers with the height it was given rather than throwing when there are no anchors', () => {
    expect(landing({ height: 400, anchors: [] })).toEqual({ dismiss: false, height: 400 })
  })
})

describe('how tall a drag may make it', () => {
  const anchors = anchorsFor({ viewport: VIEW, natural: 300 })

  it('never past the largest anchor, because there is nothing above the screen to reveal', () => {
    expect(clampDrag({ height: VIEW + 400, anchors })).toBe(anchors[anchors.length - 1])
  })

  it('but freely downward, because that is the dismissal and it has to be visible', () => {
    expect(clampDrag({ height: 40, anchors })).toBe(40)
  })

  it('and never negative', () => {
    expect(clampDrag({ height: -200, anchors })).toBe(0)
  })
})
