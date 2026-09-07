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

import { PortraitBlock, croppedShare } from '../../src/characterRows.jsx'

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

  it('and a picture smaller than the sample grid gets no contrast answer', async () => {
    // THE MEASUREMENT UPSCALES, and that is an invention. `drawImage` will scale
    // a 16×24 file into the 32×32 grid, so every sample is an interpolation of
    // the same few pixels and the spread comes out near zero — a true number
    // about a picture nobody measured. The size is the fact that matters about a
    // file this small, and it is the fact that is said.
    cached({ w: 16, h: 24 })
    pixels('flat')
    await draw()
    expect(screen.queryByText(/16×24px/), 'the size is missing').toBeTruthy()
    expect(screen.queryByText(/low contrast/), 'a picture smaller than the grid was measured anyway').toBeNull()
  })

  it('and a crop is not a fault, so it does not paint the caption', async () => {
    // THE CAPTION GOES RED ON `is-soft`, which is the app saying "this picture is
    // not good enough for the slot". A flawless 2000×2000 studio portrait is not
    // that — it is a portrait the slot will FRAME, which is the app's doing and
    // not the picture's. Painting the line red for it warns about the one fact in
    // it that is nobody's mistake, and the facts that ARE faults lose their
    // colour by sharing it with one that is not.
    cached({ w: 2000, h: 2000 })
    pixels('lit')
    await draw()
    const cap = screen.queryByText(/2000×2000px/)
    expect(cap, 'the size is missing').toBeTruthy()
    expect(cap.textContent, 'a square picture did not say it is being cropped').toMatch(/1:1/)
    expect(cap.className.split(/\s+/), 'a crop-only caption was marked as a fault')
      .not.toContain('is-soft')
  })

  it('and a real fault does paint it', async () => {
    // The other half, which is what makes the case above a distinction rather
    // than a way of never colouring anything.
    cached({ w: 1000, h: 1500 })
    pixels('flat')
    await draw()
    const cap = screen.queryByText(/1000×1500px/)
    expect(cap.textContent, 'a flat picture was not called low contrast').toMatch(/low contrast/)
    expect(cap.className.split(/\s+/), 'a washed-out picture’s caption was left unmarked')
      .toContain('is-soft')
  })

  it('and a ten-per-cent crop is worth saying', async () => {
    // 600×1000 IS 0.6 AGAINST 0.667 — a difference of 0.067, which slipped under
    // a tolerance written on the raw ratio, while `cover` was taking a tenth off
    // the top and bottom of it. The reader's question is how much of the picture
    // is not on the screen, so that is the question the tolerance is on.
    cached({ w: 600, h: 1000 })
    await draw()
    const cap = screen.queryByText(/600×1000px/)
    expect(cap, 'the size is missing').toBeTruthy()
    expect(cap.textContent, 'a tenth of the picture is cropped away and the caption said nothing')
      .toMatch(/3:5/)
  })

  it('and the crop is measured as a share of the picture, not a gap between ratios', async () => {
    // THE ARITHMETIC ON ITS OWN, because the tolerance was the defect and a
    // rendered caption is a slow way to ask what a number is. `cover` fills the
    // 2:3 slot and cuts the overflow off BOTH ends of whichever axis is long, so
    // the visible share is the smaller ratio over the larger.
    expect(croppedShare({ w: 1000, h: 1500 }), 'a 2:3 picture is not cropped').toBe(0)
    expect(croppedShare({ w: 2, h: 3 }), 'the same shape at any size').toBe(0)
    // The one the raw-ratio tolerance let through: 0.6 against 0.667 is a
    // difference of 0.067 and a loss of a tenth.
    expect(croppedShare({ w: 600, h: 1000 })).toBeCloseTo(0.1, 3)
    expect(croppedShare({ w: 1024, h: 1024 }), 'a square loses a third').toBeCloseTo(1 / 3, 3)
    // AND IT IS SYMMETRIC. A picture twice as wide as 2:3 and one twice as tall
    // lose the same share, because `cover` does the same thing to both.
    expect(croppedShare({ w: 4, h: 3 })).toBeCloseTo(croppedShare({ w: 1, h: 3 }), 6)
    expect(croppedShare({ w: 0, h: 0 }), 'nothing measured is nothing cropped').toBe(0)
  })

  it('measures the slot’s own picture and not the editor’s thumbnail', async () => {
    // THE EDITOR LANDS INSIDE `.cs-portrait` — the URL field, the upload, and a
    // provider strip that is a row of thumbnails — so a subtree query for `img`
    // finds one of those whenever the slot itself has no portrait, because a slot
    // with no portrait draws a silhouette and no `<img>` at all. Measured: a
    // caption reading "180×270px · under 400px" under an empty portrait slot,
    // about somebody else's thumbnail.
    cached({ w: 180, h: 270 })
    await draw({ src: '', editor: <img src="/provider-thumb.jpg" alt="" /> })
    expect(screen.queryByText(/180×270px/), 'the caption measured a picture that is not this slot’s').toBeNull()
    expect(screen.queryByText(/record’s own picture|record's own picture/),
      'an unmeasured slot should be showing the caller’s line').toBeTruthy()
  })
})
