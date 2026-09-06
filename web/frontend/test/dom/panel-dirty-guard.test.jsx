// A dismissal must not discard what you typed.
//
// The Details panel is a stack of self-saving rows: you open one, type, press ✓,
// open the next. Every way OUT of it was unconditional — the ✕, the scrim,
// Escape, the back gesture — so a reader with three rows open and typed into lost
// all three to one click outside the panel. No question, no toast, nothing.
//
// The machinery to know better already existed and was never read on the way out.
// `useUnsavedFields` keeps a registry of dirty rows and reports a count, and the
// panel header already used it to decide whether to draw the ✓. It just never
// reached the close routes.
//
// So what is pinned here is the arbitration, not the dialog: with nothing to
// lose every route still closes at once, and with something to lose every route
// asks first — including Escape, which is the fastest of them and the one most
// likely to be pressed by reflex.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormHostContext, PanelHost, useFormHost, usePanelStack } from '../../src/ui.jsx'
import { resetPanelHistory } from '../panel-harness.jsx'
import { useContext, useEffect } from 'react'

// A panel body that reports N dirty rows, the way WorkDetails does.
function Body({ dirty }) {
  const host = useFormHost('')
  useEffect(() => {
    host?.setDirty?.(dirty)
    return () => host?.setDirty?.(0)
  }, [host, dirty])
  return <p>the panel body</p>
}

function Harness({ dirty = 0, onClosed = () => {} }) {
  const stack = usePanelStack()
  useEffect(() => {
    stack.open({ title: 'Details', render: () => <Body dirty={dirty} /> })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (stack.stack.length === 0) onClosed()
  }, [stack.stack.length, onClosed])
  return <PanelHost stack={stack} />
}

const scrim = () => document.querySelector('.tp-panel-scrim')
// WAIT FOR THE COUNT TO HAVE LANDED, not for a timer. `stack.open()` walks
// history back before it pushes, so the panel settles over more than one commit
// and the content publishes its count somewhere in there. `data-dirty` on the
// panel is that state made visible; without it a test can only sleep and hope.
const settled = (n) => waitFor(() => expect(document.querySelector(`[data-dirty="${n}"]`)).toBeTruthy())
const panel = () => document.querySelector('.tp-panel')
const esc = () => fireEvent.keyDown(document, { key: 'Escape' })
const clickAway = () => fireEvent.mouseDown(scrim(), { target: scrim() })

// AND THE FOURTH WAY OUT, added when the panel became a bottom sheet on a phone:
// "scrolling down will close the popup now (which becomes an intuitive thing).
// any edits pending save will trigger the same warning as it does now." A second
// exit that skips the question is not a convenience, it is a way to lose typing,
// so it belongs in this file rather than beside the gesture that implements it.
//
// The gesture only exists where the panel IS a sheet, so the phone query has to
// hold; the setup's matchMedia answers false to everything.
const phone = () => { window.matchMedia = (media) => ({
  matches: media.includes('768'), media, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  dispatchEvent: () => false,
}) }
const body = () => document.querySelector('.tp-panel-body')
const dragDown = (by = 160) => {
  const el = body()
  const at = (y) => ({ touches: [{ clientY: y, identifier: 1, target: el }] })
  fireEvent.touchStart(el, at(120))
  fireEvent.touchMove(el, at(120 + by))
}

const realMatchMedia = window.matchMedia
beforeEach(() => { window.matchMedia = realMatchMedia })
afterEach(() => {
  cleanup()
  resetPanelHistory()
  window.matchMedia = realMatchMedia
})

describe('with nothing unsaved', () => {
  it('closes on a click outside, with no question', async () => {
    render(<Harness dirty={0} />)
    expect(await screen.findByText('the panel body')).toBeTruthy()
    clickAway()
    // NO QUESTION IS THE CLAIM. The close itself is history-driven — the stack
    // walks `window.history` back exactly as far as it pushed — so its absence
    // arrives a frame later and is awaited rather than asserted on the spot.
    expect(screen.queryByText(/Leave without saving/), 'it asked about nothing').toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
  })

  it('closes on a drag back down, with no question', async () => {
    phone()
    render(<Harness dirty={0} />)
    await screen.findByText('the panel body')
    dragDown()
    expect(screen.queryByText(/Leave without saving/), 'it asked about nothing').toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
  })

  it('closes on Escape, with no question', async () => {
    render(<Harness dirty={0} />)
    await screen.findByText('the panel body')
    esc()
    expect(screen.queryByText(/Leave without saving/)).toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
  })
})

