// The media block states the size of the picture it is actually drawing.
//
// WHY THIS IS WORTH A TEST. The number is not decoration: it is the one fact a
// reader uses to decide whether to replace their cover, and the ink on it is a
// promise that Fetch can do something about it. Three of the four states it can
// be in are easy to get wrong in the same direction — a picture still loading, a
// picture the page is forbidden to draw, and no picture at all all measure zero
// if you are not careful, and only ONE of them is a small cover.

import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { COVER_MIN_W, MediaBlock, PORTRAIT_MIN_SIDE } from '../../src/ui.jsx'

// jsdom never fetches, so the load is staged by hand — which is also the only
// way to say what the bytes measured.
function drawn(w, h) {
  const img = document.querySelector('.tp-media-pic img')
  expect(img, 'the block drew no picture').toBeTruthy()
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true })
  fireEvent.load(img)
  return img
}

const dims = () => document.querySelector('.tp-media-dims')

beforeEach(cleanup)

describe('the media block', () => {

  it('inks the size when Fetch could replace it', () => {
    render(<MediaBlock src="/covers/small.jpg" label="Cover" />)
    drawn(COVER_MIN_W - 1, 9000)
    expect(dims().textContent).toBe(`${COVER_MIN_W - 1}×9000 px`)
    expect(dims().className).toMatch(/is-low/)
  })

  // The one the naive version gets wrong: a pasted URL the page's img-src
  // forbids has a perfectly good size that this page cannot read.

  // An empty drawer area is not an area. Every caller's extras are conditional,
  // so the false branches must not lay out a row and its gap.
})
