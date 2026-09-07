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
import { declaredIn } from '../css-cascade.js'
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

// HOW MUCH OF THE SHEET A READER CAN SEE, which is not the same as how tall its
// box is once a drag is on. The gesture gives the box the tallest anchor and
// pushes it back down by the difference — one `translateY` a frame, which the
// compositor answers without laying anything out — so the box's own height is the
// same number at every position and the visible edge is height MINUS the offset.
// The owner reported the old mechanism three times, last as "the page tears too
// much (often the background blur is removed for a second)": writing a height
// every frame re-lays-out the sheet and re-blurs the screen behind it.
function shownOf(el) {
  const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || '')
  return heightOf(el) - (m ? parseFloat(m[1]) : 0)
}

let stepper = null

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
  stepper = useSheetDrag({ sheet, body, handle, head: head ? bar : undefined, enabled, onDismiss })
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
    await frame()
    expect(shownOf(el('sheet')), 'a committed drag in the body did nothing').toBeLessThan(start)
  })

  it('but a scrolled body does not — that is the reader reading', async () => {
    const out = vi.fn()
    render(<Sheet onDismiss={out} at={300} />)
    const start = heightOf(el('sheet'))
    await drag('body', 400)
    expect(heightOf(el('sheet')), 'scrolling back up inside a long sheet resized it').toBe(start)
    expect(out, 'scrolling back up inside a long sheet closed it').not.toHaveBeenCalled()
  })

  it('and so does the whole header bar, because the mark is a sign and not a target', async () => {
    // THE OWNER'S RULING: "the bar is too small to drag. the whole header bar
    // should act as the bar. the bar is there just to make it intuitive."
    // 36 by 4 is a mark, not a thumb's worth of anything.
    render(<Sheet onDismiss={vi.fn()} head />)
    const start = heightOf(el('sheet'))
    await act(async () => {
      fireEvent.pointerDown(el('head'), pointer(400))
      fireEvent.pointerMove(window, pointer(340))
    })
    await frame()
    expect(heightOf(el('sheet')), 'a drag from the header bar moved nothing')
      .toBeGreaterThan(start)
  })

  it('and a press on the bar itself steps the sheet, like a press on the mark', async () => {
    // HALF AN AFFORDANCE IS THE HALF A MOUSE CANNOT FIND. The bar drags; the
    // press that steps through the anchors was left on an 18px mark that is
    // deliberately too small to be a target. "the whole header bar should act as
    // the bar" is about both.
    render(<Sheet onDismiss={vi.fn()} head />)
    const start = heightOf(el('sheet'))
    await act(async () => {
      fireEvent.pointerDown(el('head'), pointer(400))
      fireEvent.pointerUp(window, pointer(400))
      fireEvent.click(el('head'))
    })
    expect(heightOf(el('sheet')), 'a press on the header bar did nothing at all')
      .toBeGreaterThan(start)
  })

  it('but a tap on that bar is a tap, because it carries the way out', async () => {
    // THE ✕ IS IN THERE. Making the bar draggable may not cost the key inside it
    // its press, and the rule that keeps both is the one already written down: a
    // pointer sequence that never travels four pixels is a press.
    render(<Sheet onDismiss={vi.fn()} head />)
    const start = heightOf(el('sheet'))
    await act(async () => {
      fireEvent.pointerDown(el('close'), pointer(400))
      fireEvent.pointerUp(window, pointer(400))
      fireEvent.click(el('close'))
    })
    expect(heightOf(el('sheet')), 'a tap on a key in the header bar resized the sheet')
      .toBe(start)
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

describe('what a drag costs', () => {
  it('writes the height once a frame, however fast the finger reports', async () => {
    // THE OWNER'S REPORT, and it is stronger than jank: "the animation is not
    // just not-smooth. it introduces screen tears!!" Every write invalidates the
    // sheet's layout AND the blur behind it, so writing per pointer event asks
    // the browser to lay out and composite several times inside one frame — and
    // present halves of two of them. A frame is the only rate a screen can show.
    render(<Sheet onDismiss={vi.fn()} />)
    const sheet = el('sheet')
    let writes = 0
    const real = sheet.style.setProperty.bind(sheet.style)
    sheet.style.setProperty = (...args) => {
      if (args[0] === '--tp-sheet-h') writes++
      return real(...args)
    }
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      for (let i = 1; i <= 12; i++) fireEvent.pointerMove(window, pointer(400 - i * 5))
    })
    await frame()
    expect(writes, 'twelve moves inside one frame wrote the height more than once')
      .toBe(1)
  })

  it('says so on the element while it happens, so the blur behind it can stand down', async () => {
    // A 10px BACKDROP BLUR IS RECOMPUTED WHENEVER WHAT IS IN FRONT OF IT CHANGES
    // SHAPE, and the sheet changes shape every frame of a drag. The stylesheet
    // stands the blur down for the length of the gesture, and the only way it can
    // know is this class — on the scrim as well as the sheet, because the
    // expensive half is behind the sheet and CSS cannot reach a parent.
    render(<Sheet onDismiss={vi.fn()} />)
    const sheet = el('sheet')
    expect(sheet.classList.contains('is-dragging'), 'a sheet at rest says it is being dragged').toBe(false)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(340))
    })
    expect(sheet.classList.contains('is-dragging'), 'nothing on the page says a drag is under way').toBe(true)
    expect(sheet.parentElement.classList.contains('is-dragging'), 'the surface behind the sheet was not told').toBe(true)
    await frame()
    await act(async () => { fireEvent.pointerUp(window, pointer(340)) })
    expect(sheet.classList.contains('is-dragging'), 'the drag class outlived the drag').toBe(false)
    expect(sheet.parentElement.classList.contains('is-dragging'), 'the surface behind it kept the class').toBe(false)
  })
})

