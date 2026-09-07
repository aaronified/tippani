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

import { DISMISS_FRACTION, MAX_FLICK, PROJECT_MS, SHEET_STOPS, anchorsFor, clampDrag, landing } from '../../src/sheetAnchors.js'

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

  it('and a drag back down to the smallest lands ON it rather than closing', () => {
    // THE OWNER'S REPORT, and it is the whole of it: "there is supposed to be 3
    // separate stop points (natural, 74%, 96%, I think). however, if i expand a
    // popup from natural (where it opens, which is right) to 74%/96%, i cannot
    // take it back to natural. it closes."
    //
    // WHY IT CLOSED. A release is judged on where the sheet WOULD be 120ms later
    // at its current speed, and the dismissal was judged on that same projection.
    // A drag down is a drag down at some speed: at 2px/ms — an ordinary thumb,
    // nothing like a flick — the projection is 240px BELOW where the finger
    // actually let go. So releasing at the smallest anchor projected well under
    // the dismissal line and the sheet left, from the one position the reader was
    // deliberately aiming at.
    //
    // THE RULE, in the owner's own words for the design: "a pull down from the
    // SMALLEST dismisses." A release at or above the smallest is not a pull down
    // from it — the projection may choose which anchor, and it may not invent a
    // departure from a height the reader is holding.
    const a = anchorsFor({ viewport: VIEW, natural: 420 })
    expect(a.length, 'this case needs three stops to be about anything').toBe(3)
    for (const v of [0.5, 1, 2, MAX_FLICK]) {
      expect(landing({ height: a[0], velocity: v, anchors: a }),
        `released at the smallest anchor at ${v}px/ms and the sheet closed`)
        .toEqual({ dismiss: false, height: a[0] })
    }
  })

  it('and the same anywhere above the smallest, at any speed', () => {
    // The general form: the reader is somewhere between two stops with the sheet
    // still fully on the screen. Whatever their speed, that is a choice of anchor
    // and not a dismissal — there is a whole anchor's worth of sheet below them
    // that they have not travelled through yet.
    const a = anchorsFor({ viewport: VIEW, natural: 420 })
    for (const h of [a[0] + 1, Math.round((a[0] + a[1]) / 2), a[1], a[2]]) {
      for (const v of [0, 1, 3, MAX_FLICK]) {
        const out = landing({ height: h, velocity: v, anchors: a })
        expect(out.dismiss, `released at ${h} at ${v}px/ms and the sheet closed`).toBe(false)
        expect(a, 'landed somewhere that is not an anchor').toContain(out.height)
      }
    }
  })

  it('and a pull BELOW the smallest still dismisses, which is the gesture that closes it', () => {
    // The counterweight, and it is what stops the fix above from being "never
    // close". Below the smallest the reader is travelling through the sheet's own
    // exit, and that is the one place the projection is allowed to finish the
    // journey for them.
    const a = anchorsFor({ viewport: VIEW, natural: 420 })
    const s = a[0]
    expect(landing({ height: s - 1, velocity: 3, anchors: a }).dismiss,
      'a brisk pull past the smallest did not close it').toBe(true)
    expect(landing({ height: Math.round(s * 0.5), velocity: 0, anchors: a }).dismiss,
      'the sheet was dragged half away and let go, and it stayed').toBe(true)
  })

  it('and a small dip below the smallest springs back rather than closing', () => {
    // Two fifths of the smallest anchor is the line, and it is deliberately not
    // half: by the time a sheet is half gone the reader has decided. A few pixels
    // of overshoot on the way to the smallest stop is not a decision.
    const a = anchorsFor({ viewport: VIEW, natural: 420 })
    const out = landing({ height: a[0] - 8, velocity: 0, anchors: a })
    expect(out, 'eight pixels of overshoot closed the sheet').toEqual({ dismiss: false, height: a[0] })
  })

  it('and an upward flick never dismisses, however fast', () => {
    expect(landing({ height: anchors[0], velocity: -9, anchors }).dismiss).toBe(false)
  })

  it('and answers with the height it was given rather than throwing when there are no anchors', () => {
    expect(landing({ height: 400, anchors: [] })).toEqual({ dismiss: false, height: 400 })
  })

  // A SPEED NO FINGER CAN PRODUCE IS NOT A DECISION THE READER MADE.
  //
  // Velocity is `dy / dt` between two pointer samples, and the denominator is the
  // platform's rather than the reader's: two samples that arrive in the same tick
  // turn a 40px nudge into hundreds of pixels a millisecond, which projects
  // clean off the screen and dismisses a sheet nobody threw. The clamp is what
  // makes the projection depend on the drag rather than on the sample rate — and
  // it is asked HERE, on the arithmetic, because it is a fact about what a
  // release means and not about how the events were wired.
  it('and a speed no thumb can reach is read as the fastest one that can be', () => {
    // FROM THE TOP OF THE SHEET, which is where the two readings differ: the
    // clamped flick carries it down a stop, and the unclamped one carries it off
    // the screen. A flick from lower down dismisses under either, and would say
    // nothing about the clamp.
    const top = anchors[anchors.length - 1]
    expect(landing({ height: top, velocity: 400, anchors }).dismiss,
      'a sample interval near zero threw the sheet away').toBe(false)
    // AND THE CLAMP IS NOT A CEILING ON MEANING. A flick at the fastest speed a
    // thumb reaches still carries the sheet down a stop.
    expect(landing({ height: top, velocity: MAX_FLICK, anchors }).height,
      'a real flick downward no longer moves the sheet at all').toBeLessThan(top)
  })

  it('and a garbled speed is read as no speed rather than as NaN', () => {
    // `dy / 0` is Infinity and `undefined / n` is NaN; either one propagates
    // through the projection and makes every comparison below it false, so the
    // sheet would settle wherever `reduce` started.
    for (const velocity of [Infinity, -Infinity, NaN, undefined, null]) {
      expect(anchors, `a velocity of ${String(velocity)} left the sheet off its anchors`)
        .toContain(landing({ height: anchors[anchors.length - 1], velocity, anchors }).height)
    }
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
