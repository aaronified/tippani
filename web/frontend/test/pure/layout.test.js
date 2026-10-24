import { describe, expect, it } from 'vitest'
import { POPUP_GAP, POPUP_MARGIN, QUOTE_COLUMNS_IN, columnMeasure, placeAnchored } from '../../src/ui.jsx'
import { DISMISS_FRACTION, anchorsFor, landing } from '../../src/sheetAnchors.js'
import { coversThatFit } from '../../src/coverFit.js'
import { clampPlacement, sizes } from '../../src/frames.js'

// A dropdown stays on the screen.
//
// The bug: every popup in the app placed itself in CSS — `position: absolute;
// top: calc(100% + 4px)` — which is right exactly once, when there is room
// below the trigger. On a phone, opening a Select near the bottom of the screen
// rendered its options below the fold, so choosing one meant scrolling the page
// to reach a menu that was supposed to be in front of you.
//
// placeAnchored is the arithmetic, separated from the DOM on purpose. jsdom
// reports every rect as zeros, so a test driving this through the hook would be
// asserting that 0 fits inside 0 — which passes, and means nothing. The part
// that can actually be wrong is which side, how tall and how far along the
// edge, and that is all here.
describe('anchored popup', () => {
  // A phone, portrait.
  const PHONE = { w: 390, h: 844 }
  // One trigger, 44px tall (the standard control height), 200px wide.
  const trigger = (top, left = 20, width = 200) => ({
    top,
    bottom: top + 44,
    left,
    right: left + width,
    width,
  })

  describe('placeAnchored', () => {
    it('flips above when the trigger is near the bottom', () => {
      // THE REPORTED BUG. A trigger at y=700 on an 844px screen leaves 100px
      // below and 692px above; a 300px list must go up.
      const p = placeAnchored(trigger(700), PHONE, 300, 200)
      expect(p.down).toBe(false)
      // Sits its own height above the trigger, not at the top of the screen.
      expect(p.top).toBe(700 - POPUP_GAP - 300)
    })

    it('slides along the edge instead of hanging off the right', () => {
      // Opened from a corner: a 260px menu anchored at x=300 on a 390px screen
      // would end at 560. It is pulled back inside.
      const p = placeAnchored(trigger(100, 300, 44), PHONE, 200, 260)
      expect(p.left).toBe(390 - 260 - POPUP_MARGIN)
      expect(p.left).toBeGreaterThanOrEqual(POPUP_MARGIN)
    })
  })
})

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
describe('sheet anchors', () => {
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
})

// How many specimen covers fit the room there is.
//
// THIS FILE KNOWS A MODULE PATH, and the tier it sits in is where that is the
// point: `coversThatFit` IS the observable unit — a width, a cell size and a gap
// in, a count out — and there is nothing a browser could show that this does not
// say more precisely. The behaviour it produces on a real screen was measured
// separately and is recorded in the commit that added it.
describe('cover fit', () => {
  // The ladder lives with the hook that reads it, in ui.jsx.

  // THE GAP IS A PARAMETER HERE, NOT A CONSTANT OF THIS FILE. It was `const GAP =
  // 14`, which put the stylesheet's number back into the suite on the same day the
  // component stopped hard-coding it — so the one thing the change was for went
  // untested. The cases below vary it, and the boundary case is the point: two 150s
  // need 314 with a 14px gap and 330 without, so a room of 320 answers 1 or 2
  // depending on whether the gap was read at all.
  const GAP = 14

  describe('how many covers fit', () => {
    it("draws two at the size a phone actually starts on", () => {
      expect(coversThatFit(316, 100, GAP, 3)).toBe(2)
    })
  })

  // ── A STORED SIZE IS PUT ON THE LADDER BEFORE IT IS USED.
  //
  // WHAT THIS GUARDS. Sizes were saved for a long time before the slider had a step,
  // so a browser holding 123 is ordinary. A range with `min=95 step=5` snaps that to
  // 125 in the DOM and fires no event — so the handle sat on 125 while React's
  // state, the readout beside it and the grids reading the same key all still said
  // 123. Three places disagreeing with the control, and no press to blame it on.
})

// The arithmetic of putting a picture in a frame (src/frames.js). The function IS the
// observable unit here — a placement is numbers in and numbers out — which is the
// justified exception to "a test does not know a function's name"; the editor's
// behaviour on screen is the journey's.
describe('frames', () => {
  describe('where a picture can sit', () => {
    it('cannot be dragged off the frame while it covers it', () => {
      const iw = 1600
      const ih = 701
      const size = sizes(iw, ih, 1).cover
      const slack = (size - 1) / 2
      const p = clampPlacement({ size, x: 5, y: 5 }, iw, ih, 'face')
      expect(p.x).toBeCloseTo(slack, 6)
      expect(p.y, 'exactly as tall as the frame: nothing to pan vertically').toBeCloseTo(0, 6)
    })
  })
})

// A CHOSEN COLUMN COUNT HAS TO BE REACHABLE.
//
// THE BUG THIS CLOSES, in the owner's words: a work page's quotes "stop at two
// columns and do not use the width it has". Not a ladder problem — the ladder was
// right — a CAP problem, and the two were written far enough apart that neither
// knew about the other:
//
//   index.css   .tp-detail-stream > * { max-width: 880px }   (the prose measure)
//   ui.jsx      QUOTE_COLUMNS_IN = [[2000,5],[1600,4],[1200,3],[800,2]]
//
// and useColumnsIn measures the BOARD, which lives inside that cap. 880 is under
// 1200, so the third rung was unreachable on any screen ever built. Two numbers,
// each defensible, and the product of them is a ceiling nothing declares.
//
// SO THE INVARIANT IS THE RELATION BETWEEN THEM, not either number: whatever
// measure a chosen count is given, it must be wide enough for the ladder to
// return that count. That is the assertion the old code fails and the one a
// future edit to either list has to keep.
describe('board columns', () => {
  // The ladder, as useColumnsIn reads it: the first rung whose minimum the width
  // meets, else one column.
  const columnsAt = (w) => {
    for (const [min, cols] of QUOTE_COLUMNS_IN) if (w >= min) return cols
    return 1
  }

  describe('columnMeasure', () => {
    it('is wide enough for the ladder to actually return the count asked for', () => {
      // THE WHOLE FILE IS THIS CASE. 880 — the cap before this change — fails it at
      // three, four and five.
      for (let n = 1; n <= 5; n += 1) {
        expect(columnsAt(columnMeasure(n)), `${n} columns asked for, ${columnMeasure(n)}px allowed`).toBe(n)
      }
    })
  })

  // THE PROPERTY IS A NAME TWO FILES HAVE TO AGREE ON, AND NOTHING CHECKED IT.
  //
  // A rater reverted index.css's cap to a bare `max-width: 880px` — the exact
  // pre-fix state — and the whole suite passed, 4,257 of 4,257. Every case above
  // still held, and the dom cases read the picker's value off the STYLE ATTRIBUTE,
  // so the board went on writing `--board-measure: 1200px` into markup that nothing
  // consumed. The fix was inert and green.
  //
  // This is the same shape as category-dot-class.test.js in the same stretch of
  // work — a function producing a name and a stylesheet declaring it — and it is
  // the guard that should have been written with the fix rather than after a rater
  // went looking.
})
