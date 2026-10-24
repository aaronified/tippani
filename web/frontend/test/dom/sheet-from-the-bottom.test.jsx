// A POPUP ON A PHONE IS A SHEET YOU CAN DRAG, AND A PULL PAST THE SMALLEST STOP
// CLOSES IT.
//
// THE REPORT, the owner's, over a screenshot of a bottom sheet with a grab
// handle: "see your own design for the popup. this is ideal. the small bar on top
// ensures that this is intuitively draggable. the whole thing is responsive to
// drag, and has predefined anchors. can you do this for the popups in the app?"
// Then, asked where the anchors are and what may be grabbed: natural height →
// 76% → 94%, a pull down from the smallest dismisses, tapping outside dismisses
// too, and the handle, the header and the top of the body all drag.
//
// WHAT REPLACED WHAT. `useSwipeDown` watched for a 90px downward touch and then
// dismissed — a threshold, not a drag: the sheet stood still until it vanished,
// so nothing on screen ever said the gesture existed or was working.
//
// THE ARITHMETIC IS NOT HERE. Which anchor a release lands on, and when a release
// is a dismissal, is `sheetAnchors.js` and `test/pure/sheet-anchors.test.js` — no
// React, eighteen cases, and a rule that can be stated exactly. What is here is
// the half only a document can answer: WHICH PRESSES START A DRAG, that the sheet
// resizes rather than slides, and that leaving goes through the guarded exit.
//
// THE ONE THING THIS FILE HAS TO FAKE. jsdom lays nothing out, so every
// `getBoundingClientRect` is zeros and every `scrollHeight` is 0 — a sheet with
// no height is below every anchor and would read as dismissed the moment it was
// touched. So the harness gives the sheet a height and moves it as the drag does,
// which is exactly what a browser would do and what jsdom will not.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that `useSheetDrag`
// lives in `ui.jsx` and takes `{ sheet, body, handle, enabled, onDismiss }` as
// refs; that it writes the height to the custom property `--tp-sheet-h`; and that
// it returns a stepper so the same anchors answer the arrow keys.

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSheetDrag } from '../../src/ui.jsx'

import { anchorsFor } from '../../src/sheetAnchors.js'

afterEach(() => cleanup())

const VIEWPORT = 800
const ANCHORS = anchorsFor({ viewport: VIEWPORT })

beforeEach(() => {
  window.innerHeight = VIEWPORT
})

// The sheet's height, as a browser would report it: whatever was last written to
// `--tp-sheet-h`, and the middle anchor before anything has been.
function heightOf(el) {
  const set = el.style.getPropertyValue('--tp-sheet-h')
  return set ? parseFloat(set) : ANCHORS[0]
}

let stepper = null
let slideOut = null

// A READER WHO HAS ASKED FOR NO MOTION. `test/setup-dom.js` gives jsdom a
// `matchMedia` that answers `matches: false` to everything, so the hook's
// `reduced()` is false by default and the animated paths are the ones under test.
// This swaps the answer for one case, because the repo's rule — a rest state may
// not depend on anything firing — is only checked by asking for no motion.
const realMatchMedia = window.matchMedia
const reduce = (on) => {
  window.matchMedia = on
    ? (media) => ({ ...realMatchMedia(media), matches: /prefers-reduced-motion/.test(media) })
    : realMatchMedia
}

// HOW TALL THE CONTENT IS, which the hook asks the BODY and not the sheet: the
// sheet's own height is the thing being decided, so a measurement taken from it
// would depend on its own last answer. The default is taller than the largest
// anchor — a long sheet — because that is what every case here but two is about.
// jsdom gives every box 40px (see test/setup-dom.js), so the chrome above the
// body measures 40 and the sum is 40 + this.
const LONG = 2000

function Sheet({ onDismiss, enabled = true, at = 0, content = LONG, head = false }) {
  const sheet = useRef(null)
  const body = useRef(null)
  const handle = useRef(null)
  const bar = useRef(null)
  const sheetVerbs = useSheetDrag({ sheet, body, handle, head: head ? bar : undefined, enabled, onDismiss })
  stepper = sheetVerbs.step
  // THE EXIT THE ✕ AND THE SCRIM TAKE, exposed for the cases about it. It used
  // to be the drag's alone, so two of the sheet's three ways out vanished with no
  // animation while the code and the changelog both said otherwise.
  slideOut = sheetVerbs.slideOut
  return (
    <div
      data-testid="sheet"
      ref={(el) => {
        sheet.current = el
        if (el && !el.getBoundingClientRect.faked) {
          el.getBoundingClientRect = Object.assign(() => ({ height: heightOf(el) }), { faked: true })
        }
      }}
    >
      <button type="button" data-testid="grip" ref={handle} />
      <div data-testid="head" ref={bar}>
        <button type="button" data-testid="close" />
      </div>
      <div
        data-testid="body"
        ref={(el) => {
          body.current = el
          if (el) {
            el.scrollTop = at
            Object.defineProperty(el, 'scrollHeight', { value: content, configurable: true })
          }
        }}
      />
    </div>
  )
}

