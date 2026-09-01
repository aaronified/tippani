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

import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(() => {
  cleanup()
  resetPanelHistory()
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

  it('closes on Escape, with no question', async () => {
    render(<Harness dirty={0} />)
    await screen.findByText('the panel body')
    esc()
    expect(screen.queryByText(/Leave without saving/)).toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
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
