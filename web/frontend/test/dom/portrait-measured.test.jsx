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

  it('and says the shape of a picture that is not square, because the circle cuts the rest away', async () => {
    cached({ w: 1600, h: 701 }) // a wide logo, which is half outside a circle
    pixels('lit')
    await draw()
    expect(screen.queryByText(/1600:701, cropped/), 'a wide picture is cropped to a circle and says nothing').toBeTruthy()
  })

})
