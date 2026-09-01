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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESTART_FAILED, RESTART_NEW, RESTART_SAME, RESTART_TIMEOUT, waitForRestart } from '../../src/update.js'
import { json } from '../../src/api.js'

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
    expect(out.outcome).toBe(RESTART_NEW)
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
    expect(out.outcome).toBe(RESTART_TIMEOUT)
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
    expect(out.outcome).toBe(RESTART_NEW)
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
    expect(out.outcome).toBe(RESTART_TIMEOUT)
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
    expect(out.outcome).toBe(RESTART_NEW)
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
    expect(out.outcome).toBe(RESTART_NEW)
  })

  it('stops the moment the server says it stopped, and carries the reason up', async () => {
    // THE OUTCOME THE READER ACTUALLY NEEDED, and the one this loop could not
    // produce until the server wrote its progress down. The page almost never
    // hears the apply's own answer — the pull outlasts the server's 60-second
    // write timeout, so the fetch resolves to no status at all — so an apply that
    // died at "identify this container" looked exactly like one still pulling.
    // Six minutes of waiting, then a message about reloading.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([
        up('3.0.0'),
        { ok: true, version: '3.0.0', phase: 'failed', error: 'identify this container: inspect self: docker 404' },
      ]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out.outcome).toBe(RESTART_FAILED)
    expect(out.why).toContain('docker 404')
  })

  it('treats "this box cannot self-update" as an ending too, not as a wait', async () => {
    // Nothing was attempted — no socket, no proxy. Waiting six minutes for a
    // restart nobody started is the worst of both answers.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([{ ok: true, version: '3.0.0', phase: 'unsupported', error: 'no such file: /var/run/docker.sock' }]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out.outcome).toBe(RESTART_FAILED)
    expect(out.why).toContain('docker.sock')
  })

  it('does not stop for a phase that is still in progress', async () => {
    // "pulling" is not an ending. A record that names a step the apply is still
    // inside must read as "keep waiting" — otherwise every slow pull reports a
    // failure and invites a second press.
    const c = fakeClock()
    const out = await waitForRestart({
      ping: scripted([
        { ok: true, version: '3.0.0', phase: 'pulling' },
        { ok: true, version: '3.0.0', phase: 'recreating' },
        gone,
        gone,
        { ok: true, version: '3.1.0', phase: 'launched' },
      ]),
      sleep: c.sleep,
      now: c.now,
      was: '3.0.0',
    })
    expect(out.outcome).toBe(RESTART_NEW)
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
    expect(out.outcome).toBe(RESTART_TIMEOUT)
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


// The OTHER half of the bound, and the half the loop cannot supply for itself.
//
// waitForRestart's race guarantees each TURN ends. It does not free the socket —
// the losing fetch is still open, still pending, and on a poll every three
// seconds for six minutes that is 120 abandoned connections to a box that is
// trying to boot. The abort signal is what closes them, and it is one line in
// api.js with no test of its own until now: reasoned about, never run.
describe('a request with a deadline on it', () => {
  const realFetch = global.fetch
  afterEach(() => { global.fetch = realFetch })

  it('gives up on a socket that is accepted and never answered', async () => {
    // THE SHAPE OF THE BUG, exactly: not a refusal, not an error — a fetch that
    // resolves never. Without a signal this await would hang the test.
    global.fetch = vi.fn((_url, opts) => new Promise((_res, rej) => {
      opts?.signal?.addEventListener('abort', () => rej(opts.signal.reason))
    }))
    const r = await json('GET', '/auth/me', undefined, { timeoutMs: 30 })
    // The same {ok:false, status:0} an unreachable server gives, so every caller
    // that branches on r.ok needs to know nothing about timeouts.
    expect(r).toEqual({ ok: false, status: 0, data: null })
  })

  it('passes a signal only when asked, so nothing else gains a deadline', async () => {
    // OFF BY DEFAULT is the important half: a timeout on an import or a backup
    // would abort work the server is really doing, and "took a while" is not an
    // error anywhere else in this app.
    global.fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    await json('GET', '/auth/me')
    expect(global.fetch.mock.calls[0][1].signal).toBeUndefined()
    await json('GET', '/auth/me', undefined, { timeoutMs: 5000 })
    expect(global.fetch.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('does not arm one for a zero or a missing bound', async () => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    await json('GET', '/x', undefined, { timeoutMs: 0 })
    await json('GET', '/x', undefined, {})
    for (const call of global.fetch.mock.calls) expect(call[1].signal).toBeUndefined()
  })
})