describe('a sheet whose content changes under it', () => {
  it('follows its content rather than keeping the height the last thing needed', async () => {
    // THE OWNER'S REPORT: "this is a long popup, but it has a very low starting
    // position. this is probably because it is inheriting the positioning of the
    // picker … when there is no picker (only one available option), it makes no
    // sense." A sub-surface opens inside this same box by design, so the element
    // never changes and nothing re-measures — the record's page kept the picker's
    // height.
    const short = <Sheet onDismiss={vi.fn()} content={80} />
    const { rerender } = render(short)
    const small = heightOf(el('sheet'))
    expect(small, 'a short sheet did not open at its own height').toBeLessThan(ANCHORS[0])
    await act(async () => { rerender(<Sheet onDismiss={vi.fn()} content={LONG} />) })
    expect(heightOf(el('sheet')), 'the sheet kept the height the previous content asked for')
      .toBe(ANCHORS[0])
  })

  it('but not once the reader has put it somewhere', async () => {
    // A SHEET THE READER HAS DRAGGED HAS BEEN PLACED. Following the content from
    // there would be the app overruling the gesture it just invited.
    const { rerender } = render(<Sheet onDismiss={vi.fn()} content={80} />)
    await drag('grip', -700)
    const put = heightOf(el('sheet'))
    // NOT WHERE THE NEW CONTENT WOULD PUT IT EITHER, which is the whole
    // precondition and was missing: the reader placed the sheet at 608, the long
    // content's own first anchor is 608, and a sheet that never moved passed this
    // case. It has to be somewhere the rule under test would MOVE it away from.
    expect(put, 'the drag did not reach the tallest stop, so nothing here is tested')
      .toBe(ANCHORS[ANCHORS.length - 1])
    expect(put, 'the reader was placed exactly where the new content would put them anyway')
      .not.toBe(ANCHORS[0])
    await act(async () => { rerender(<Sheet onDismiss={vi.fn()} content={LONG} />) })
    expect(heightOf(el('sheet')), 'the app moved a sheet the reader had placed').toBe(put)
  })
})