// AND THE PANEL DRAWS ITS OWN WAY BACK UP, which is a fact about the RENDER and
// not about the hook. The hook's own cases live in `focus-owns-the-scroll`; this
// one exists because the element went missing from `PanelHost` in the commit that
// described it, and every one of those hook cases stayed green — a rule tested
// only where it is decided is a rule nobody checks is wired.
describe('a panel that can be scrolled', () => {
  it('carries a key back to its own top', async () => {
    render(<Harness dirty={0} />)
    await screen.findByText('the panel body')
    expect(panel().querySelector('.to-top'),
      'the panel draws no way back up, so a long sheet is a one-way flick')
      .toBeTruthy()
  })

  it('and it is the panel\'s own, not the page\'s', async () => {
    render(<Harness dirty={0} />)
    await screen.findByText('the panel body')
    // The page's key is fixed to the viewport corner; this one belongs to the
    // card, so it has to be inside it.
    const keys = [...document.querySelectorAll('.to-top')]
    expect(keys.length, 'more than one key is on screen, offering two surfaces').toBe(1)
    expect(panel().contains(keys[0]), 'the key is outside the panel it answers to').toBe(true)
  })
})

describe('with work at stake', () => {
  it('asks instead of closing when you click outside', async () => {
    render(<Harness dirty={2} />)
    await settled(2)
    clickAway()
    expect(await screen.findByText(/Leave without saving/), 'it closed silently').toBeTruthy()
    // AND THE PANEL IS STILL THERE. A question that appears while the thing it
    // is about has already gone is not a question, it is a notification.
    expect(screen.getByText('the panel body')).toBeTruthy()
  })

  it('counts, because three fields is a different decision from one', async () => {
    render(<Harness dirty={3} />)
    await settled(3)
    clickAway()
    expect(await screen.findByText(/3 fields/)).toBeTruthy()
    cleanup()
    resetPanelHistory()
    render(<Harness dirty={1} />)
    await settled(1)
    clickAway()
    expect(await screen.findByText(/One field/)).toBeTruthy()
  })

  it('asks on Escape too — the route most likely to be pressed by reflex', async () => {
    render(<Harness dirty={1} />)
    await settled(1)
    esc()
    expect(await screen.findByText(/Leave without saving/)).toBeTruthy()
    expect(screen.getByText('the panel body')).toBeTruthy()
  })

  it('asks on a drag back down, which is the phone\'s ✕', async () => {
    phone()
    render(<Harness dirty={2} />)
    await settled(2)
    dragDown()
    expect(await screen.findByText(/Leave without saving/),
      'the sheet slid away and took two typed fields with it — a gesture is not a cheaper way out than the ✕')
      .toBeTruthy()
    expect(screen.getByText('the panel body'), 'the question appeared over a panel that had already gone').toBeTruthy()
  })

  it('asks on the ✕ as well, so no route is the cheap way out', async () => {
    render(<Harness dirty={1} />)
    await settled(1)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(await screen.findByText(/Leave without saving/)).toBeTruthy()
  })

  it('keeps the panel and the drafts when you say keep', async () => {
    render(<Harness dirty={1} />)
    await settled(1)
    clickAway()
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/Leave without saving/)).toBeNull()
    // A SLEEP, DELIBERATELY, and it is the one case that needs one. Every other
    // assertion here waits for something to APPEAR; this one has to prove
    // something does NOT happen, and the close it must not do is asynchronous —
    // the stack walks history back, which lands a frame or two later. Asserting
    // straight after the click passed even when "keep" closed the panel anyway,
    // which is a mutation I had to watch survive before I believed it.
    await new Promise((r) => setTimeout(r, 80))
    expect(screen.getByText('the panel body'), 'saying keep still closed the panel').toBeTruthy()
    expect(document.querySelector('[data-dirty="1"]'), 'the drafts were dropped').toBeTruthy()
  })

  it('closes for real when you say discard', async () => {
    const onClosed = vi.fn()
    render(<Harness dirty={1} onClosed={onClosed} />)
    await settled(1)
    clickAway()
    fireEvent.click(await screen.findByRole('button', { name: /discard/i }))
    expect(screen.queryByText(/Leave without saving/), 'the question stayed up').toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
    await waitFor(() => expect(onClosed).toHaveBeenCalled())
  })
})
