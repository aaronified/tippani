// One cover floor, and both halves of the app read it.
//
// THE FAILURE THIS EXISTS FOR. Two numbers decided what "too small" meant. The
// server's `lowResCoverWidth` decides whether a refetch REPLACES stored art and
// whether Metadata counts the work as a low-res gap; the client had its own copy
// for the red ink on a candidate, and the design pack proposed a third (400x600)
// for the media block. Two of the three disagreeing means the block can call a
// cover unusable while the one button offered to repair it declines — or stay
// silent about a cover Metadata is already listing as a gap.
//
// So there is ONE number, it lives on the server, and this reads both sides
// rather than a copy of either.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COVER_MIN_W, PORTRAIT_MIN_SIDE, mediaLow } from '../../src/ui.jsx'

const SRC = process.env.TIPPANI_SRC
const repo = join(SRC, '..', '..', '..')
const read = (f) => readFileSync(join(repo, f), 'utf8')

// The server's own declaration, not a note about it.
function serverFloor() {
  const go = read('internal/httpapi/metadata_handlers.go')
  const m = go.match(/const lowResCoverWidth = (\d+)/)
  if (!m) throw new Error('lowResCoverWidth is no longer declared in metadata_handlers.go')
  return Number(m[1])
}

describe('the cover floor', () => {
  it('is the same number on both sides', () => {
    expect(serverFloor()).toBe(COVER_MIN_W)
  })

  it('is what the server actually tests against — a width, on its own', () => {
    // If the refetch rule ever grows a height, the red ink has to grow one too;
    // until then a height here would ink covers the server will not replace.
    const go = read('internal/httpapi/metadata_handlers.go')
    expect(go).toMatch(/oldW > 0 && oldW < lowResCoverWidth/)
    expect(mediaLow({ w: COVER_MIN_W - 1, h: 9999 }, COVER_MIN_W, 'rect')).toBe(true)
    expect(mediaLow({ w: COVER_MIN_W, h: 1 }, COVER_MIN_W, 'rect')).toBe(false)
  })

  it('reads a face on its shorter side, because a round crop keeps that one', () => {
    expect(mediaLow({ w: 4000, h: PORTRAIT_MIN_SIDE - 1 }, PORTRAIT_MIN_SIDE, 'round')).toBe(true)
    expect(mediaLow({ w: PORTRAIT_MIN_SIDE, h: PORTRAIT_MIN_SIDE }, PORTRAIT_MIN_SIDE, 'round')).toBe(false)
  })

  it('says nothing about a picture it has not measured', () => {
    // null is "still loading", or "the page could not draw it" — neither is small.
    expect(mediaLow(null, COVER_MIN_W, 'rect')).toBe(false)
  })

  it('counts a missing picture as under the floor', () => {
    expect(mediaLow({ w: 0, h: 0 }, COVER_MIN_W, 'rect')).toBe(true)
    expect(mediaLow({ w: 0, h: 0 }, PORTRAIT_MIN_SIDE, 'round')).toBe(true)
  })

  it('leaves no second copy of the number in the client', () => {
    // The client's old private LOW_RES_W is what this replaced.
    const picker = read('web/frontend/src/CoverPicker.jsx')
    expect(picker).not.toMatch(/LOW_RES_W/)
    expect(picker).toMatch(/COVER_MIN_W/)
  })
})
