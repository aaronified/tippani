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
