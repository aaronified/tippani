// THE PROBE'S OWN VERDICT, ASKED WITHOUT A BROWSER.
//
// WHAT WENT WRONG. `sheet-drag.mjs` judged a drag with a chain of `else if`s, and
// the FIRST arm — "only N of the drag's frames could be read, so the mechanism was
// not measured" — sat below a line that dereferenced the last reading:
//
//     const travel = Math.abs(live[live.length - 1].top - live[0].top)
//     ...
//     if (live.length < 6) { console.log('FAIL only 0 of the drag's frames...') }
//
// With no readings, `live[-1]` is `undefined` and `.top` throws. So the one case
// that arm exists for could not reach it: the probe died with a TypeError, taking
// every later case in the run with it, and the output read as a broken harness
// rather than a sheet that could not be measured. The guard was written, was
// correct, and was unreachable.
//
// AND IT COULD NOT BE ASKED CHEAPLY. To produce an empty `live` you had to boot a
// server, restore a library, open a film, open its details, and pull on a sheet
// that then had to fail to render. Minutes per question, so the question went
// unasked — which is the same argument `ratchet.mjs` and `controls-ratchet.test.js`
// make about the touch-floor ceiling, and the same fix: the arithmetic moves out
// of the run into a module that answers in a millisecond.
//
// WHAT A TEST WRITER NEEDS TO KNOW: a reading is `{ top, height, transform }`,
// one per frame of the gesture; `let_go` is the frame the finger lifted and
// `after` where the sheet ended up. The verdict never throws — a probe that
// crashes has measured nothing — and the ORDER of its arms is a judgement, not an
// accident: a sheet that held still has to be reported as holding still rather
// than as failing to keep up, because it fails both.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

// BY ABSOLUTE URL, because the probe lives outside the frontend's Vite root — the
// same file the probe imports, so this is not a test of a copy.
const { judgeDrag, leapt } = await import(pathToFileURL(join(SHOTS, 'dragverdict.mjs')).href)

// A drag that did everything right: one box height, a moving top edge, a
// transform on every frame, and a release that eases.
const good = (n = 12, step = 5) =>
  Array.from({ length: n }, (_, i) => ({ top: 300 + i * step, height: 752, transform: `translateY(${i * step}px)` }))

describe('a drag verdict', () => {
  it('reports too few readings instead of throwing', () => {
    // THE DEFECT, as the smallest input that reaches it.
    expect(() => judgeDrag({ live: [] })).not.toThrow()
    expect(judgeDrag({ live: [] }).fail, 'an unreadable drag did not say so').toMatch(/could be read/)
  })

  it('and every count below the floor reaches that arm', () => {
    // Not just zero: one reading has a first AND a last and would sail past a
    // guard written only against emptiness.
    for (const n of [0, 1, 2, 5]) {
      const out = judgeDrag({ live: good(n), asked: 64 })
      expect(out.fail, `${n} readings were judged as a measurement`).toMatch(/could be read/)
      expect(out.fail).toContain(`only ${n} of`)
    }
  })

  it('and passes a drag that did everything right', () => {
    const out = judgeDrag({ live: good(), asked: 55, let_go: { top: 358 }, after: { top: 360 } })
    expect(out.fail, out.fail).toBeUndefined()
    expect(out.ok).toMatch(/one layout for the whole drag/)
  })

  it('and a second box height is a re-layout', () => {
    // The owner's report, twice: "the animation is not just not-smooth. it
    // introduces screen tears!!" A drag that writes a height every frame
    // re-lays-out the sheet and re-blurs the screen behind it.
    const live = good()
    live[6].height = 700
    expect(judgeDrag({ live, asked: 55 }).fail).toMatch(/re-laid-out/)
  })

  it('and a sheet that held still is reported as holding still, not as slow', () => {
    // BOTH ARMS MATCH THIS INPUT, and the order decides which sentence a reader
    // gets. "It is not keeping up" describes a sheet that moved; this one did not.
    const live = good(12, 0)
    const out = judgeDrag({ live, asked: 64 })
    expect(out.fail).toMatch(/held still/)
    expect(out.fail).not.toMatch(/keeping up/)
  })

  it('and a drag with no transform is moving the sheet by laying it out', () => {
    const live = good().map((r) => ({ ...r, transform: '' }))
    expect(judgeDrag({ live, asked: 55 }).fail).toMatch(/wrote no transform/)
  })

  it('and a top edge that lags the finger fails', () => {
    // "extremely flaky" is what half-speed tracking feels like, and three
    // different positions is not enough to catch it.
    const out = judgeDrag({ live: good(12, 2), asked: 64 })
    expect(out.fail, 'a sheet tracking at a third of the finger’s speed passed').toMatch(/not keeping up/)
  })

  it('and a tenth of slack is allowed, because the last frame has not landed', () => {
    const out = judgeDrag({ live: good(12, 5), asked: 60, let_go: { top: 358 }, after: { top: 360 } })
    expect(out.fail, out.fail).toBeUndefined()
  })

  it('and a release that jumps is a leap', () => {
    const out = judgeDrag({ live: good(), asked: 55, let_go: { top: 500 }, after: { top: 360 } })
    expect(out.fail, 'a 145px jump in the release frame passed').toMatch(/release leapt/)
  })
})

describe('what counts as a leap', () => {
  it('is measured against the distance the landing has to cover', () => {
    // THE PROBE WAS BLIND TO THE 216px JUMP for a while because the bar was
    // absolute: a release that has 400px to travel moves a long way in its first
    // frame and honestly so, while one with 20px to go may not move 30.
    expect(leapt(300, 320, 700), 'a 20px first frame of a 400px landing').toBe(false)
    expect(leapt(300, 540, 700), 'half the landing in one frame').toBe(true)
  })

  it('and a landing with nothing to cover may not move at all', () => {
    // Released on an anchor: there is no animation, so any movement is a jump.
    expect(leapt(300, 305, 302)).toBe(false)
    expect(leapt(300, 340, 302), 'a 40px jump where the landing was 2px').toBe(true)
  })

  it('and a sheet that was gone by the time it was read gets an absolute bar', () => {
    expect(leapt(300, 330, null)).toBe(false)
    expect(leapt(300, 400, null)).toBe(true)
  })
})