describe('what a drag costs', () => {
  it('claims the axis for as long as the gesture lasts, and gives it back', async () => {
    // THE OWNER'S REPORT: "now dragging is almost impossible, extremely flaky".
    // A gesture the BROWSER answers is a gesture this hook stops receiving, and
    // the sheet's own `touch-action` was left to the stylesheet — where the head
    // says `pan-x`, because its title scrolls sideways under a fade. For the
    // length of a drag the sheet takes the whole gesture and then hands it back,
    // so the sideways scroll is not lost.
    render(<Sheet onDismiss={vi.fn()} />)
    const sheet = el('sheet')
    await act(async () => { fireEvent.pointerDown(el('grip'), pointer(400)) })
    expect(sheet.style.touchAction, 'the browser is still free to answer this gesture itself').toBe('none')
    await act(async () => { fireEvent.pointerUp(window, pointer(400)) })
    expect(sheet.style.touchAction, 'the sheet kept the axis after the drag ended').toBe('')
  })

  it('and captures the pointer only where capture is the point', async () => {
    // CAPTURE ON THE GRAB BAR BROKE THE PRESS, and a browser probe caught it in
    // one run: with capture taken on pointerdown, the `click` that follows is
    // dispatched to the CAPTURING element, so the header's and the bar's own
    // handlers never fire — "pressing the handle left the sheet exactly where it
    // was". A touch pointer is implicitly captured to its pointerdown target
    // anyway, and this hook listens on `window`, so there was nothing to gain.
    //
    // On the BODY path it has a different job: the body scrolls, and capture is
    // what stops it scrolling under a drag that began inside it.
    render(<Sheet onDismiss={vi.fn()} at={0} />)
    const sheet = el('sheet')
    const claimed = []
    sheet.setPointerCapture = (id) => claimed.push(id)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(360))
    })
    expect(claimed, 'a drag from the grab bar captured the pointer, which kills the press that follows').toEqual([])
    await act(async () => { fireEvent.pointerUp(window, pointer(360)) })

    await act(async () => {
      fireEvent.pointerDown(el('body'), pointer(400))
      fireEvent.pointerMove(window, pointer(420))
    })
    expect(claimed.length, 'a drag begun in the body did not capture, so the body scrolls under it').toBe(1)
  })

  it('and lays the sheet out once, not once a frame', async () => {
    // THE TEAR. A height written per pointer event re-lays-out the sheet AND
    // re-blurs the scrim behind it, several times a frame on a pointer stream
    // finer than a frame. The box is sized ONCE, at the start of the gesture, and
    // every step after that is an offset.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => { fireEvent.pointerDown(el('grip'), pointer(400)) })
    const sized = heightOf(el('sheet'))
    const seen = new Set()
    for (const y of [380, 360, 340, 320, 300, 280]) {
      await act(async () => { fireEvent.pointerMove(window, pointer(y)) })
      await frame()
      seen.add(heightOf(el('sheet')))
    }
    expect([...seen], 'the sheet was laid out again during the drag, which is what re-blurs the screen behind it')
      .toEqual([sized])
    expect(shownOf(el('sheet')), 'the sheet did not track the finger').toBeGreaterThan(ANCHORS[0])
  })

  it('and survives the address bar collapsing under it', async () => {
    // A PHONE COLLAPSES ITS ADDRESS BAR THE MOMENT A GESTURE STARTS, which fires
    // `resize` — and the resize handler settled the sheet to an anchor, which
    // clears the offset and puts the box back to a resting height. Every frame
    // after that wrote an offset of zero, so the sheet stopped moving while the
    // finger kept going: a drag becoming impossible halfway through, on the
    // gesture a reader makes most.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(340))
    })
    await frame()
    const before = shownOf(el('sheet'))
    await act(async () => {
      window.innerHeight = VIEWPORT - 60
      fireEvent(window, new Event('resize'))
    })
    await act(async () => { fireEvent.pointerMove(window, pointer(300) ) })
    await frame()
    expect(shownOf(el('sheet')), 'the sheet stopped following the finger when the viewport changed')
      .toBeGreaterThan(before)
    expect(el('sheet').style.transform, 'the drag lost its offset, so the rest of the gesture moved nothing')
      .toMatch(/translateY/)
    window.innerHeight = VIEWPORT
  })

  it('and hands the height back when the finger lifts', async () => {
    // The resting sheet has to be its own size again: the body's scroll extent,
    // the edge fades and every screenshot read it. And no frame may carry both —
    // the offset is cleared in the same write as the height.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(300))
    })
    await frame()
    await act(async () => { fireEvent.pointerUp(window, pointer(300)) })
    expect(el('sheet').style.transform, 'the sheet is still offset after the drag ended').toBeFalsy()
    expect(ANCHORS, 'the release did not land on an anchor').toContain(heightOf(el('sheet')))
  })

  it('and never stands the blur down to pay for itself', () => {
    // THE OTHER HALF OF THE OWNER'S SENTENCE: "often the background blur is
    // removed for a second". That was deliberate — `.tp-scrim.is-dragging` set
    // `backdrop-filter: none` so the compositor would stop re-blurring a screen
    // it was being asked to re-blur every frame. An optimisation a reader can see
    // is a defect, and with the drag no longer laying anything out there is
    // nothing behind the scrim changing for the blur to be recomputed from.
    for (const prop of ['backdrop-filter', '-webkit-backdrop-filter']) {
      expect(declaredIn('.tp-scrim.is-dragging').map((r) => r.decls[prop]?.value).filter(Boolean),
        `a drag switches ${prop} off, which a reader sees as the blur dropping out`)
        .toEqual([])
    }
  })
})

