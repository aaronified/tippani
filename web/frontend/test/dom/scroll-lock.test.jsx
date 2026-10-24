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
import { cleanup, render } from '@testing-library/react'

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

})
