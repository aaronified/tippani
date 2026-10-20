// The share dialog's Signature option, as a reader meets it.
//
// What a person would say: if somebody credited on this quote has a signature, the
// picture offers it, off to begin with, and turning it on puts it on the card; if
// nobody credited has one the option is not there; and a card showing the CHARACTER
// instead of the actor offers none, because a character signed nothing.
//
// WHAT THIS KNOWS, declared: the dialog's own props (a share built by bookShare or
// movieQuoteShare from a name→person map, the shape GET /people answers), the words
// on the screen, and what is stamped on the card canvas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ShareDialog, bookShare } from '../../src/share.jsx'
import { t } from '../../src/i18n.js'

let stamps
function recorder() {
  const ctx = {
    globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textBaseline: '',
    letterSpacing: '0px', shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    globalCompositeOperation: 'source-over',
    measureText: (s) => ({ width: String(s).length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    save() {}, restore() {}, scale() {}, clip() {}, stroke() {}, fill() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
    fillRect() {}, fillText() {},
    // A canvas stamped with a destination rectangle is a signature (or a portrait
    // backdrop, which these cases never switch on).
    drawImage: (...a) => { if (a[0] instanceof HTMLCanvasElement && a.length === 5) stamps.push(a) },
  }
  return ctx
}

beforeEach(() => {
  stamps = []
  localStorage.clear()
  const seen = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!seen.has(this)) seen.set(this, recorder())
    return seen.get(this)
  })
  Object.defineProperty(globalThis.Image.prototype, 'width', { value: 300, configurable: true })
  Object.defineProperty(globalThis.Image.prototype, 'height', { value: 100, configurable: true })
})
afterEach(() => cleanup())

const JANE = { name: 'Jane Solo', image_path: '', signature_path: 'aaaaaaaaaaaaaaaa.png' }

const shareBy = (people, extra = {}) => bookShare({
  quote: 'Only in silence the word', author: 'Jane Solo', title: 'A Book', people, ...extra,
})

// One chip in the picture's row of options, pressed when on.
const option = () => screen.queryByRole('button', { name: t('share.image.signature.info.title') })
const pressed = (el) => el.getAttribute('aria-pressed')

async function open(share) {
  render(<ShareDialog share={share} onClose={() => {}} />)
  // The picture panel is up when its preview is; not every case has a colour or a
  // signature switch to wait for.
  await screen.findByLabelText(t('share.image.preview.aria'))
}

describe("the picture's signature option", () => {
  it('is not offered when nobody credited has a signature', async () => {
    await open(shareBy({ 'Jane Solo': { name: 'Jane Solo', image_path: '', signature_path: '' } }))
    expect(option()).toBeNull()
  })

  it('starts off, and the card carries no signature', async () => {
    await open(shareBy({ 'Jane Solo': JANE }))
    expect(pressed(option())).toBe('false')
    // Give the card time to draw, then check nothing was stamped.
    await new Promise((r) => setTimeout(r, 50))
    expect(stamps).toHaveLength(0)
  })

  it('stamps the signature on the card once switched on, and takes it off again', async () => {
    await open(shareBy({ 'Jane Solo': JANE }))
    fireEvent.click(option())
    await waitFor(() => expect(stamps.length).toBeGreaterThan(0))

    const before = stamps.length
    fireEvent.click(option())
    await new Promise((r) => setTimeout(r, 50))
    // Redrawn without it: nothing new stamped after the switch back.
    expect(stamps.length).toBe(before)
  })

  it('remembers being switched on', async () => {
    localStorage.setItem('tippani:shareSignature', 'true')
    await open(shareBy({ 'Jane Solo': JANE }))
    expect(pressed(option())).toBe('true')
    await waitFor(() => expect(stamps.length).toBeGreaterThan(0))
  })

  it('is not offered on a card showing the character, who signed nothing', async () => {
    localStorage.setItem('tippani:shareFaceKind', JSON.stringify('character'))
    await open(shareBy({ 'Jane Solo': JANE }, {
      characterImages: [{ name: 'The Hero', path: 'bbbbbbbbbbbbbbbb.jpg' }],
    }))
    expect(option()).toBeNull()
  })
})
