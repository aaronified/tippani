// What the share picture assumes about the quote's colour.
//
// This is the kind of thing that has no failure. A card that carries a colour
// nobody asked it to carry renders perfectly, downloads perfectly and opens
// perfectly. It is only wrong once somebody looks at it, which is after it has
// been sent.
//
// The colour default is tested through the CANVAS rather than through the
// toggle's markup. A control reading "Off" while the drawing code carries on
// tinting is a state desync, not a labelling slip, and asserting the switch
// position alone would pass for it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// The Image panel only exists once Image is the chosen format.
async function openImage() {
  render(<ShareDialog share={share()} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Image' }))
  return await screen.findByRole('tab', { name: 'Off' })
}

const drewTheColour = () => fills.includes(BLUE)
const selected = (el) => el.getAttribute('aria-selected')

describe("the picture's colour switch", () => {
  it('starts off, and the card is drawn without the colour', async () => {
    const off = await openImage()
    expect(selected(off)).toBe('true')
    expect(selected(screen.getByRole('tab', { name: 'On' }))).toBe('false')
    await waitFor(() => expect(fills.length).toBeGreaterThan(0))
    expect(drewTheColour(), 'the colour edge was drawn anyway').toBe(false)
  })

  it('still puts the colour on the card when it is switched on', async () => {
    // The complement, and the reason this is a default and not a removal. A
    // change of default that quietly broke the feature would otherwise read as
    // a pass.
    await openImage()
    fireEvent.click(screen.getByRole('tab', { name: 'On' }))
    await waitFor(() => expect(drewTheColour()).toBe(true))
  })

  it('remembers being switched on', async () => {
    localStorage.setItem('tippani:shareImageTint', 'true')
    await openImage()
    expect(selected(screen.getByRole('tab', { name: 'On' }))).toBe('true')
    await waitFor(() => expect(drewTheColour()).toBe(true))
  })

  it('is not turned back on by what the old switch had written down', async () => {
    // THE MECHANISM, not a detail of it. usePersistedState writes on mount, so
    // the previous default was stamped into local storage by the first render of
    // this panel on every device that ever opened it — meaning flipping the
    // literal alone changes the default for nobody who has used the app. That
    // "fix" passes every other test in this file and nothing at all in practice,
    // which is exactly why the retired key is named here in full.
    localStorage.setItem('tippani:shareImageColor', 'true')
    const off = await openImage()
    expect(selected(off)).toBe('true')
    await waitFor(() => expect(fills.length).toBeGreaterThan(0))
    expect(drewTheColour()).toBe(false)
  })
})
