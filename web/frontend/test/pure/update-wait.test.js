// Waiting for the box to come back — the decision table, and the case that had
// this screen stuck three times.
//
// WHY THIS FILE EXISTS AT ALL is the point of it. The wait ran as twenty lines
// inside a click handler in Settings.jsx, which is why two earlier fixes shipped
// on the strength of "it looked right": the only way to exercise it was to update
// a real container and watch a real page. Both attempts left the page stuck on
// "updating & restarting…" and neither had a test that could have said so.
//
// The clock, the sleep and the ping are all injected, so six minutes of waiting
// runs in under a millisecond and "the server never answers" is one line.

import { describe, expect, it } from 'vitest'
import { RESTART_NEW, RESTART_SAME, RESTART_TIMEOUT, waitForRestart } from '../../src/update.js'

// A fake clock that only moves when something sleeps on it. Nothing here waits on
// wall time, so a six-minute window is exercised in full at no cost — and a loop
// that fails to advance the clock hangs the test rather than passing quietly.
function fakeClock() {
  let t = 1_000_000
  return {
    now: () => t,
    sleep: (ms) => {
      t += ms
      return Promise.resolve()
    },
  }
}

// A scripted server: one entry per poll, replayed in order, last entry repeating.
// `null` means the poll never comes back at all — a pending promise, which is the
// shape of the bug rather than a rejection.
function scripted(script) {
  let i = 0
  return () => {
    const step = script[Math.min(i++, script.length - 1)]
    if (step === null) return new Promise(() => {}) // never settles, ever
    return Promise.resolve(step)
  }
}

const up = (version) => ({ ok: true, version })
const gone = { ok: false }

describe('waiting for the box to come back', () => {
  it('does not reload on the first answer, because the old container is still answering', async () => {
    // THE FIRST BUG. Three seconds after the apply the container being replaced
    // is still up and still answering — reloading there reloads onto the build
    // you already had, which is what "it says updating, then nothing changed"
    // looked like from the outside.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up('3.0.0'), up('3.0.0'), gone, gone, up('3.1.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out).toBe(RESTART_NEW)
  })

  it('ENDS even when every poll hangs for ever', async () => {
    // THE THIRD BUG, and the one this file was written for. fetch has no timeout
    // of its own, and a socket that is accepted and never answered leaves the
    // promise pending rather than rejecting — which is exactly what Docker's port
    // proxy offers while the container behind it is being recreated. The old loop
    // counted turns, so one pending poll stopped it counting: the page sat on
    // "updating & restarting…" for ever, on the server itself as readily as from
    // another device.
    //
    // If this ever regresses, the test does not fail — it HANGS, which is the
    // honest reproduction of the defect.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([null]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
      windowMs: 60_000,
    })
    expect(out).toBe(RESTART_TIMEOUT)
  })

  it('treats a hung poll as one failure, not as an ending', async () => {
    // A hang mid-restart must count the same as a refused connection: the box is
    // not answering. It is one strike, and the run continues.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up('3.0.0'), null, null, up('3.1.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out).toBe(RESTART_NEW)
  })

  it('says so when it restarted onto the SAME build', async () => {
    // A branch tag can move without its image being rebuilt: pull, recreate,
    // same version. The reader is told that rather than reloaded onto what they
    // already had and left to compare two strings themselves.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up('3.0.0'), gone, gone, up('3.0.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out).toBe(RESTART_SAME)
  })

  it('needs two failures in a row, so one dropped request is not a restart', async () => {
    // A single failed poll is as likely to be a dropped request as a container
    // being stopped, and calling it a restart would report "nothing changed"
    // about an update that had not started yet.
    const c = fakeClock()
    const out = await waitForRestart({
      // down, up, down, up ... never two in a row, and never a new version.
      ping: scripted([gone, up('3.0.0'), gone, up('3.0.0'), gone, up('3.0.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
      windowMs: 60_000,
    })
    expect(out).toBe(RESTART_TIMEOUT)
  })

  it('counts a NEW version even when it never saw the box go down', async () => {
    // A fast restart between two polls is a restart. The version is the evidence;
    // the outage is only a fallback for when there is no version to compare.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up('3.0.0'), up('3.1.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out).toBe(RESTART_NEW)
  })

  it('with nothing to compare against, a restart IS the news', async () => {
    // A page kept open across a build whose /auth/me carried no version has no
    // `was`. Reporting "same" there reports the one thing that cannot be known;
    // the box demonstrably went away and came back, so reload and find out.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up(''), gone, gone, up('')]),
      sleep: c.sleep,
      now: c.now,
      was: '',
    })
    expect(out).toBe(RESTART_NEW)
  })

  it('gives up on a box that never goes away at all', async () => {
    // The apply reported success and nothing ever happened — a Watchtower that
    // could not reach the socket, an image that never landed. Three outcomes, and
    // this is the one that means "look at the logs".
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([up('3.0.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
      windowMs: 30_000,
    })
    expect(out).toBe(RESTART_TIMEOUT)
  })

  it('spends its whole window and no more', async () => {
    // The bound is the clock, not a count of turns — which is the same statement
    // as the hang case, from the other side. Six minutes of 3s turns is 120 of
    // them; a loop bounded by turns would stop at 60 whatever the clock said.
    const c = fakeClock()
    const t0 = c.now()
    await waitForRestart({
      ping: scripted([up('3.0.0')]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
      gapMs: 3000,
      windowMs: 6 * 60 * 1000,
    })
    const spent = c.now() - t0
    expect(spent).toBeGreaterThanOrEqual(6 * 60 * 1000)
    // At most one more turn than the window: the deadline is tested at the top of
    // the loop, so a turn that starts just inside it runs to the end. Overshooting
    // by one turn is the design; overshooting by an unbounded amount was the bug.
    expect(spent).toBeLessThanOrEqual(6 * 60 * 1000 + 3000 + 8000)
  })
})
