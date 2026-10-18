// The arithmetic of putting a picture in a frame (src/frames.js). The function IS the
// observable unit here — a placement is numbers in and numbers out — which is the
// justified exception to "a test does not know a function's name"; the editor's
// behaviour on screen is the journey's.
import { describe, expect, it } from 'vitest'
import { FRAMES, clampPlacement, fillFor, lostShare, needsFrame, sizes, startPlacement } from '../../src/frames.js'

describe('which pictures need framing', () => {
  it('leaves a picture already in the frame alone', () => {
    expect(needsFrame(1000, 1000, 'face')).toBe(false)
    expect(needsFrame(800, 1200, 'work')).toBe(false)
    expect(needsFrame(1000, 1010, 'face'), 'within two per cent is not worth an editor').toBe(false)
  })

  it('opens for a wide logo in a circle and a square in a poster', () => {
    expect(needsFrame(1600, 701, 'face')).toBe(true)
    expect(needsFrame(1000, 1000, 'work')).toBe(true)
  })

  it('counts what the frame would cut off', () => {
    expect(lostShare(1000, 1000, 2 / 3)).toBeCloseTo(1 / 3, 6)
    expect(lostShare(0, 0, 1), 'nothing measured is nothing lost').toBe(0)
  })
})

describe('where a picture can sit', () => {
  it('starts filling the frame, centred', () => {
    // 1600x701 in a square: the height decides, so the picture is wider than the frame.
    const p = startPlacement(1600, 701, 'face')
    expect(p.size).toBeCloseTo(1600 / 701, 6)
    expect(p.x).toBe(0)
    expect(p.y).toBe(0)
  })

  it('can be shrunk until the whole picture is inside, and no further', () => {
    const { cover, contain } = sizes(1600, 701, FRAMES.face.ratio)
    expect(contain).toBe(1)
    expect(clampPlacement({ size: 0.1, x: 0, y: 0 }, 1600, 701, 'face').size).toBe(contain)
    expect(clampPlacement({ size: 99, x: 0, y: 0 }, 1600, 701, 'face').size).toBe(cover * 4)
  })

  it('cannot be dragged off the frame while it covers it', () => {
    const iw = 1600
    const ih = 701
    const size = sizes(iw, ih, 1).cover
    const slack = (size - 1) / 2
    const p = clampPlacement({ size, x: 5, y: 5 }, iw, ih, 'face')
    expect(p.x).toBeCloseTo(slack, 6)
    expect(p.y, 'exactly as tall as the frame: nothing to pan vertically').toBeCloseTo(0, 6)
  })

  it('cannot be dragged out of the frame while it sits inside it', () => {
    // Shrunk to the whole picture, the picture is 1 wide and shorter than the frame.
    const p = clampPlacement({ size: 1, x: 9, y: 9 }, 1600, 701, 'face')
    expect(p.x).toBe(0)
    expect(p.y).toBeCloseTo((1 - 701 / 1600) / 2, 6)
  })
})

describe('what fills the gap', () => {
  const edges = { sides: [10, 20, 30], ends: [200, 210, 220] }

  it('takes the side edges when the bars are at the sides', () => {
    // A tall picture in a square, whole: bars left and right.
    expect(fillFor({ size: 0.5, x: 0, y: 0 }, 500, 1000, 'face', edges)).toEqual([10, 20, 30])
  })

  it('takes the top and bottom edges when the bars are above and below', () => {
    expect(fillFor({ size: 1, x: 0, y: 0 }, 1600, 701, 'face', edges)).toEqual([200, 210, 220])
  })

  it('blends them when there are bars on all four sides', () => {
    expect(fillFor({ size: 0.5, x: 0, y: 0 }, 1000, 1000, 'face', edges)).toEqual([105, 115, 125])
  })

  it('falls back to a neutral when the picture has no opaque edge', () => {
    expect(fillFor({ size: 1, x: 0, y: 0 }, 1600, 701, 'face', { sides: null, ends: null })).toEqual([128, 128, 128])
  })
})
