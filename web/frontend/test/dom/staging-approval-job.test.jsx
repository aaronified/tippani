// APPROVING IS A JOB, AND THE SCREEN THAT PRESSED IT FOLLOWS IT.
//
// The owner's ask of Settings → Jobs: "If any eligible action is run, a job will
// be created and queued … No action should skip through." Approving staged quotes
// is the one import step that writes to the library, and until 3.1.0 it was also
// the one no screen could see: it ran in its request, beside whatever the queue
// was running. So the press is answered with a job, and Pending import follows it
// the way Settings → Jobs does — where it stands in the queue, how far it has
// got, a Stop — and reads the queue again when it ends, saying what it added.
//
// WHAT IT KNOWS, declared: the fake below answers as the server does, so it knows
// the addresses the page reaches — the queue at /import/staged, the approval at
// /import/staged/approve, and the wire contract jobs.js owns for a job: the list
// at /jobs?view=current, the job at /jobs/{id} (its id, kind, state, done, total,
// ahead, own), its result at /jobs/{id}/result, whose {status, body} is what the
// approval's request answered before it queued, and Stop at /jobs/{id}/stop.
// Nothing cheaper than a server can say what a job is doing, and a journey cannot
// hold an approval mid-run; the words asserted are the ones on the screen.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// What each read of the approval's job says, in turn (the last one repeated).
let states = []
let reads = 0
// The approval's result once it has ended, or null for one stopped before it ran.
let result = null
// A job already running when the page opens, or null.
let live = null
let calls = []

const JOB = 9
const job = (over) => ({ id: JOB, kind: 'import.approve', own: true, done: 0, total: 2, ahead: 0, ...over })

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    calls.push({ method, path, body })
    if (method === 'GET' && path === '/import/staged') {
      return { ok: true, data: { pending: 2, batches: BATCHES, works: WORKS, quotes: QUOTES } }
    }
    if (method === 'GET' && path.startsWith('/jobs?')) {
      return { ok: true, data: { jobs: live ? [live] : [], running: live ? 1 : 0, waiting: 0 } }
    }
    if (method === 'POST' && path === '/import/staged/approve') {
      return { ok: true, status: 202, data: { job: job({ state: 'queued', ahead: 1 }) } }
    }
    if (method === 'GET' && path.startsWith(`/jobs/${JOB}?`)) {
      const s = states[Math.min(reads++, states.length - 1)]
      return { ok: true, data: { job: job(s), lines: [] } }
    }
    if (method === 'GET' && path === `/jobs/${JOB}/result`) {
      return { ok: true, data: { kind: 'import.approve', result } }
    }
    if (method === 'POST' && path === `/jobs/${JOB}/stop`) return { ok: true, data: { job: job({ state: 'running' }) } }
    return { ok: true, data: {} }
  },
  errText: (r, fallback) => (r.data && r.data.error) || fallback,
  coverImgURL: () => '',
}))

const BATCHES = [{ id: 1, filename: 'kindle.txt', source: 'kindle', quotes: 2 }]
const WORKS = [
  { id: 1, kind: 'book', title: 'Dune', quotes: 1, batch_id: 1, target_id: 42, target_title: 'Dune', target_cover: '' },
  { id: 2, kind: 'book', title: 'Solaris', quotes: 1, batch_id: 1, target_id: 7, target_title: 'Solaris', target_cover: '' },
]
const q = (id, workId, text) => ({
  id, staged_work_id: workId, batch_id: 1, quote: text,
  chapter: '', chapter_no: 0, location: '', character: '', actor: '',
  season: null, episode: null, timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
})
const QUOTES = [q(11, 1, 'The spice must flow.'), q(12, 2, 'We do not want other worlds.')]

const { default: StagingPage } = await import('../../src/StagingPage.jsx')

const noop = () => {}
const queueReads = () => calls.filter((c) => c.method === 'GET' && c.path === '/import/staged').length
const approveAll = () =>
  fireEvent.click([...document.querySelectorAll('button')].find((b) => /^Approve all/.test(b.textContent.trim())))

beforeEach(() => {
  states = []
  reads = 0
  result = null
  live = null
  calls = []
})

describe('an approval pressed here', () => {
  it('says where it waits, then how far it has got, then what it added', async () => {
    states = [{ state: 'queued', ahead: 1 }, { state: 'running', done: 1 }, { state: 'succeeded', done: 2 }]
    result = { status: 200, body: { added: 2, skipped: 0, enriched: 0 } }
    render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} />)
    await screen.findByText(/The spice must flow/)
    const before = queueReads()
    approveAll()
    expect(await screen.findByText('Waiting — one job ahead')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(await screen.findByText('Approving — 1 of 2', undefined, { timeout: 3000 })).toBeTruthy()
    // It ends: the queue is read again, and the flash says what went in.
    expect(await screen.findByText('2 added · 0 skipped', undefined, { timeout: 3000 })).toBeTruthy()
    expect(queueReads()).toBeGreaterThan(before)
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
  })

  it('can be stopped from here, and says it stopped and what it had added', async () => {
    states = [{ state: 'running', done: 1 }, { state: 'running', done: 1 }, { state: 'stopped', done: 1 }]
    result = { status: 200, body: { added: 1, skipped: 0, enriched: 0 } }
    render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} />)
    await screen.findByText(/The spice must flow/)
    approveAll()
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === `/jobs/${JOB}/stop`)).toBe(true))
    expect(screen.getByText(/^Stopping/)).toBeTruthy()
    expect(await screen.findByText('1 added · 0 skipped · Stopped', undefined, { timeout: 4000 })).toBeTruthy()
  })

  it('stopped before its first work, it says so and no error', async () => {
    states = [{ state: 'stopped' }]
    result = null
    render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} />)
    await screen.findByText(/The spice must flow/)
    approveAll()
    expect(await screen.findByText('0 added · 0 skipped · Stopped')).toBeTruthy()
    expect(screen.queryByText('could not approve')).toBeNull()
  })
})

describe('an approval already under way', () => {
  it('is followed when the page opens, with its Stop, until it ends', async () => {
    live = job({ state: 'running', done: 1 })
    states = [{ state: 'running', done: 1 }, { state: 'succeeded', done: 2 }]
    result = { status: 200, body: { added: 2, skipped: 0, enriched: 0 } }
    render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} />)
    // Nothing pressed here: the bar and its Stop are the job found running.
    expect(await screen.findByText('Approving — 1 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(await screen.findByText('2 added · 0 skipped', undefined, { timeout: 3000 })).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/import/staged/approve')).toBe(false)
  })
})
