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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let SENT
let LOOKUP
let IMAGES

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path === '/books/lookup') return { ok: true, data: { candidates: LOOKUP } }
    if (path === '/images/search') return { ok: true, data: { images: IMAGES, sources: { google: true, amazon: true } } }
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

beforeEach(() => {
  SENT = []
  LOOKUP = []
  IMAGES = []
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
    IMAGES = [{ url: 'https://pics.test/dune-full.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' }]
    const onSetUrl = mount()
    fireEvent.click(searchButton())

    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el, 'no candidate was drawn').toBeTruthy()
      return el
    })
    expect(img.getAttribute('src')).toBe('https://encrypted-tbn0.gstatic.com/t')

    fireEvent.click(img.closest('button'))
    expect(onSetUrl).toHaveBeenCalledWith('https://pics.test/dune-full.jpg')
  })

  // A catalogue candidate has one address and must not be changed by the
  // machinery the two-address ones need.
  it('leaves a one-address candidate alone', async () => {
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
    expect(onSetUrl).toHaveBeenCalledWith('https://books.google.com/dune.jpg')
  })

  // The preview above the controls shows the pending pick. For a picture whose
  // host the page cannot load, that has to be the thumbnail — otherwise choosing
  // a candidate replaces the strip with a "preview blocked" note.
  it('previews the pending pick with something it can actually draw', async () => {
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
