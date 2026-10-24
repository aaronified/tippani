// The arithmetic of putting a picture in a frame (src/frames.js). The function IS the
// observable unit here — a placement is numbers in and numbers out — which is the
// justified exception to "a test does not know a function's name"; the editor's
// behaviour on screen is the journey's.
import { describe, expect, it } from 'vitest'
import {  clampPlacement,    sizes,  } from '../../src/frames.js'

describe('where a picture can sit', () => {
  it('cannot be dragged off the frame while it covers it', () => {
    const iw = 1600
    const ih = 701
    const size = sizes(iw, ih, 1).cover
    const slack = (size - 1) / 2
    const p = clampPlacement({ size, x: 5, y: 5 }, iw, ih, 'face')
    expect(p.x).toBeCloseTo(slack, 6)
    expect(p.y, 'exactly as tall as the frame: nothing to pan vertically').toBeCloseTo(0, 6)
  })
})

