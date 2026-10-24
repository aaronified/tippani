// The cover picker's candidate strip, and the one thing about it that cannot be
// seen from either side alone.
//
// A CANDIDATE HAS TWO ADDRESSES. The catalogue sources hand back one, and the
// picture sources hand back two — a thumbnail on a host the page's img-src
// allows, and the full-size original on whatever host the picture actually lives
// on. The strip must DRAW the first and STAGE the second. Drawing the original
// is a blocked frame the reader cannot choose; staging the thumbnail saves a
// 150-pixel cover into a library whose whole point is the picture.
//
// This file exists because that split had no test at all: the mutation pass
// after it was written flipped both halves and every suite still passed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let LOOKUP
let IMAGES
let PREVIEW_OK = true
// The preview waits on this, so a case can hold one in flight.
let PREVIEW_GATE = Promise.resolve()

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path === '/books/lookup') return { ok: true, data: { candidates: LOOKUP } }
    if (path === '/images/search') return { ok: true, data: { images: IMAGES, sources: { google: true, amazon: true } } }
    if (path === '/images/preview') {
      await PREVIEW_GATE
      return PREVIEW_OK ? { ok: true, data: { image: 'data:image/png;base64,AAAA' } } : { ok: false, status: 502, data: { error: 'no' } }
    }
    return { ok: true, data: {} }
  }),
  upload: vi.fn(async (path) => {
    SENT.push({ method: 'UPLOAD', path })
    return { ok: true, data: {} }
  }),
  DEMO: false,
}))

const { CoverControls } = await import('../../src/CoverPicker.jsx')

function mount(props = {}) {
  const onSetUrl = vi.fn()
  render(
    <CoverControls
      kind="books"
      id={1}
      currentPath=""
      coverUrl=""
      clearCover={false}
      onSetUrl={onSetUrl}
      onClear={() => {}}
      onUploaded={() => {}}
      search={{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' }}
      {...props}
    />,
  )
  return onSetUrl
}

const searchButton = () => screen.getByLabelText(/Search covers/i)

// jsdom decodes nothing, so the browser's Image is stubbed to give a picture the size a case
// names. A chosen address is measured before the screen hears of it, so every case that
// chooses one needs a shape.
const picturesAre = (w, h) => {
  vi.stubGlobal('Image', class {
    set src(_) {
      this.naturalWidth = w
      this.naturalHeight = h
      setTimeout(() => this.onload?.())
    }
  })
  HTMLCanvasElement.prototype.toBlob = (done) => done(new Blob(['framed'], { type: 'image/jpeg' }))
}
afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  SENT = []
  LOOKUP = []
  IMAGES = []
  PREVIEW_OK = true
  PREVIEW_GATE = Promise.resolve()
  cleanup()
})

// CHOOSING A COVER, THEN FRAMING IT, WITHOUT SAVING IN BETWEEN.
//
// What a person would say: I searched, I picked one, and I could move it about in the
// poster's frame right then — and when I was happy it was the cover, with no Save to
// hunt for. What the test knows, declared: the picture is only an address until the
// form is saved, so the page asks the server for its bytes (POST /images/preview — the
// page may not load the address itself) and keeps the result by the ordinary upload
// (POST /books/1/cover); jsdom decodes nothing, so the browser's Image is stubbed to
// give a picture the size a case names.
describe('framing a cover as it is chosen', () => {
  const choose = async () => {
    IMAGES = [{ url: 'https://pics.test/dune-full.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' }]
    const onUploaded = vi.fn()
    const onSetUrl = mount({ onUploaded })
    fireEvent.click(searchButton())
    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.click(img.closest('button'))
    return { onUploaded, onSetUrl }
  }
  const uploads = () => SENT.filter((s) => s.method === 'UPLOAD')

  it('keeps the framed picture as the cover, with no Save pressed', async () => {
    picturesAre(1600, 900)
    const { onUploaded } = await choose()
    await screen.findByText(/^Frame — /)
    await screen.findByRole('slider', { name: /zoom/i })
    const tick = () => [...document.querySelectorAll('button')].find((b) => b.getAttribute('type') === 'submit')
    await waitFor(() => expect(tick()?.disabled).toBe(false))
    fireEvent.click(tick())
    await waitFor(() => expect(uploads().map((u) => u.path)).toEqual(['/books/1/cover']))
    await waitFor(() => expect(onUploaded).toHaveBeenCalled())
  })

})
