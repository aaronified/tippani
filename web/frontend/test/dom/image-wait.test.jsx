// A LOADER THAT ONLY APPEARS WHEN SOMETHING IS ACTUALLY LATE.
//
// The owner's ask, verbatim: "use some loading animation if there is an image and
// it is not loaded (no loader if there is no image)."
//
// THE SECOND CLAUSE IS THE WHOLE DIFFICULTY, and it is not the one it looks like.
// "No loader if there is no image" is easy — a box with no path draws the
// placeholder it always drew. The hard case is the image that IS there and
// arrives in forty milliseconds: a mark keyed on "no pixels yet" appears on every
// one of those for a frame or two, so a fast local network turns a whole shelf
// into a flicker. That is what the delay is for, and it is the case a screenshot
// cannot show and an eye cannot catch.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, that the mark is the
// class `img-wait` on the picture itself, and that the numbers below are typed
// out rather than imported — see the note on them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Cover } from '../../src/ui.jsx'
import { Face } from '../../src/characterRows.jsx'

// NOT IMPORTED FROM THE CODE, deliberately, and `hint-lifetime.test.jsx` says why
// best: "a test that reads the same constant the code does cannot tell you the
// number changed, and this suite is about the timings a reader actually
// experiences." These are 150 and 300 in imageWait.js.
const DELAY_MS = 150
const HOLD_MS = 300

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => { vi.useRealTimers(); cleanup() })

const tick = (ms) => act(() => { vi.advanceTimersByTime(ms) })
const marked = () => document.querySelectorAll('.img-wait').length
const img = () => document.querySelector('img')

describe('a picture that has been asked for and has not arrived', () => {
  it('says nothing at all until the wait is long enough to be worth saying', () => {
    render(<Cover path="a.jpg" title="Anand" />)
    tick(DELAY_MS - 20)
    // THE NO-FLASH GUARANTEE. Everything else in this file is about what the mark
    // does; this is about what it must NOT do, which is appear on a fast load.
    expect(marked(), 'a mark appeared before the picture was even late').toBe(0)
  })

  it('and then says it', () => {
    render(<Cover path="a.jpg" title="Anand" />)
    tick(DELAY_MS + 20)
    expect(marked(), 'the picture is late and nothing says so').toBe(1)
  })

  it('and a picture that arrives inside the delay never shows a mark at all', () => {
    // The case the delay exists for, and the one a reader meets most on their own
    // machine: the image lands before the app has decided it is late.
    //
    // SAMPLED THROUGHOUT, not checked at the end, and the first cut of this case
    // did the latter. "Never shows a mark" is a claim about every instant, and an
    // end-state assertion passes for a mark that appeared, sat there, and left on
    // its hold — which is precisely the flicker being forbidden. Proved: dropping
    // the delay to zero left the end-state version green.
    render(<Cover path="a.jpg" title="Anand" />)
    const seen = []
    tick(DELAY_MS - 40)
    seen.push(marked())
    fireEvent.load(img())
    seen.push(marked())
    tick(DELAY_MS)
    seen.push(marked())
    tick(HOLD_MS + 50)
    seen.push(marked())
    expect(seen, 'a picture that was never late showed a mark at some point anyway').toEqual([0, 0, 0, 0])
  })

  it('and once shown it stays shown, rather than blinking out on arrival', () => {
    // Without the hold, a picture landing ten milliseconds after the mark appears
    // shows it for ten milliseconds — which reads as a glitch in the page, not as
    // information about a wait.
    render(<Cover path="a.jpg" title="Anand" />)
    tick(DELAY_MS + 10)
    expect(marked()).toBe(1)
    fireEvent.load(img())
    tick(HOLD_MS - 100)
    expect(marked(), 'the mark vanished the instant the picture landed').toBe(1)
    tick(HOLD_MS)
    expect(marked(), 'the mark outstayed its hold').toBe(0)
  })

  it('and it is on the picture itself, so nothing moves when it goes', () => {
    // ON THE `img`, NOT A BOX AROUND IT. A mark that is its own element has to be
    // given a size, and a loader that reserves the wrong box causes the shift it
    // was added to soften. The picture is already sized by whatever draws it.
    render(<Cover path="a.jpg" title="Anand" hero />)
    tick(DELAY_MS + 20)
    const el = document.querySelector('.img-wait')
    expect(el?.tagName, 'the mark is not the picture, so it has a box of its own to get wrong').toBe('IMG')
    expect(el.style.aspectRatio, 'the box the mark sits in is not reserved').toBe('2 / 3')
  })
})

