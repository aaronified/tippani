// Waiting for the box to come back, after an in-app update has been applied.
//
// SMALL, PURE, AND ITS OWN FILE because it is the third fix to the same screen
// and the first two were unprovable. This ran as twenty lines inside a click
// handler in a 4,000-line component, which meant the only way to find out what it
// did in the case that mattered — the server is gone — was to update a real box
// and watch. Both earlier attempts passed that way and both left the page stuck.
//
// WHAT WENT WRONG, three times, in the same order of subtlety:
//
//   1. It reloaded on the first successful ping — which is three seconds after
//      the apply, while THIS container is still up and answering. "It says
//      updating, then refreshes, and nothing has changed."
//   2. The apply request itself was being cut off mid-pull by the server's write
//      deadline and by the request context dying with the connection. Fixed
//      server-side; it is why the symptom used to be "works on the box, not from
//      my laptop".
//   3. THE POLL COULD HANG FOR EVER. `await fetch(...)` has no timeout, and a
//      connection that is ACCEPTED and never answered leaves the promise pending
//      rather than rejecting — exactly what Docker's port proxy offers while the
//      container behind it is being recreated. One poll landed in that window and
//      the loop simply stopped, on the box as readily as off it. A count of sixty
//      turns was never a bound on the wait; it was a bound on the turns.
//
// So the loop is bounded THREE ways and any one of them is enough: the fetch
// carries an abort signal, each turn is raced against a timer, and the whole wait
// has a deadline. The abort is what frees the socket; the race is what frees the
// loop even if the abort does not fire; the deadline is what ends a run where the
// server answers promptly and for ever with the same version.

// The outcomes, and each is a different thing to tell the reader.
//   'new'     — it came back on a different build. Reload.
//   'same'    — it went away and came back on the SAME build. A branch tag can do
//               that: the tag moved, the image behind it did not get rebuilt.
//               Saying so beats reloading onto the build they already had.
//   'timeout' — it never went away, or never came back, inside the window.
//   {outcome:'failed', why} — the server recorded that the apply stopped, and at
//               which step. This is the outcome the reader actually needed and
//               the one the wait could not produce until the server wrote its
//               progress down: everything else here is inference from silence.
export const RESTART_NEW = 'new'
export const RESTART_SAME = 'same'
export const RESTART_TIMEOUT = 'timeout'
// The server said, in so many words, that it stopped — and why. The only outcome
// that carries a reason, because it is the only one the server got to write down.
export const RESTART_FAILED = 'failed'

// waitForRestart polls until the box is demonstrably a different box, until the
// server says it stopped, or until it is out of time.
//
// ALWAYS `{ outcome, why }`, never a bare string. Only one outcome carries a
// reason, and a caller that has to remember which one is a caller that will read
// `.why` off a string and get `undefined` — so every path answers in the same
// shape.
//
// Everything it needs from the outside world is an argument — `ping`, `sleep` and
// `now` — so the whole decision table is exercisable in milliseconds without a
// browser, a container or a clock. That is the point of the file.
//
//   ping()  → Promise<{ ok, version, phase, error }>. Never expected to reject; a
//             transport failure is `{ ok: false }`, which is how "the server is
//             gone" is said. `phase` and `error` come from the server's own
//             record of the apply (GET /admin/update/state) — see below.
//   sleep(ms) → Promise. Injected so a test can run six minutes instantly.
//   now()   → epoch ms.
export async function waitForRestart({
  ping,
  sleep,
  now = () => Date.now(),
  was = '',
  gapMs = 3000,
  pingMs = 8000,
  windowMs = 6 * 60 * 1000,
} = {}) {
  const deadline = now() + windowMs
  // TWO FAILED POLLS IN A ROW BEFORE IT COUNTS AS GONE. One is as likely to be a
  // dropped request as a container being stopped, and a false "it came back on
  // the same build" is a worse answer than waiting one more turn.
  let down = 0
  while (now() < deadline) {
    await sleep(gapMs)
    // The race, not the abort, is what guarantees this turn ends. A ping that
    // resolves late still resolves — into a promise nobody is listening to.
    const r = await Promise.race([
      ping(),
      sleep(pingMs).then(() => ({ ok: false, timedOut: true })),
    ])
    if (!r || !r.ok) {
      down++
      continue
    }
    const version = r.version || ''
    if (was && version && version !== was) return { outcome: RESTART_NEW }
    // THE SERVER'S OWN ACCOUNT OF THE APPLY, and it is the only thing that can
    // end this loop honestly. The page almost never hears the apply's answer —
    // the pull outlasts the server's 60-second write timeout, so the browser's
    // fetch resolves to no status at all — which left the wait guessing
    // "probably running" whether the update had started, stalled at identifying
    // the container, or launched a recreater that died. It waited six minutes
    // for a version that was never going to change and then said nothing useful.
    //
    // A record that says `failed` is the answer, immediately: stop, and hand the
    // reason up. See internal/httpapi/update_progress.go for the phases.
    if (r.phase === 'failed' || r.phase === 'unsupported') return { outcome: RESTART_FAILED, why: r.error || '' }
    // NOTHING TO COMPARE AGAINST is not the same as nothing changed. A page kept
    // open across a build whose /auth/me carried no version has no `was`, and
    // there a container that went away and came back IS the news — reporting
    // "same" would be reporting the one thing that cannot be known.
    if (down >= 2) return { outcome: was ? RESTART_SAME : RESTART_NEW }
    down = 0
  }
  return { outcome: RESTART_TIMEOUT }
}
