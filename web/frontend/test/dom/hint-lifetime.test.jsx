// Labels that go away.
//
// Two bugs, one symptom — "the tooltips stick on desktop, forever" — and they
// are in different components for different reasons, so they are pinned
// separately here.
//
// 1. THE HOVER BUBBLE HAD NO CAP UNLESS ITS OPENER SET ONE. `Tooltip` scheduled
//    a three-second close for itself; `Toggle`, the only other thing that opens
//    a bubble, scheduled nothing. So a toggle's label closed on pointerleave and
//    on nothing else — and pointerleave is not a promise. The control re-renders
//    under the pointer, a panel opens over it, a row reflows, and the label sits
//    there for the rest of the session. A cap that one of two callers remembers
//    is not a cap, so it moved into the host every bubble passes through.
//
// The INFO DOT is not that bug and must not be "fixed" into one. A dot you have
// clicked is MEANT to stay until you click it again — that is what pinning is
// for, so that text you want to re-read or copy does not evaporate when the
// pointer drifts. I briefly made its click a plain toggle against `open`, which
// closed a hover-opened popover on the very click that was asking it to stay.
// The cases below pin the intended behaviour so that cannot happen again.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { InfoDot, Toggle, Tooltip, ToastHost } from '../../src/ui.jsx'

const HOVER_HIDE_MS = 3000
// The hover-intent delay a pointer must outlast before a label appears at all
// (HOVER_TIP_MS in ui.jsx). Not imported, deliberately: a test that reads the same
// constant the code does cannot tell you the number changed, and this suite is
// about the timings a reader actually experiences.
const HOVER_TIP_MS = 400

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

const bubble = () => document.querySelector('.hint-bubble, .tp-hint, [data-hint]')
const bubbleText = () => bubble()?.textContent || ''
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms) })

describe('a hovered label closes itself', () => {

  // THE ONE THAT WAS BROKEN. Toggle opens its option labels by calling showHint
  // directly, and never set a timer of its own.
  it('from a Toggle option, which used to have no timer at all', () => {
    render(
      <>
        <ToastHost />
        <Toggle
          ariaLabel="Labels"
          value="off"
          onChange={() => {}}
          options={[['off', 'No', 'Hide the words'], ['on', 'Yes', 'Show the words']]}
        />
      </>,
    )
    const opt = screen.getByRole('tab', { name: 'No' })
    fireEvent.pointerEnter(opt, { pointerType: 'mouse' })
    act(() => {})
    expect(bubbleText()).toContain('Hide the words')
    // The pointer never leaves — that is the whole failure. The control could
    // re-render, get covered, or simply be left behind, and no leave arrives.
    tick(HOVER_HIDE_MS + 50)
    expect(bubbleText()).not.toContain('Hide the words')
  })
})

// THE DELAY HAS TO TEST INTENT, NOT ARRIVAL.
//
// The report: "if i am moving my mouse over the top bar, quite fast to not hover
// for enough so that the tooltip doesn't appear, it still appears and is lagging
// behind ... the hover delay is thus rendered useless". The clock started on
// pointerenter and nothing but pointerleave stopped it — so when that leave was
// late (a busy main thread, coalesced pointer events, a control moving under the
// cursor) the clock finished anyway and a label arrived for a control the
// pointer had long since crossed.
describe('the hover delay', () => {
  // ToastHost, because the bubble is drawn by the shared hint slot and not by
  // the wrapper — see the top of this file.
  const mount = () => {
    render(
      <>
        <ToastHost />
        <Tooltip label="Search">
          <button type="button">go</button>
        </Tooltip>
      </>,
    )
    return screen.getByRole('button')
  }
  const move = (el, x, y) =>
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: x, clientY: y })
  const enter = (el, x, y) =>
    fireEvent.pointerEnter(el, { pointerType: 'mouse', clientX: x, clientY: y })

  it('shows nothing while the pointer is still travelling', async () => {
    vi.useFakeTimers()
    try {
      const el = mount()
      enter(el, 100, 100)
      // A sweep: each step is beyond the slop, so the clock never completes —
      // and this is true whether or not a pointerleave ever arrives, which is
      // the whole point.
      for (let i = 1; i <= 6; i++) {
        await act(async () => { vi.advanceTimersByTime(300) })
        move(el, 100 + i * 40, 100)
      }
      await act(async () => { vi.advanceTimersByTime(399) })
      expect(document.body.textContent).not.toContain('Search')
    } finally {
      vi.useRealTimers()
    }
  })

})
