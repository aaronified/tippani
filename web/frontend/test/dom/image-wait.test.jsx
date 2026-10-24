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
