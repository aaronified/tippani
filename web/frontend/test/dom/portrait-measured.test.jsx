// WHAT A PORTRAIT'S CAPTION SAYS ABOUT THE PICTURE UNDER IT.
//
// THE OWNER, over a person sheet showing a loaded photograph and no numbers:
// "the character/actor cards do not say the size of the image or whether they are
// low contrast (for the images). and how do we tackle images that are not 2:3?"
//
// THREE SEPARATE THINGS WERE WRONG, and one of them had been wrong in writing.
//
//   THE SIZE WAS MEASURED ON `load` ALONE, and a cached image never fires it. So
//   the size appeared on a first visit and the caption fell back to "the record's
//   own picture" on every visit after — a loaded portrait with nothing under it,
//   which is exactly the screen that was reported.
//
//   "LOW CONTRAST" WAS A SIZE TEST. `identity.portrait.soft` has read "low
//   contrast" since it was written and the code showed it when `w < 400 || h <
//   400`. A small picture was labelled low contrast; a washed-out one said
//   nothing. The string's own comment described the size test underneath the
//   contrast wording.
//
//   AND A NON-2:3 PICTURE SAID NOTHING AT ALL, while `object-fit: cover`
//   centre-cropped it — so half a face can be outside the circle with nothing on
//   the screen to say so.
//
// WHAT A TEST WRITER NEEDS TO KNOW: jsdom has no canvas, so `contrastOf` returns
// null there and the contrast note is absent by design — a guess about somebody's
// portrait is worse than silence. The cases that need a contrast answer stub
// `getContext` and hand back the pixels they want measured.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import { PortraitBlock } from '../../src/characterRows.jsx'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

// A picture of a given size that is ALREADY loaded, the way a cached one is.
function cached({ w, h }) {
  Object.defineProperty(window.HTMLImageElement.prototype, 'complete', { value: true, configurable: true })
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', { value: w, configurable: true })
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalHeight', { value: h, configurable: true })
}

// Pixels for the contrast measurement: `flat` fills every channel with one value
// (no spread at all), `lit` alternates black and white (the whole range).
function pixels(kind) {
  const n = 32 * 32
  const data = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const v = kind === 'flat' ? 130 : (i % 2 ? 250 : 8)
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255
  }
  vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
    getImageData: () => ({ data }),
  })
}

const draw = async (props) => {
  let out
  await act(async () => { out = render(<PortraitBlock src="/x.jpg" name="Rupert Graves" px="the record's own picture" {...props} />) })
  return out
}

