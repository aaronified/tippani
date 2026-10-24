// The share dialog's two standing decisions: what the picture assumes about the
// quote's colour, and where the explanatory prose lives.
//
// Both are the kind of thing that has no failure. A card that carries a colour
// nobody asked it to carry renders perfectly; four lines of syntax reference
// above the fold on a phone lay out perfectly. They are only wrong once somebody
// looks at the result, which is after it has been sent.
//
// The colour default is tested through the CANVAS rather than through the
// toggle's markup. A control reading "Off" while the drawing code carries on
// tinting is a state desync, not a labelling slip, and asserting the switch
// position alone would pass for it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ShareDialog, bookShare } from '../../src/share.jsx'
import { categoryHex } from '../../src/theme.js'

// The recorder only has to answer one question — what was filled, and with what
// — so it records the style in force at each fill(). The colour edge is the one
// rounded rect filled with the quote's own hex.
let fills
function recorder() {
  const ctx = {
    globalAlpha: 1,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
    letterSpacing: '0px',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    globalCompositeOperation: 'source-over',
    measureText: (t) => ({ width: String(t).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, scale() {}, clip() {}, stroke() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    drawImage() {}, fillRect() {}, fillText() {},
    fill: () => fills.push(ctx.fillStyle),
  }
  return ctx
}

beforeEach(() => {
  fills = []
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) seen.set(this, recorder())
    return seen.get(this)
  })
})

const BLUE = categoryHex('blue')

const share = () =>
  bookShare({
    quote: 'Only in silence the word',
    author: 'Ursula K. Le Guin',
    title: 'A Wizard of Earthsea',
    color: 'blue',
  })

// The Image panel is what the dialog opens on, so this renders and waits rather
// than selecting a format first. The colour switch is the panel's own control, so
// finding it is how we know the panel is up.
async function openImage() {
  render(<ShareDialog share={share()} onClose={() => {}} />)
  return await screen.findByRole('button', { name: 'Quote colour' })
}

const drewTheColour = () => fills.includes(BLUE)

const pressed = (el) => el.getAttribute('aria-pressed')

describe("the picture's colour switch", () => {
  it('starts off, and the card is drawn without the colour', async () => {
    const chip = await openImage()
    expect(pressed(chip)).toBe('false')
    await waitFor(() => expect(fills.length).toBeGreaterThan(0))
    expect(drewTheColour(), 'the colour edge was drawn anyway').toBe(false)
  })

  it('remembers being switched on', async () => {
    localStorage.setItem('tippani:shareImageTint', 'true')
    expect(pressed(await openImage())).toBe('true')
    await waitFor(() => expect(drewTheColour()).toBe(true))
  })

})

