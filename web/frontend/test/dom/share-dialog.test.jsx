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

describe('the prose in the share dialog', () => {
  const logicOf = (name) => screen.queryByText((t) => t.startsWith(name))

  it('keeps a format’s syntax behind its dot rather than above the quote', async () => {
    render(<ShareDialog share={share()} onClose={() => {}} />)
    // WhatsApp is the opening format; its syntax reference is reachable, not
    // resident.
    expect(logicOf('WhatsApp chat formatting')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More information: WhatsApp' }))
    expect(logicOf('WhatsApp chat formatting')).not.toBeNull()
    // "the formatter suggestions as well" — the mono token sample went in with
    // the sentence it belongs to, not left behind on its own.
    expect(screen.getByText((t) => t.includes('~strike~')).className).toContain('share-hint')
  })

  it('re-titles the dot with whichever format is chosen', async () => {
    // An anonymous i beside a control whose meaning it depends on is a dot you
    // have to open to find out whether it was worth opening. It also has to
    // change: a dot still announcing "WhatsApp" after Markdown is selected is
    // worse than an unnamed one.
    render(<ShareDialog share={share()} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Markdown' }))
    expect(screen.queryByRole('button', { name: 'More information: WhatsApp' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More information: Markdown' }))
    expect(logicOf('Rich Markdown')).not.toBeNull()
  })

  it('explains the picture, and its skin, the same way', async () => {
    await openImage()
    // Image has no syntax, so its dot answers the other question — what is this
    // thing — and the theme picker's "doesn't change the app" caveat, which is
    // the one people actually need, is a dot rather than a grey aside.
    fireEvent.click(screen.getByRole('button', { name: 'More information: Image' }))
    expect(logicOf('A picture of the quote')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More information: Image' })) // close
    fireEvent.click(screen.getByRole('button', { name: 'More information: Image theme' }))
    expect(logicOf('Which of the four skins')).not.toBeNull()
  })
})