describe('a portrait’s caption', () => {
  it('states the size of a picture that was already in the cache', async () => {
    // THE REPORTED SCREEN. Nothing fires `load` for an image the browser already
    // has, so the block waited for an event that had happened before it existed.
    cached({ w: 1000, h: 1500 })
    await draw()
    expect(screen.queryByText(/1000×1500px/), 'a loaded picture’s size is not on the screen').toBeTruthy()
    expect(screen.queryByText(/record’s own picture|record's own picture/),
      'the caption is still the placeholder shown before a measurement exists').toBeNull()
  })

  it('and says nothing about a picture it has not measured', async () => {
    // The fallback is the caller's line, and it may not sit beside a size. The
    // dimensions are the thing to look for: `×` appears in no caption but theirs.
    Object.defineProperty(window.HTMLImageElement.prototype, 'complete', { value: false, configurable: true })
    Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', { value: 0, configurable: true })
    await draw()
    expect(screen.queryByText(/×/), 'a size was printed for a picture nothing measured').toBeNull()
    expect(screen.queryByText(/low contrast|under 400px|cropped/),
      'a picture nothing measured is being warned about').toBeNull()
  })

  it('and calls a small picture small, not low contrast', async () => {
    cached({ w: 266, h: 350 })
    pixels('lit')
    await draw()
    expect(screen.queryByText(/under 400px/), 'a picture under the floor is not said to be').toBeTruthy()
    expect(screen.queryByText(/low contrast/), 'a small picture is still labelled low contrast')
      .toBeNull()
  })

  it('and calls a flat picture low contrast, whatever its size', async () => {
    cached({ w: 1000, h: 1500 })
    pixels('flat')
    await draw()
    expect(screen.queryByText(/low contrast/), 'a picture with no tonal range at all is not flagged').toBeTruthy()
    expect(screen.queryByText(/under 400px/), 'a large picture is called small').toBeNull()
  })

  it('and leaves a lit picture unremarked', async () => {
    cached({ w: 1000, h: 1500 })
    pixels('lit')
    await draw()
    expect(screen.queryByText(/1000×1500px/), 'the size is missing').toBeTruthy()
    expect(screen.queryByText(/low contrast|under 400px|cropped/), 'a good picture is being warned about')
      .toBeNull()
  })

  it('and says the shape of a picture that is not 2:3, because the rest is cropped away', async () => {
    cached({ w: 1024, h: 1024 })
    pixels('lit')
    await draw()
    // Reduced, so a reader sees a ratio rather than four digits to divide.
    expect(screen.queryByText(/1:1, cropped/), 'a square picture is cropped to a circle and says nothing').toBeTruthy()
  })

  it('and does not remark on the shape it draws', async () => {
    cached({ w: 1000, h: 1500 })
    pixels('lit')
    await draw()
    expect(screen.queryByText(/cropped/), '2:3 is the shape the app draws, and it is being flagged').toBeNull()
  })

  it('and 0.66 is 2:3 as far as a reader is concerned', async () => {
    // A tolerance, or every picture off by a pixel reads as the wrong shape.
    cached({ w: 665, h: 1000 })
    pixels('lit')
    await draw()
    expect(screen.queryByText(/cropped/), 'a picture within a pixel of 2:3 is called cropped').toBeNull()
  })
})

describe('what the contrast measurement must not be fooled by', () => {
  it('a transparent ground, which is not a black one', async () => {
    // A cut-out PNG's transparency reads as (0,0,0,0) — a luminance of zero — so
    // a flat portrait on a transparent ground got a full-range spread out of its
    // own background and was never flagged. Anything under a quarter opaque is
    // not part of the picture a reader sees.
    cached({ w: 1000, h: 1500 })
    const n = 32 * 32
    const data = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) {
      const flat = 130
      // Half the frame is the flat subject; half is fully transparent.
      const clear = i % 2 === 0
      data[i * 4] = clear ? 0 : flat
      data[i * 4 + 1] = clear ? 0 : flat
      data[i * 4 + 2] = clear ? 0 : flat
      data[i * 4 + 3] = clear ? 0 : 255
    }
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {}, getImageData: () => ({ data }),
    })
    await draw()
    expect(screen.queryByText(/low contrast/),
      'the transparent half supplied the tonal range, so a flat picture passed').toBeTruthy()
  })

  it('and a handful of opaque pixels, which is not a measurement', async () => {
    // Four pixels of a 1024 are not a picture. A spread taken off them is noise
    // wearing a number, and the caption would print it as a fact.
    cached({ w: 1000, h: 1500 })
    const n = 32 * 32
    const data = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < 4; i++) { data[i * 4] = 130; data[i * 4 + 1] = 130; data[i * 4 + 2] = 130; data[i * 4 + 3] = 255 }
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {}, getImageData: () => ({ data }),
    })
    await draw()
    expect(screen.queryByText(/1000×1500px/), 'the size is missing').toBeTruthy()
    expect(screen.queryByText(/low contrast/), 'four pixels were taken for a measurement').toBeNull()
  })

  it('and a frame with nothing opaque in it at all', async () => {
    // Nothing to measure is not the same as low contrast, and saying so would be
    // a guess about somebody's portrait.
    cached({ w: 1000, h: 1500 })
    const data = new Uint8ClampedArray(32 * 32 * 4) // every alpha 0
    vi.spyOn(window.HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {}, getImageData: () => ({ data }),
    })
    await draw()
    expect(screen.queryByText(/1000×1500px/), 'the size is missing').toBeTruthy()
    expect(screen.queryByText(/low contrast/), 'a frame with nothing in it was judged').toBeNull()
  })
})
