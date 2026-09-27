// Settings › Jobs asks the server on a schedule, and the schedule is what a
// reader gets from it: a log that moves while a job runs, a queue that notices a
// job started on another screen — and a tab that costs nothing while nobody is
// looking at it.
//
// WHAT IS PROMISED, as the spec writes it (F):
//   - a running job's log is asked for every second, and every three once ten
//     answers in a row brought nothing new;
//   - nothing is asked while the tab is hidden, and the first thing showing it
//     does is ask;
//   - a job that says it finished is asked ONCE more (its last lines can land a
//     beat after its state), then never again;
//   - the current jobs are asked for every two seconds while anything runs or
//     waits, every ten while nothing does;
//   - a finished job's log in Past jobs is read until it is all there and then
//     left alone, and three failed reads of one end the asking;
//   - a read the server accepts and never answers does not stop any of it.
//
// A CLOCK IS THE ONE THING A READER CANNOT BE ASKED TO WATCH, so the clock here
// is vitest's and the reader's side is the requests: which went out, and when.
// The screen is mounted and pressed exactly as settings-jobs.test.jsx does; the
// only thing moved by hand is time.
//
// DECLARED EXCEPTION: this file knows the network seam every Settings test here
// fakes — api.js's `json(method, path, body, options)` — including its fourth
// argument. The last case is about a request that is accepted and never
// answered, which settles only if the caller bounded it; the bound is that
// option, and a fake that ignored it could not tell a bounded poll from one that
// hangs for ever.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let CURRENT
let PAST
let JOBS // id → () => the answer to GET /jobs/{id}
let HANG // paths whose NEXT request is accepted and never answered

const NOW = Date.now()
const job = (over) => ({
  id: 0, kind: 'fill', queued: true, subject: '', state: 'queued', params: {}, counts: {},
  error: '', total: 0, done: 0, ahead: 0, username: '', own: true, rerunnable: false, applied: false,
  rerun_of: null, from_job: null, created_at: NOW - 60000, started_at: null, finished_at: null,
  ...over,
})

