// JUDGING A DRAG, SEPARATED FROM THE BROWSER THAT FEEDS IT.
//
// WHY THIS IS ITS OWN FILE, and it is the same argument `ratchet.mjs` makes. The
// verdict on a drag was a chain of `else if`s inside a puppeteer run, so the only
// way to ask whether the chain was RIGHT was to boot a server, restore a library,
// open a film, open its details and pull on the sheet. That is minutes per
// question, and the questions went unasked:
//
//   A GUARD BELOW THE CODE IT GUARDS. `travel` dereferenced `live[live.length -
//   1]` and the `live.length < 6` arm that exists to catch an unreadable drag sat
//   BELOW it — so the one case the guard was written for threw a TypeError out of
//   the probe instead of printing the failure it had already detected. A crash
//   and a FAIL are not the same report: the crash loses every later case in the
//   run, and reads as a broken harness rather than a broken sheet.
//
//   AND THE ORDER OF THE ARMS IS A JUDGEMENT. "Held still" has to be asked before
//   "did not keep up", because a sheet that never moved also fails the travel
//   check and the reader deserves the first sentence, not the second.
//
// So the whole chain is here, takes plain numbers, and answers with a string.
// Nothing in it knows what a browser is.

// A RELEASE MAY EASE TO ITS ANCHOR AND MAY NOT JUMP THERE, and the difference is
// relative: a landing that has 200px to cover is allowed a bigger first frame
// than one with 20px. `ends == null` is a sheet that was gone by the time it was
// read, where the only honest bar is an absolute one.
export function leapt(left, released, ends) {
  const moved = Math.abs(released - left)
  if (ends == null) return moved > 40
  const landing = Math.abs(ends - left)
  if (landing < 8) return moved > 20 // nothing to animate; anything is a jump
  return moved > Math.max(20, landing * 0.5)
}

// THE READINGS A DRAG PRODUCES, judged. `live` is one entry per frame of the
// gesture ({ top, height, transform }), `let_go` the one taken in the frame the
// finger lifted, `after` where the sheet ended up, and `asked` how far the finger
// actually travelled.
//
// Returns { fail } with the sentence to print, or { ok } with the one to print
// when there is nothing wrong. Never throws: a probe that crashes has not
// measured anything, and this file exists because that happened.
export function judgeDrag({ live = [], let_go = null, after = null, asked = 0, floor = 6 } = {}) {
  // FIRST, BEFORE ANY READING IS DEREFERENCED. Everything below this line assumes
  // a first and a last frame exist.
  if (live.length < floor) {
    return { fail: `only ${live.length} of the drag's frames could be read, so the mechanism was not measured` }
  }
  const heights = [...new Set(live.map((r) => r.height))]
  const tops = [...new Set(live.map((r) => r.top))]
  const last = live[live.length - 1]
  const travel = Math.abs(last.top - live[0].top)
  if (heights.length > 1) {
    return { fail: `the drag re-laid-out the sheet: its box took ${heights.length} heights (${heights.join(', ')}) across one gesture` }
  }
  if (tops.length < 3) {
    return { fail: `the sheet's top edge held still at ${tops.join(', ')} — the drag moved nothing a reader can see` }
  }
  if (!live.every((r) => /translateY/.test(r.transform || ''))) {
    return { fail: 'the drag wrote no transform, so it is moving the sheet by laying it out' }
  }
  // A TENTH OF SLACK, because the last reading is taken before the final step's
  // frame has landed.
  if (travel < asked * 0.9) {
    return { fail: `the sheet's top edge travelled ${travel}px while the finger travelled ${Math.round(asked)}px — it is not keeping up` }
  }
  if (let_go && leapt(last.top, let_go.top, after?.top)) {
    return { fail: `the release leapt: the top edge went from ${last.top} to ${let_go.top} in the frame the finger lifted, on its way to ${after?.top}` }
  }
  return { ok: `one layout for the whole drag (${heights[0]}px box), ${travel}px of travel for ${Math.round(asked)}px of finger, and no leap on release` }
}

// HOW SMOOTH THE DRAG ACTUALLY WAS, which is the one thing every check above
// leaves out.
//
// THE OWNER, four reports in: "it has reduced a lot with last updates, but it is
// still not buttery smooth (that is the goal)." Everything else this file judges
// is a MECHANISM — one layout, a transform, the top edge keeping up, no leap on
// release — and a drag can pass all of it while dropping every third frame. A
// mechanism is a thing you can reason about; smoothness is a measurement, and
// until there is a number for it "buttery" is an argument nobody can win.
//
// WHAT THE NUMBER IS. `requestAnimationFrame` timestamps through the gesture, and
// the INTERVALS between them. At 60Hz a frame is 16.7ms; a gap of two frames is
// one dropped, which a reader sees as a stutter. So: the worst interval, and how
// many were over budget.
//
// AND IT IS NOT A RATCHET, deliberately. This runs headless in a shared container
// against a swiftshader compositor — nothing like the owner's phone — so a count
// of long frames here is a fact about this machine as much as about the app.
// Making it a gate would either fail constantly or be set so loose it guards
// nothing. It REPORTS, every run, and fails only on a hitch no environment
// excuses: a single frame long enough that a reader would call it a freeze.
export const FRAME_MS = 1000 / 60
// Two frames' worth. One interval this long is one dropped frame.
export const LONG_FRAME = FRAME_MS * 2
// A quarter of a second of nothing. No compositor is this slow because it is
// busy; something blocked the main thread, and that is the app's to answer for.
export const HITCH_MS = 250

// stamps: rAF timestamps in ms, in order. Returns the reading plus a verdict.
export function judgeFrames({ stamps = [], hitch = HITCH_MS, floor = 8 } = {}) {
  const gaps = []
  for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1])
  // TOO FEW FRAMES IS NOT A SMOOTH DRAG, it is an unmeasured one — and saying so
  // is the whole lesson of this file's first defect, where the guard against
  // having no readings sat below the line that dereferenced them.
  if (gaps.length < floor) {
    return { gaps, unmeasured: true, note: `only ${gaps.length} frame interval(s) were recorded, so smoothness was not measured` }
  }
  const sorted = [...gaps].sort((a, b) => a - b)
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const worst = sorted[sorted.length - 1]
  const long = gaps.filter((g) => g > LONG_FRAME).length
  const reading = {
    gaps, frames: gaps.length + 1, worst: Math.round(worst),
    median: Math.round(at(0.5)), p95: Math.round(at(0.95)), long,
    share: Math.round((long / gaps.length) * 100),
  }
  if (worst > hitch) {
    return { ...reading, fail: `one frame of the drag took ${Math.round(worst)}ms — a reader sees that as the sheet freezing` }
  }
  return { ...reading, ok: `${reading.frames} frames: median ${reading.median}ms, p95 ${reading.p95}ms, worst ${reading.worst}ms, `
    + `${long} over ${Math.round(LONG_FRAME)}ms (${reading.share}%)` }
}
