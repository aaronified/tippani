// A PANEL THAT OPENS ANOTHER PANEL, which is what half the app's doors are.
//
// THE BUG THIS PINS, and it was found by pressing every control on the character
// sheet rather than by any test. `stack.open()` REPLACES what is open rather than
// deepening it, so it first walks history back and then pushes:
//
//     if (n > 0) window.history.go(-n)
//     requestAnimationFrame(() => push(panel))
//
// The comment above those two lines said "the push waits for the pop to land". A
// frame callback does not do that. `requestAnimationFrame` fires before the next
// paint; `popstate` is dispatched by the browser on its own schedule, and the
// frame wins. So the push landed FIRST, the pop arrived second carrying
// `tpPanelDepth: 0`, and the stack's own popstate handler truncated away the
// panel that had just been opened.
//
// WHAT IT COST, measured in a browser on one screen: "Open the global record",
// the performer's name and the person picker all CLOSED the sheet and opened
// nothing. Three controls that read as never built, from one line. Every open()
// called from INSIDE a panel had it — which is why a surface reached straight off
// a card always worked and a surface a panel offers never did.
//
// WHY NO TEST CAUGHT IT, AND WHY THIS FILE STILL DOES NOT. The suite's panel
// tests all open from a screen with nothing already open, where `n === 0` and the
// race cannot happen — so the second open was simply never exercised. This file
// exercises it, and that is worth having: it pins that open() REPLACES rather
// than deepens, and that both paths (nothing open, something open) end with the
// new panel on screen.
//
// But it does NOT guard the race, and saying so is the point. Written against the
// shipped `requestAnimationFrame` version these three cases still pass, because
// jsdom's `history.go` dispatches popstate on a schedule that does not lose to a
// frame callback. The ordering that breaks is Chromium's.
//
// THE BROWSER PROBE DOES GUARD IT. `scripts/screenshots/panel-depth.mjs`
// presses a panel's own door in Chromium and, against the rAF version on a
// freshly rebuilt binary, fails five runs out of five with "left NOTHING open
// (depth 0)". So this file pins the replace-not-deepen contract and that one
// pins the ordering; neither stands in for the other.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { PanelHost, usePanelStack } from '../../src/ui.jsx'

function Harness() {
  const stack = usePanelStack()
  const second = {
    title: 'The second panel',
    render: () => <p>second body</p>,
  }
  const first = {
    title: 'The first panel',
    render: () => (
      <button type="button" onClick={() => stack.open(second)}>go deeper</button>
    ),
  }
  return (
    <>
      <button type="button" onClick={() => stack.open(first)}>open the first</button>
      <PanelHost stack={stack} />
    </>
  )
}

beforeEach(() => {
  // Each case starts from a history with no panel depth in it, or the stack's
  // unmount walk-back from the previous one leaks into this one.
  window.history.replaceState({}, '')
})

describe('a panel opening another panel', () => {
  it('leaves the second one on screen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open the first'))
    await waitFor(() => expect(screen.getByText('go deeper')).toBeTruthy())

    await user.click(screen.getByText('go deeper'))

    // THE ASSERTION THE RACE FAILED. With the frame-callback push, both of these
    // were false a moment later: the second panel had been pushed and then
    // truncated away, leaving nothing open at all.
    await waitFor(() => expect(screen.getByText('second body')).toBeTruthy())
    expect(screen.queryByText('go deeper')).toBeNull()
  })

  it('replaces rather than deepens, so Back does not walk a phantom stack', async () => {
    // open() is "show me this", not "and remember where I was" — the depth after
    // two opens must be one, or the reader's Back key answers a panel they never
    // saw. This is the property the history walk-back exists FOR, and it has to
    // survive the fix that made the push land.
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open the first'))
    await waitFor(() => expect(screen.getByText('go deeper')).toBeTruthy())
    await user.click(screen.getByText('go deeper'))
    await waitFor(() => expect(screen.getByText('second body')).toBeTruthy())
    expect(window.history.state?.tpPanelDepth).toBe(1)
  })

  it('still opens the first one from a screen with nothing open', async () => {
    // The case the suite already had, kept: n === 0 takes the direct path now
    // rather than going through the listener, and both have to work.
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('open the first'))
    await waitFor(() => expect(screen.getByText('go deeper')).toBeTruthy())
    expect(window.history.state?.tpPanelDepth).toBe(1)
  })
})
