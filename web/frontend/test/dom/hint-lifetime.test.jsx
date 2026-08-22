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

describe('a hovered label waits to be asked', () => {
  // REPORTED: "use a slight delay before the tooltips. now they are instantaneous
  // and thus irritating." The irritation is not the label — it is the labels you
  // never wanted. Crossing the top bar to reach the ＋ passes over five controls,
  // and every one of them used to answer.
  it('says nothing at all on the frame the pointer arrives', () => {
    render(<><ToastHost /><Tooltip label="Copy this quote"><button type="button">c</button></Tooltip></>)
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' })
    act(() => {})
    expect(bubbleText(), 'the bubble is still instantaneous').not.toContain('Copy this quote')
    tick(HOVER_TIP_MS - 50)
    expect(bubbleText(), 'it arrived early').not.toContain('Copy this quote')
    tick(100)
    expect(bubbleText()).toContain('Copy this quote')
  })

  it('and nothing at all to a pointer that was only passing through', () => {
    // The whole point. Leaving before the delay elapses must cancel it rather than
    // let a bubble arrive over wherever the pointer went next.
    render(<><ToastHost /><Tooltip label="Copy this quote"><button type="button">c</button></Tooltip></>)
    const btn = screen.getByRole('button')
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    tick(HOVER_TIP_MS - 100)
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' })
    tick(HOVER_TIP_MS + 200)
    expect(bubbleText(), 'a label arrived after the pointer had gone').not.toContain('Copy this quote')
  })

  it('but answers a keyboard immediately, because tabbing IS the question', () => {
    // There is no passing over a control with a keyboard, so there is no intent
    // left to test and a delay would only be a pause between press and answer.
    render(<><ToastHost /><Tooltip label="Copy this quote"><button type="button">c</button></Tooltip></>)
    const btn = screen.getByRole('button')
    btn.matches = (sel) => sel === ':focus-visible'
    fireEvent.focus(btn)
    act(() => {})
    expect(bubbleText()).toContain('Copy this quote')
  })

  it('drops a pending label when the control is pressed', () => {
    // Pressing inside the delay must not leave a bubble to arrive afterwards, over
    // whatever the press just opened.
    render(<><ToastHost /><Tooltip label="Copy this quote"><button type="button">c</button></Tooltip></>)
    const btn = screen.getByRole('button')
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    tick(HOVER_TIP_MS - 100)
    fireEvent.click(btn)
    tick(HOVER_TIP_MS + 200)
    expect(bubbleText()).not.toContain('Copy this quote')
  })
})

describe('a hovered label closes itself', () => {
  it('from a Tooltip, after the cap', () => {
    render(<><ToastHost /><Tooltip label="Copy this quote"><button type="button">c</button></Tooltip></>)
    fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' })
    tick(HOVER_TIP_MS + 20) // the intent delay comes first now
    expect(bubbleText()).toContain('Copy this quote')
    tick(HOVER_HIDE_MS + 50)
    expect(bubbleText()).not.toContain('Copy this quote')
  })

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

describe('an info dot sticks when you click it, on purpose', () => {
  // A CLICK ON A HOVER-OPENED POPOVER PINS IT. It does not close it. Hover is
  // how you glance; the click is how you say "leave this up while I read it".
  it('pins a hover-opened popover rather than closing it', () => {
    render(<><ToastHost /><InfoDot text="What a colon does" title="Facets" /></>)
    const dot = screen.getByRole('button', { name: /More information/ })
    fireEvent.pointerEnter(dot, { pointerType: 'mouse' })
    act(() => {})
    expect(dot.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(dot)
    expect(dot.getAttribute('aria-expanded')).toBe('true')
    // And now the pointer can go anywhere: this is what pinning bought.
    fireEvent.pointerLeave(dot, { pointerType: 'mouse' })
    tick(10000)
    expect(dot.getAttribute('aria-expanded')).toBe('true')
  })

  it('and a second click is what closes it', () => {
    render(<><ToastHost /><InfoDot text="What a colon does" title="Facets" /></>)
    const dot = screen.getByRole('button', { name: /More information/ })
    fireEvent.click(dot)
    expect(dot.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(dot)
    expect(dot.getAttribute('aria-expanded')).toBe('false')
  })

  // The UNPINNED popover is the only one hover closes, and it does so on the
  // leave rather than on a timer — there is text in it, and a paragraph that
  // vanishes while you are reading it is worse than one you have to move away
  // from.
  it('closes an unclicked one when the pointer leaves', () => {
    render(<><ToastHost /><InfoDot text="What a colon does" title="Facets" /></>)
    const dot = screen.getByRole('button', { name: /More information/ })
    fireEvent.pointerEnter(dot, { pointerType: 'mouse' })
    act(() => {})
    expect(dot.getAttribute('aria-expanded')).toBe('true')
    fireEvent.pointerLeave(dot, { pointerType: 'mouse' })
    tick(1000)
    expect(dot.getAttribute('aria-expanded')).toBe('false')
  })
})