const el = (id) => document.querySelector(`[data-testid="${id}"]`)
const pointer = (y) => ({ pointerId: 7, pointerType: 'touch', button: 0, clientY: y })

// A DRAG'S EFFECT LANDS ON THE NEXT FRAME, not on the event that caused it.
//
// The hook writes the height once per animation frame rather than once per
// pointer event, because a pointer stream arrives finer than a frame and every
// write costs a layout of the sheet and a re-blur of everything behind it — which
// is what the owner saw: "the animation is not just not-smooth. it introduces
// screen tears!!" So a case that moves the finger and looks immediately is
// looking before the browser would have drawn anything, and this is the wait a
// reader's eye already does for free.
const frame = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r())) })

// A whole gesture: press on `from`, move by `by`, let go.
const drag = async (from, by) => {
  await act(async () => {
    fireEvent.pointerDown(el(from), pointer(400))
    fireEvent.pointerMove(window, pointer(400 + by))
  })
  await frame()
  await act(async () => { fireEvent.pointerUp(window, pointer(400 + by)) })
}

describe('what starts a drag', () => {
  it('the handle does, with no distance to prove first', async () => {
    render(<Sheet onDismiss={vi.fn()} />)
    // ONE PIXEL FROM THE GRIP IS A DRAG. It has nothing else to be, and a slop on
    // it would mean the sheet did not move under a slow careful finger.
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(399))
    })
    expect(el('sheet').style.getPropertyValue('--tp-sheet-h'),
      'a press on the handle and a move did not resize the sheet').toBeTruthy()
  })

  it('but a scrolled body does not — that is the reader reading', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} at={300} />)
    const start = heightOf(el('sheet'))
    await drag('body', 400)
    expect(heightOf(el('sheet')), 'scrolling back up inside a long sheet resized it').toBe(start)
    expect(out, 'scrolling back up inside a long sheet closed it').not.toHaveBeenCalled()
  })

})

describe('what a drag does', () => {

  it('and settles on an anchor when the finger lets go', async () => {
    render(<Sheet onDismiss={vi.fn()} />)
    await drag('grip', -60)
    expect(ANCHORS, `the sheet came to rest at ${heightOf(el('sheet'))}, which is not one of the stops`)
      .toContain(heightOf(el('sheet')))
  })

  it('and a pull well past the smallest stop takes the guarded exit, once', async () => {
    // THE SAME EXIT AS THE ✕ AND ESCAPE. A second way out that skipped the
    // unsaved-changes question would be a way to lose typing, so this is the
    // caller's own guarded close and not a bare dismissal.
    //
    // AND IT ARRIVES AFTER THE SHEET HAS SLID OUT, not on the release. The owner
    // asked for a close animation from the bottom, so a dismissal now animates the
    // offset down and calls the caller's exit when it lands — which is why this
    // case advances the clock. `ONCE` is the half that matters: the rAF chain and
    // the guard timer both end at the same call, and calling it twice would put
    // the unsaved-changes question up twice.
    // REAL TIMERS, not fake ones: the exit is a double-`requestAnimationFrame`
    // followed by a guard timeout, and faking the clock while awaiting a real
    // frame deadlocks the two against each other.
    const out = vi.fn()
    render(<Sheet onDismiss={out} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(600))
      fireEvent.pointerMove(window, pointer(900))
    })
    await frame()
    await act(async () => { fireEvent.pointerUp(window, pointer(900)) })
    expect(out, 'the sheet was gone before the reader saw it leave').not.toHaveBeenCalled()
    // The sheet is on its way out: the box is a box, and the offset it is
    // animating to is the whole of it.
    expect(el('sheet').style.transform, 'the sheet is not leaving downward').toMatch(/translateY\(/)
    await act(async () => { await new Promise((r) => setTimeout(r, 320)) })
    expect(out, 'a pull far past the smallest stop did not close the sheet').toHaveBeenCalledTimes(1)
    await act(async () => { await new Promise((r) => setTimeout(r, 320)) })
    expect(out, 'the guarded exit was taken twice — the reader would be asked about unsaved changes twice')
      .toHaveBeenCalledTimes(1)
  })

  it('and a press that never moves is a tap, not a dismissal', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerUp(window, pointer(400))
    })
    expect(out, 'pressing the handle and letting go closed the sheet').not.toHaveBeenCalled()
  })
})