describe('and no mark where there is nothing coming', () => {
  it('draws none for a cover that does not exist', () => {
    // "No loader if there is no image" — the owner's own second clause. An empty
    // box gets the placeholder it always got, which SAYS it is empty.
    render(<Cover path="" title="Anand" />)
    tick(DELAY_MS + HOLD_MS + 50)
    expect(marked()).toBe(0)
    expect(document.querySelector('.ph'), 'the absent-artwork placeholder stopped being drawn').toBeTruthy()
  })

  it('and none for a lazy face, which the browser has not been asked to fetch yet', () => {
    // THE GATE, AND THE REASON FOR IT. `Face` is lazy by default and is drawn
    // ninety to a screen; a lazy picture below the fold has not been REQUESTED,
    // so a mark over it describes a wait nobody is having — and animates ninety
    // of them against the idle-CPU budget.
    render(<Face src="a.jpg" name="Anand" />)
    tick(DELAY_MS + 20)
    expect(marked(), 'a picture the browser has not started fetching was called late').toBe(0)
  })

  it('but one for the eager face, which is being fetched right now', () => {
    render(<Face src="a.jpg" name="Anand" loading="eager" />)
    tick(DELAY_MS + 20)
    expect(marked(), 'the one face that IS being fetched says nothing about it').toBe(1)
  })
})

// AND A PICTURE ALREADY IN THE CACHE IS NOT A PICTURE THAT IS COMING.
//
// THE OWNER'S REPORT: "i keep on getting flickers even long after the popup is
// opened", on the character and actor sheets, "and i never saw anything pending to
// load". Nothing WAS pending — that is the whole of it.
//
// THE MECHANISM. The mark is `animation: img-wait-sweep 1.1s linear infinite`, and
// it is gated on the picture not having arrived. Arrival was learned from the
// `load` event alone, and a cached image fires no `load` — so on every visit after
// the first, the hero portrait swept for as long as the panel stayed open. Not a
// wait described wrongly: a wait that never ended.
//
// `PortraitBlock` HAD ALREADY LEARNED THIS, twenty lines away, and says so in its
// own comment — it measures an image that is `complete` instead of waiting for an
// event that will not come. The same fact had to reach the arrival flag.
//
// AND `complete` MEANS FINISHED, NOT SUCCEEDED. A cached FAILURE is complete with
// a zero natural width and fires no `error` either, so the two cases are told
// apart by the width rather than by the flag.
describe('a picture the browser already has', () => {
  const complete = (width) => {
    // jsdom loads nothing, so `complete` is what the app reads and what a test has
    // to be able to state. Defined per-element, restored by cleanup.
    const proto = window.HTMLImageElement.prototype
    const had = { c: Object.getOwnPropertyDescriptor(proto, 'complete'), n: Object.getOwnPropertyDescriptor(proto, 'naturalWidth') }
    Object.defineProperty(proto, 'complete', { configurable: true, get: () => true })
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => width })
    return () => {
      if (had.c) Object.defineProperty(proto, 'complete', had.c)
      if (had.n) Object.defineProperty(proto, 'naturalWidth', had.n)
    }
  }

  it('wears no waiting mark at all, and never starts one', async () => {
    const restore = complete(600)
    try {
      render(<Face src="cached.jpg" name="Itkovian" url={(x) => x} loading="eager" />)
      // SAMPLED ACROSS THE WHOLE DELAY AND HOLD, not just at the end: the mark is
      // lagged on deliberately, so a check at one instant can miss a sweep that
      // starts late and then runs forever.
      for (let i = 0; i < 12; i++) {
        await act(async () => { vi.advanceTimersByTime(100) })
        expect(document.querySelector('.img-wait'),
          `a picture already in the cache is being described as still coming (at ${(i + 1) * 100}ms)`)
          .toBeNull()
      }
    } finally { restore() }
  })

  it('and a cached failure draws the stand-in rather than a permanent sweep', async () => {
    // Complete with no pixels: the request finished and there is nothing to show.
    // No `error` event is coming either, so this is the only signal there is.
    const restore = complete(0)
    try {
      render(<Face src="gone.jpg" name="Itkovian" url={(x) => x} loading="eager" />)
      await act(async () => { vi.advanceTimersByTime(1200) })
      expect(document.querySelector('.img-wait'),
        'a picture that already failed is being animated as if it were on its way').toBeNull()
      expect(document.querySelector('img'),
        'a picture that already failed is still being drawn as one').toBeNull()
    } finally { restore() }
  })
})
