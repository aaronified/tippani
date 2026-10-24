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

import { describe, expect, it, vi } from 'vitest'
import { RESTART_SAME, RESTART_TIMEOUT, waitForRestart } from '../../src/update.js'

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
    expect(out.outcome).toBe(RESTART_TIMEOUT)
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
    expect(out.outcome).toBe(RESTART_SAME)
  })
})