function answer(method, path) {
  const [p, qs = ''] = path.split('?')
  const q = new URLSearchParams(qs)
  if (method === 'GET' && p === '/jobs') {
    const jobs = q.get('view') === 'current' ? CURRENT : PAST
    return { ok: true, status: 200, data: { jobs, running: jobs.filter((j) => j.state === 'running').length, waiting: jobs.filter((j) => j.state === 'queued').length, more: false } }
  }
  const one = /^\/jobs\/(\d+)$/.exec(p)
  if (method === 'GET' && one && JOBS[one[1]]) return JOBS[one[1]]()
  return { ok: true, status: 200, data: {} }
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn((method, path, body, options = {}) => {
    const hung = HANG.find((re) => re.test(path))
    CALLS.push({ method, path, at: Date.now(), hung: !!hung })
    if (hung) {
      HANG = HANG.filter((re) => re !== hung)
      // An open socket: nothing comes back unless the caller set a bound, in which
      // case it gives up exactly as api.js does — {ok:false, status:0}.
      return new Promise((resolve) => {
        if (options?.timeoutMs > 0) setTimeout(() => resolve({ ok: false, status: 0, data: null }), options.timeoutMs)
      })
    }
    return Promise.resolve(answer(method, path))
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const READER = { id: 2, username: 'bina', is_admin: false, preferences: {}, version: '3.1.0' }

// ---- the tab's visibility, which jsdom leaves at "visible" for ever ----------
let visibility = 'visible'
beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterAll(() => { delete document.visibilityState })

const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const hide = () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) }
const show = async () => {
  visibility = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  await tick(0)
}

const reads = (re) => CALLS.filter((c) => c.method === 'GET' && re.test(c.path))
const currentReads = () => reads(/^\/jobs\?view=current(&|$)/)
const jobReads = (id) => reads(new RegExp(`^/jobs/${id}\\?`))
const gaps = (list) => list.slice(1).map((c, i) => c.at - list[i].at)

beforeEach(() => {
  // Date is faked with the timers, so a request's `at` is the fake clock's.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  CALLS = []
  HANG = []
  visibility = 'visible'
  CURRENT = []
  PAST = []
  JOBS = {}
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const page = async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(<Settings user={READER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} />)
    await openSettingsSection('Jobs')
    await tick(0)
  } finally {
    quiet.mockRestore()
  }
}

// A running job whose every answer is the same: no new lines, no progress.
const stillRunning = (id, over = {}) => {
  const j = job({ id, kind: 'covers', state: 'running', total: 40, done: 12, started_at: NOW - 30000, ...over })
  CURRENT = [j]
  JOBS[id] = () => ({ ok: true, status: 200, data: { job: { ...j }, lines: [], more: false } })
  return j
}

describe('the current jobs', () => {
  it('are asked for every two seconds while something runs', async () => {
    stillRunning(10)
    await page()
    await tick(10000)
    const list = currentReads()
    expect(list.length).toBeGreaterThanOrEqual(5)
    expect(new Set(gaps(list))).toEqual(new Set([2000]))
  })

  it('and every ten seconds while nothing runs or waits', async () => {
    await page()
    await tick(30000)
    const list = currentReads()
    expect(list).toHaveLength(4) // on arrival, then at 10, 20 and 30 seconds
    expect(new Set(gaps(list))).toEqual(new Set([10000]))
  })
})

describe('a running job’s log', () => {
  it('is asked for every second, and every three once ten answers in a row bring nothing new', async () => {
    const j = stillRunning(10)
    await page()
    await tick(20000)
    const g = gaps(jobReads(10))
    expect(g.slice(0, 10)).toEqual(Array(10).fill(1000))
    expect(g[10]).toBe(3000)
    // …and the moment something moves, it is back to every second.
    JOBS[10] = () => ({ ok: true, status: 200, data: { job: { ...j, done: 13 }, lines: [], more: false } })
    const changedAt = Date.now()
    await tick(6000)
    // The first read after the change hears it; from there the gaps are a second.
    const since = jobReads(10).filter((c) => c.at >= changedAt)
    expect(gaps(since).slice(0, 3)).toEqual([1000, 1000, 1000])
  })

  it('is read once more after the job says it finished, and then never again', async () => {
    const j = stillRunning(10)
    await page()
    await tick(2000)
    // The current list has not caught up — it still says running — so the row and
    // its log stay on the screen. Only the job's own answer has changed.
    JOBS[10] = () => ({ ok: true, status: 200, data: { job: { ...j, state: 'succeeded', done: 40, finished_at: Date.now() }, lines: [], more: false } })
    const before = jobReads(10).length
    await tick(30000)
    // The read that first hears "succeeded", and exactly one after it.
    expect(jobReads(10).length).toBe(before + 2)
  })
})

describe('a hidden tab', () => {
  it('asks nothing, and asks at once when it is shown again', async () => {
    stillRunning(10)
    visibility = 'hidden'
    await page()
    await tick(30000)
    expect(currentReads()).toHaveLength(0)
    expect(jobReads(10)).toHaveLength(0)
    await show()
    expect(currentReads()).toHaveLength(1)
  })

  it('stops a log that is already moving, and picks it up where it left off', async () => {
    stillRunning(10)
    await page()
    await tick(3000)
    const current = currentReads().length
    const log = jobReads(10).length
    expect(log).toBeGreaterThan(0)
    hide()
    await tick(30000)
    expect(currentReads().length).toBe(current)
    expect(jobReads(10).length).toBe(log)
    await show()
    expect(currentReads().length).toBe(current + 1)
    expect(jobReads(10).length).toBe(log + 1)
  })
})

describe('a finished job’s log in Past jobs', () => {
  const pastRow = async () => {
    const past = screen.getByRole('region', { name: 'Past jobs' })
    fireEvent.click(within(past).getByRole('button', { name: /^Fill gaps/ }))
    await tick(0)
  }

  it('is read until it is all there, and then left alone', async () => {
    const done = job({ id: 7, state: 'succeeded', started_at: NOW - 90000, finished_at: NOW - 60000 })
    PAST = [done]
    JOBS[7] = () => ({ ok: true, status: 200, data: { job: done, lines: [{ id: 1, at: NOW - 70000, level: 'info', line: 'filled year' }], more: false } })
    await page()
    await pastRow()
    await tick(30000)
    expect(jobReads(7)).toHaveLength(1)
  })

  it('stops asking after three failed reads in a row', async () => {
    PAST = [job({ id: 7, state: 'failed', started_at: NOW - 90000, finished_at: NOW - 60000 })]
    JOBS[7] = () => ({ ok: false, status: 500, data: { error: 'the database is busy' } })
    await page()
    await pastRow()
    await tick(60000)
    expect(jobReads(7)).toHaveLength(3)
  })
})

describe('a read the server accepts and never answers', () => {
  it('does not stop the current jobs being asked for', async () => {
    HANG = [/^\/jobs\?view=current/]
    await page()
    await tick(25000)
    expect(currentReads()[0].hung).toBe(true)
    expect(currentReads().length).toBeGreaterThanOrEqual(2)
  })

  it('does not stop a running job’s log being asked for', async () => {
    stillRunning(10)
    HANG = [/^\/jobs\/10\?/]
    await page()
    await tick(15000)
    expect(jobReads(10)[0].hung).toBe(true)
    expect(jobReads(10).length).toBeGreaterThanOrEqual(2)
  })
})
