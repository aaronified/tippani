// How many times one picture gets drawn.
//
// THE REPORT: "in share image, the backdrop process is taking a long time (like
// 2-3 seconds) ... the page freezes while it computes". The drawing itself is
// not the cost — a card measures ~18ms even with a photograph behind it — but it
// was being done FOUR times for one toggle: once immediately, then once more as
// each of the fonts, the faces and the material tile resolved. Three of those
// four are identical, land in the same microtask queue, and on a backdrop card
// each one resamples a full-resolution photograph (the picture search stages the
// ORIGINAL url on purpose) and runs a non-separable `color` blend across it.
//
// So this counts draws rather than timing them. A timing assertion measures the
// machine it runs on; the count is the defect, it is stable, and it is what a
// regression here would change.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let draws

vi.mock('../../src/quoteImage.js', async (orig) => {
  const real = await orig()
  return {
    ...real,
    drawQuoteCard: vi.fn((canvas) => {
      draws.push(1)
      canvas.width = 640
      canvas.height = 800
    }),
    ensureFonts: () => Promise.resolve(),
    loadFaceImages: () => Promise.resolve(),
    loadTileImage: () => Promise.resolve(),
  }
})

const { ShareDialog, bookShare } = await import('../../src/share.jsx')

beforeEach(() => {
  draws = []
  localStorage.clear()
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) seen.set(this, { scale() {}, save() {}, restore() {} })
    return seen.get(this)
  })
})

const share = () =>
  bookShare({ quote: 'Only in silence the word', author: 'Ursula K. Le Guin', title: 'A Wizard of Earthsea', color: 'blue' })

describe('the share preview', () => {
  it('draws the card twice for one change, not four times', async () => {
    render(<ShareDialog share={share()} onClose={() => {}} />)
    await screen.findByRole('tab', { name: 'Off' })
    await waitFor(() => expect(draws.length).toBeGreaterThan(0))

    // Let every already-resolved promise in the effect settle.
    await new Promise((r) => setTimeout(r, 0))
    const first = draws.length
    draws = []

    fireEvent.click(screen.getByRole('tab', { name: 'On' }))
    await waitFor(() => expect(draws.length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 0))

    // ONE immediate draw so the change is on screen at once, and ONE more when
    // the slowest of fonts/faces/tile is in. Four was the bug.
    expect(draws.length, `one toggle drew the card ${draws.length} times`).toBeLessThanOrEqual(2)
    expect(first, `opening the panel drew it ${first} times`).toBeLessThanOrEqual(2)
  })
})
