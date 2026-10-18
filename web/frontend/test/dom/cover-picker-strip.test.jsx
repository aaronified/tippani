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

describe('the candidate strip', () => {
  it('asks the picture sources as well as the catalogue', async () => {
    LOOKUP = [{ cover_url: 'https://books.google.com/dune.jpg', source: 'google' }]
    mount()
    fireEvent.click(searchButton())
    await waitFor(() => expect(SENT.some((s) => s.path === '/images/search')).toBe(true))
    // And it asks for the right KIND of picture, with what it knows about the book.
    expect(SENT.find((s) => s.path === '/images/search').body).toMatchObject({
      kind: 'cover', title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593',
    })
  })

  it('draws the thumbnail and stages the original', async () => {
    picturesAre(800, 1200)
    IMAGES = [{ url: 'https://pics.test/dune-full.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' }]
    const onSetUrl = mount()
    fireEvent.click(searchButton())

    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el, 'no candidate was drawn').toBeTruthy()
      return el
    })
    expect(img.getAttribute('src')).toBe('https://encrypted-tbn0.gstatic.com/t')
    // CALLED BY ITS NAME, not by the slug the credit is stored under.
    const pick = img.closest('button')
    expect(pick.textContent, 'the picture is captioned with a slug').toContain('Google Images')
    expect(pick.textContent).not.toContain('google-images')

    fireEvent.click(pick)
    await waitFor(() => expect(onSetUrl).toHaveBeenCalledWith('https://pics.test/dune-full.jpg', 'google-images')) // a web picture is Google Images, not Google Books
  })

  // A catalogue candidate has one address and must not be changed by the
  // machinery the two-address ones need.
  it('leaves a one-address candidate alone', async () => {
    picturesAre(800, 1200)
    LOOKUP = [{ cover_url: 'https://books.google.com/dune.jpg', source: 'google' }]
    const onSetUrl = mount()
    fireEvent.click(searchButton())
    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el).toBeTruthy()
      return el
    })
    expect(img.getAttribute('src')).toBe('https://books.google.com/dune.jpg')
    fireEvent.click(img.closest('button'))
    await waitFor(() => expect(onSetUrl).toHaveBeenCalledWith('https://books.google.com/dune.jpg', 'google')) // credited to the supplier that offered it
  })

  // The preview above the controls shows the pending pick. For a picture whose
  // host the page cannot load, that has to be the thumbnail — otherwise choosing
  // a candidate replaces the strip with a "preview blocked" note.
  it('previews the pending pick with something it can actually draw', async () => {
    picturesAre(800, 1200)
    IMAGES = [{ url: 'https://pics.test/dune-full.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' }]
    let pending = ''
    const { rerender } = render(
      <CoverControls
        kind="books" id={1} currentPath="" coverUrl={pending} clearCover={false}
        onSetUrl={(u) => { pending = u }} onClear={() => {}} onUploaded={() => {}}
        search={{ title: 'Dune' }}
      />,
    )
    fireEvent.click(screen.getByLabelText(/Search covers/i))
    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.click(img.closest('button'))
    await waitFor(() => expect(pending).not.toBe(''))
    rerender(
      <CoverControls
        kind="books" id={1} currentPath="" coverUrl={pending} clearCover={false}
        onSetUrl={(u) => { pending = u }} onClear={() => {}} onUploaded={() => {}}
        search={{ title: 'Dune' }}
      />,
    )
    const preview = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(preview, 'the preview is drawing a host the page cannot load')
      .not.toContain('https://pics.test/dune-full.jpg')
    expect(preview).toContain('https://encrypted-tbn0.gstatic.com/t')
  })
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

  it('opens the frame on a picture that would be cut, asking for the original and not the thumbnail', async () => {
    picturesAre(1600, 900) // wide, in a 2:3 poster
    await choose()
    await screen.findByText(/^Frame — /)
    expect(SENT.find((s) => s.path === '/images/preview').body).toEqual({ url: 'https://pics.test/dune-full.jpg' })
    expect(uploads().length, 'the picture was stored before it had been framed').toBe(0)
  })

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

  it('leaves a picture that already fits the poster alone', async () => {
    picturesAre(800, 1200)
    await choose()
    await waitFor(() => expect(SENT.some((s) => s.path === '/images/preview')).toBe(true))
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/^Frame — /), 'a picture the right shape was sent to the editor').toBeNull()
  })
  // ONE RULE, AND IT IS THE SAME AS A FACE'S: the picture is framed BEFORE the screen hears of
  // it. On the work's own panel the screen's reaction to a choice is an immediate save, so a
  // choice announced first stored the unframed original and backing out kept it.
  it('does not tell the screen of the choice while the frame is open, nor if the reader backs out', async () => {
    picturesAre(1600, 900)
    const { onSetUrl } = await choose()
    await screen.findByText(/^Frame — /)
    expect(onSetUrl, 'the choice was announced before it had been framed').not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSetUrl, 'a picture the reader refused was chosen anyway').not.toHaveBeenCalled()
    expect(uploads().length).toBe(0)
  })

  it('keeps the framed picture and never announces the unframed address', async () => {
    picturesAre(1600, 900)
    const { onSetUrl } = await choose()
    await screen.findByText(/^Frame — /)
    await screen.findByRole('slider', { name: /zoom/i })
    const tick = () => [...document.querySelectorAll('button')].find((b) => b.getAttribute('type') === 'submit')
    await waitFor(() => expect(tick()?.disabled).toBe(false))
    fireEvent.click(tick())
    await waitFor(() => expect(uploads().length).toBe(1))
    expect(onSetUrl, 'the unframed address was chosen as well as the framed picture').not.toHaveBeenCalled()
  })

  it('falls back to the address, as a face does, when the server cannot fetch it for the frame', async () => {
    PREVIEW_OK = false
    picturesAre(1600, 900)
    const { onSetUrl } = await choose()
    await waitFor(() => expect(onSetUrl).toHaveBeenCalledWith('https://pics.test/dune-full.jpg', 'google-images'))
    expect(screen.queryByText(/^Frame — /)).toBeNull()
  })

  // A CHOICE MADE WHILE AN EARLIER ONE IS STILL BEING FETCHED SUPERSEDES IT, and the earlier one
  // must still put `previewing` down: it stayed up for the life of the screen, and Reframe, which
  // it disables, never came back.
  it('gives Reframe back once a file chosen mid-fetch has superseded the address', async () => {
    picturesAre(800, 1200)
    let release
    PREVIEW_GATE = new Promise((r) => { release = r })
    IMAGES = [{ url: 'https://pics.test/dune-full.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' }]
    mount({ currentPath: 'dune.jpg' })
    fireEvent.click(searchButton())
    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.click(img.closest('button'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/images/preview')).toBe(true))
    const reframe = () => screen.getByRole('button', { name: /reframe/i })
    await waitFor(() => expect(reframe().disabled, 'Reframe is not held while a picture is being fetched').toBe(true))
    // The reader now chooses a file instead.
    const input = document.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    await waitFor(() => expect(SENT.some((s) => s.method === 'UPLOAD')).toBe(true))
    release()
    await waitFor(() => expect(reframe().disabled, 'Reframe stayed disabled after the fetch it was waiting for ended').toBe(false))
  })

})
