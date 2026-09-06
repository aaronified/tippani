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

function Sheet({ onDismiss, enabled = true, at = 0 }) {
  const sheet = useRef(null)
  const body = useRef(null)
  const handle = useRef(null)
  stepper = useSheetDrag({ sheet, body, handle, enabled, onDismiss })
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
      <div data-testid="body" ref={(el) => { body.current = el; if (el) el.scrollTop = at }} />
    </div>
  )
}

const el = (id) => document.querySelector(`[data-testid="${id}"]`)
const pointer = (y) => ({ pointerId: 7, pointerType: 'touch', button: 0, clientY: y })

// A whole gesture: press on `from`, move by `by`, let go.
const drag = async (from, by) => {
  await act(async () => {
    fireEvent.pointerDown(el(from), pointer(400))
    fireEvent.pointerMove(window, pointer(400 + by))
    fireEvent.pointerUp(window, pointer(400 + by))
  })
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

  it('and the top of the body does, once the finger has committed', async () => {
    render(<Sheet onDismiss={vi.fn()} at={0} />)
    const start = heightOf(el('sheet'))
    await act(async () => {
      fireEvent.pointerDown(el('body'), pointer(400))
      fireEvent.pointerMove(window, pointer(402))
    })
    expect(heightOf(el('sheet')), 'a 2px wobble on a row moved the sheet, so no tap can land')
      .toBe(start)
    await act(async () => { fireEvent.pointerMove(window, pointer(410)) })
    expect(heightOf(el('sheet')), 'a committed drag in the body did nothing').toBeLessThan(start)
  })

  it('but a scrolled body does not — that is the reader reading', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} at={300} />)
    const start = heightOf(el('sheet'))
    await drag('body', 400)
    expect(heightOf(el('sheet')), 'scrolling back up inside a long sheet resized it').toBe(start)
    expect(out, 'scrolling back up inside a long sheet closed it').not.toHaveBeenCalled()
  })

  it('and nothing does where the panel is not a sheet', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} enabled={false} />)
    await drag('grip', 400)
    expect(el('sheet').style.getPropertyValue('--tp-sheet-h'),
      'the gesture ran on a desk, where the panel is a card in the middle of the screen').toBe('')
    expect(out).not.toHaveBeenCalled()
  })
})

describe('what a drag does', () => {
  it('resizes the sheet rather than sliding it', async () => {
    // A SHEET THAT SLIDES IS A SHEET LEAVING. The reader is dragging to SEE MORE,
    // and a translated sheet shows the same rows further up the screen.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(300))
    })
    const s = el('sheet').style
    expect(s.getPropertyValue('--tp-sheet-h'), 'the drag wrote no height').toBeTruthy()
    expect(s.transform, 'the drag moved the sheet instead of resizing it').toBeFalsy()
  })

  it('and never past the top of the screen, WHILE it is being dragged', async () => {
    // MID-DRAG AND NOT AFTER. A release settles on an anchor whatever happened on
    // the way, so asking after the finger has lifted cannot see a sheet that
    // stretched to four thousand pixels and sprang back — which is the jolt this
    // is about. There is nothing above the top of the screen to reveal.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(-4000))
    })
    expect(heightOf(el('sheet')), 'the sheet stretched past its tallest anchor mid-drag')
      .toBeLessThanOrEqual(ANCHORS[ANCHORS.length - 1])
  })

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
    const out = vi.fn()
    render(<Sheet onDismiss={out} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(600))
      fireEvent.pointerMove(window, pointer(900))
      fireEvent.pointerUp(window, pointer(900))
    })
    expect(out, 'a pull far past the smallest stop did not close the sheet').toHaveBeenCalledTimes(1)
  })

  it('and a pull that stops short does not', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} />)
    await drag('grip', 40)
    expect(out, 'a 40px pull closed the sheet, so no small adjustment is possible').not.toHaveBeenCalled()
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

describe('a plain press on the bar', () => {
  it('moves the sheet, because a button that does nothing is a dead control', () => {
    // A MOUSE HAS NO WAY TO DISCOVER A DRAG. The bar answers a drag and the arrow
    // keys; a click that did nothing would be the defect `make controls` was
    // written to catch, on the one control whose whole job is to say the sheet
    // moves.
    render(<Sheet onDismiss={vi.fn()} />)
    const start = heightOf(el('sheet'))
    act(() => { fireEvent.click(el('grip')) })
    expect(heightOf(el('sheet')), 'clicking the handle did nothing at all').toBeGreaterThan(start)
  })

  it('and comes back to the smallest anchor from the top rather than stopping there', () => {
    render(<Sheet onDismiss={vi.fn()} />)
    act(() => { fireEvent.click(el('grip')) })
    act(() => { fireEvent.click(el('grip')) })
    expect(heightOf(el('sheet')), 'the press stopped answering once the sheet was tallest')
      .toBe(ANCHORS[0])
  })

  it('and a drag that ends on the bar does not also count as a press', () => {
    // A POINTER SEQUENCE THAT ENDS WHERE IT STARTED FIRES `click` AFTER
    // `pointerup`. Without the guard, letting go of the bar steps the sheet again
    // — past wherever the reader just put it, every single drag.
    render(<Sheet onDismiss={vi.fn()} />)
    // FAR ENOUGH THAT THE ANCHOR IS NOT IN DOUBT. `fireEvent` can deliver both
    // moves in one tick, which leaves the release with no measurable speed — so a
    // drag that stops between two stops would settle by a hair and this case
    // would be reading the coin toss rather than the guard.
    act(() => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(280))
      fireEvent.pointerUp(window, pointer(280))
    })
    const landed = heightOf(el('sheet'))
    expect(landed, 'the drag did not reach the taller anchor, so the guard is untested')
      .toBe(ANCHORS[ANCHORS.length - 1])
    act(() => { fireEvent.click(el('grip')) })
    expect(heightOf(el('sheet')), 'the click the drag left behind moved the sheet a second time')
      .toBe(landed)
  })
})

describe('a reader who cannot make the gesture', () => {
  it('reaches the same anchors from the keyboard', async () => {
    // ONE SET OF STOPS, NOT TWO. A stepper with its own numbers is a second
    // definition of where the sheet may rest, and the two drift.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => { stepper(1) })
    expect(ANCHORS).toContain(heightOf(el('sheet')))
    const taller = heightOf(el('sheet'))
    await act(async () => { stepper(-1) })
    expect(heightOf(el('sheet')), 'stepping back down did not move the sheet').toBeLessThan(taller)
  })

  it('and cannot step off either end of them', async () => {
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => { stepper(1); stepper(1); stepper(1) })
    expect(heightOf(el('sheet'))).toBe(ANCHORS[ANCHORS.length - 1])
    await act(async () => { stepper(-1); stepper(-1); stepper(-1) })
    expect(heightOf(el('sheet'))).toBe(ANCHORS[0])
  })
})
