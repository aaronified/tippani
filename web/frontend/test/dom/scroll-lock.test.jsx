// A dialog is open. The page behind it does not move.
//
// The other half of scroll containment, and the half CSS cannot do. `contain`
// stops a scroll that STARTED inside the overlay from chaining out of it; it
// says nothing about a wheel over the 40px of dimmed page beside a centred
// dialog, or a swipe on a phone that never lands on the sheet at all. For that
// the body has to be frozen while the overlay is up.
//
// Eleven full-viewport overlays; four of them froze it. The other seven did not,
// which is a bug with no symptom until you close the dialog and find yourself
// somewhere in the list you never scrolled to.
//
// The assertion is on document.body.style.overflow because that is what
// useBodyScrollLock sets and therefore what actually reaches the browser. A test
// that asserted "the hook was called" would pass for a hook wired to the wrong
// prop, which is the failure mode a conditional dialog invites.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
  DEMO: false,
}))

const { ConfirmDialog } = await import('../../src/ui.jsx')
const { ShareDialog, bookShare } = await import('../../src/share.jsx')

const locked = () => document.body.style.overflow === 'hidden'

beforeEach(() => {
  document.body.style.overflow = ''
})

describe('an overlay freezes the page behind it', () => {
  it('ShareDialog locks while it is up and releases when it goes', () => {
    // Release matters as much as lock: a leaked lock is a page that can never
    // be scrolled again until reload, and it looks exactly like a hang.
    const { unmount } = render(<ShareDialog share={bookShare({ quote: 'x', author: 'y' })} onClose={() => {}} />)
    expect(locked(), 'the page was not frozen').toBe(true)
    unmount()
    expect(locked(), 'the lock outlived the dialog').toBe(false)
  })

  it('ConfirmDialog tracks its own open prop, not its mounting', () => {
    // It renders null when closed but is mounted throughout, so it is the one
    // dialog whose lock cannot be a constant — and a hook that cannot be
    // conditional is exactly where `true` gets written by reflex.
    const { rerender } = render(<ConfirmDialog open={false} title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />)
    expect(locked(), 'a closed dialog froze the page').toBe(false)
    rerender(<ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />)
    expect(locked()).toBe(true)
    rerender(<ConfirmDialog open={false} title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />)
    expect(locked(), 'closing did not release the page').toBe(false)
  })

  it('stays locked while two overlays are stacked', () => {
    // The counter is the reason this is ref-counted rather than a boolean: a
    // confirm opened from inside a share dialog must not unlock the share
    // dialog on its way out.
    render(<ShareDialog share={bookShare({ quote: 'x', author: 'y' })} onClose={() => {}} />)
    const inner = render(<ConfirmDialog open title="t" body="b" onConfirm={() => {}} onCancel={() => {}} />)
    expect(locked()).toBe(true)
    inner.unmount()
    expect(locked(), 'the inner dialog closing unlocked the outer one').toBe(true)
    cleanup()
    expect(locked()).toBe(false)
  })

  it('is on the dialog, not on the screen that opened it', () => {
    // Sanity: nothing about rendering an ordinary element freezes the page, so
    // the assertions above are reading a real signal rather than a default.
    render(<div>an ordinary screen</div>)
    expect(screen.getByText('an ordinary screen')).toBeTruthy()
    expect(locked()).toBe(false)
  })
})