describe('what a drag does', () => {
  it('shows more of the sheet without laying it out again', async () => {
    // A SHEET THAT SLIDES IS A SHEET LEAVING: a reader dragging up is asking to
    // SEE MORE, and translating a fixed-height box shows the same rows further up
    // the screen instead. This case used to forbid `transform` outright for that
    // reason — and forbidding it is what made every frame of a drag write a
    // HEIGHT, which re-lays-out the sheet and re-blurs the scrim behind it. The
    // owner reported the result three times; the last report named both ends of
    // it in one sentence, the tear and the blur dropping out.
    //
    // SO THE RULE IS ABOUT WHAT A READER SEES, not about which property moves.
    // The box takes the TALLEST anchor for the length of the gesture, so its
    // content is laid out for the full height, and the offset decides how much of
    // it shows. More of the sheet appears as the finger rises, which is the thing
    // the old rule was protecting, and the frame costs a composite rather than a
    // layout.
    render(<Sheet onDismiss={vi.fn()} />)
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(300))
    })
    await frame()
    const s = el('sheet').style
    const tallest = Math.max(...ANCHORS)
    expect(heightOf(el('sheet')), 'the box is not laid out for its full height, so a drag up reveals nothing')
      .toBe(tallest)
    expect(s.transform, 'the drag wrote no offset, so nothing moved').toMatch(/translateY/)
    expect(shownOf(el('sheet')), 'the sheet did not follow the finger').toBeGreaterThan(ANCHORS[0])
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
    })
    await frame()
    await act(async () => { fireEvent.pointerUp(window, pointer(900)) })
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
  // A PRESS IS THREE EVENTS AND NOT ONE, and that is the whole of this rule.
  // A finger or a mouse delivers pointerdown, then pointerup, then click;
  // `fireEvent.click` on its own delivers the third and skips the two that make
  // the rule hard. The bar is deliberately live from the first pointerdown — it
  // has nothing else to be — so its RELEASE is where the sheet finds out whether
  // anything was actually dragged, and a press that asks only the click never
  // reaches that question. These cases press it the way a reader does.
  const press = (at = 400) => act(() => {
    fireEvent.pointerDown(el('grip'), pointer(at))
    fireEvent.pointerUp(window, pointer(at))
    fireEvent.click(el('grip'))
  })

  it('moves the sheet, because a button that does nothing is a dead control', () => {
    // A MOUSE HAS NO WAY TO DISCOVER A DRAG. The bar answers a drag and the arrow
    // keys; a press that did nothing would be the defect `make controls` was
    // written to catch, on the one control whose whole job is to say the sheet
    // moves.
    render(<Sheet onDismiss={vi.fn()} />)
    const start = heightOf(el('sheet'))
    press()
    expect(heightOf(el('sheet')), 'pressing the handle did nothing at all').toBeGreaterThan(start)
  })

  it('and a hand that is not perfectly still has still only pressed it', () => {
    // NOBODY HOLDS A THUMB AT ONE PIXEL. A press that wanders a little is a press,
    // and the line between one and a drag is the same four pixels that decide
    // whether a touch in the BODY was a drag or a tap on a row — one number, so
    // the sheet does not answer to two different ideas of "held still".
    render(<Sheet onDismiss={vi.fn()} />)
    const start = heightOf(el('sheet'))
    act(() => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(402))
      fireEvent.pointerUp(window, pointer(402))
      fireEvent.click(el('grip'))
    })
    expect(heightOf(el('sheet')), 'two pixels of hand shake cost the press its answer')
      .toBeGreaterThan(start)
  })

  it('and comes back to the smallest anchor from the top rather than stopping there', () => {
    render(<Sheet onDismiss={vi.fn()} />)
    press()
    // THE WRAP IS ONLY TESTED FROM THE TOP. A first press that moved nothing
    // leaves the sheet at the smallest anchor, where the second press's answer is
    // indistinguishable from no answer at all — the case would pass on a bar that
    // does nothing whatever.
    expect(heightOf(el('sheet')), 'the first press did not reach the tallest anchor, so the wrap is untested')
      .toBe(ANCHORS[ANCHORS.length - 1])
    press()
    expect(heightOf(el('sheet')), 'the press stopped answering once the sheet was tallest')
      .toBe(ANCHORS[0])
  })

  it('and a drag that ends on the bar does not also count as a press', async () => {
    // A POINTER SEQUENCE THAT ENDS WHERE IT STARTED FIRES `click` AFTER
    // `pointerup`. Without the guard, letting go of the bar steps the sheet again
    // — past wherever the reader just put it, every single drag.
    render(<Sheet onDismiss={vi.fn()} />)
    // FAR ENOUGH THAT THE ANCHOR IS NOT IN DOUBT. `fireEvent` can deliver both
    // moves in one tick, which leaves the release with no measurable speed — so a
    // drag that stops between two stops would settle by a hair and this case
    // would be reading the coin toss rather than the guard.
    await act(async () => {
      fireEvent.pointerDown(el('grip'), pointer(400))
      fireEvent.pointerMove(window, pointer(280))
    })
    await frame()
    await act(async () => { fireEvent.pointerUp(window, pointer(280)) })
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
