// Settings › Jobs › Common jobs: the jobs a reader runs again and again, each in a
// place of its own.
//
// THE OWNER'S ASK, 28 September: "add a list of common jobs, that can be
// restarted from there itself, and as such will have a persistent place" — and,
// asked which, all four of Back up now, Fetch covers and details, Fill gaps in
// every work and Fetch missing people.
//
// WHAT A READER COMES HERE TO DO, and so what this file presses: find the job by
// its name, see how it went the last time, run it (again) from its row, stop it
// from the same row while it runs or waits, and open the last run's log. An admin
// has four rows; a reader the two they may run.
//
// THE NETWORK IS A SMALL FAKE SERVER, answering GET /jobs/common, POST /jobs and
// POST /jobs/{id}/stop in the shapes the jobs contract fixes, the way
// settings-jobs.test.jsx fakes the rest of the section, and GET /jobs, whose
// current view is the jobs the rows say are running or waiting, since one server
// answers both cards. Which rows a viewer gets
// is the server's decision (the Go tier, common_jobs_test.go, holds it), so each
// case hands the fake the rows that viewer would get. What the test reads back
// from it is only what a request SAID — which kind and params a Run sent, whether
// a Stop was sent — and how often the card asked, because "it reads again closely
// after a Stop" is a claim about requests.
//
// No declared exception beyond that fake: nothing here names a class, a component
// or a module of the app.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let COMMON
let LINES
let STOP // how the fake answers a Stop: a function of the job's id
let NEXT_ID

const HOUR = 60 * 60 * 1000
const NOW = Date.now()
const job = (over) => ({
  id: 0, kind: 'fill', queued: true, subject: '', state: 'succeeded', params: {}, counts: {},
  error: '', total: 0, done: 0, ahead: 0, username: '', own: true, rerunnable: true, applied: false,
  rerun_of: null, from_job: null, created_at: NOW - HOUR, started_at: NOW - HOUR, finished_at: NOW - HOUR + 60000,
  ...over,
})
const row = (id, kind, params, adminOnly, over = {}) => ({ id, kind, params, admin_only: adminOnly, last: null, current: null, ...over })
const adminRows = () => [
  row('fill-all', 'fill', { all: true }, false, {
    last: job({ id: 7, kind: 'fill', params: { all: true }, counts: { fields: 9, failed: 1 }, total: 12, done: 12 }),
  }),
  row('people-missing', 'people', { missing: true }, false),
  row('covers', 'covers', { missing_only: false }, true, {
    last: job({ id: 5, kind: 'covers', state: 'interrupted', counts: { fetched: 15 }, total: 40, done: 17 }),
  }),
  row('backup', 'backup', {}, true),
]
const rowOf = (id) => COMMON.find((r) => r.id === id)

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const [p, query = ''] = path.split('?')
    if (method === 'GET' && p === '/jobs/common') return { ok: true, data: { jobs: COMMON } }
    // Current jobs is the same jobs the rows say are running or waiting, since it
    // is one server answering both; Past jobs is empty.
    if (method === 'GET' && p === '/jobs') {
      const live = new URLSearchParams(query).get('view') === 'current' ? COMMON.map((c) => c.current).filter(Boolean) : []
      const n = (state) => live.filter((j) => j.state === state).length
      return { ok: true, data: { jobs: live, running: n('running'), waiting: n('queued'), more: false } }
    }
    // A Run: the job it made waits behind one other, and is its row's current job
    // from the next read on.
    if (method === 'POST' && p === '/jobs') {
      const made = job({ id: NEXT_ID++, kind: body.kind, params: body.params, state: 'queued', ahead: 1, started_at: null, finished_at: null })
      const r = COMMON.find((c) => c.kind === body.kind)
      if (r) r.current = made
      return { ok: true, status: 202, data: { job: made } }
    }
    const one = /^\/jobs\/(\d+)$/.exec(p)
    if (method === 'GET' && one) {
      const id = Number(one[1])
      const found = COMMON.flatMap((c) => [c.last, c.current]).find((j) => j && j.id === id)
      return found ? { ok: true, data: { job: found, lines: LINES[id] || [], more: false } } : { ok: false, status: 404, data: { error: 'job not found' } }
    }
    const stop = /^\/jobs\/(\d+)\/stop$/.exec(p)
    if (method === 'POST' && stop) return STOP(Number(stop[1]))
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '3.1.0' }
const READER = { ...ADMIN, id: 2, username: 'bina', is_admin: false }

beforeEach(() => {
  CALLS = []
  COMMON = adminRows()
  NEXT_ID = 100
  LINES = { 7: [{ id: 1, at: NOW - HOUR, level: 'info', line: 'every work in the library as the fill starts: 10 books and 2 films, shows and games' }] }
  STOP = (id) => ({ ok: true, data: { job: { id } } })
})

afterEach(() => {
  vi.clearAllMocks()
})

const page = async (user = ADMIN) => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <>
        <Settings user={user} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} />
        <ToastHost />
      </>,
    )
  } finally {
    quiet.mockRestore()
  }
  await openSettingsSection('Jobs')
  const card = await screen.findByRole('region', { name: 'Common jobs' })
  await within(card).findByText('Fill gaps in every work')
  return card
}
const posted = (path) => CALLS.filter(([m, p]) => m === 'POST' && p === path)
const reads = () => CALLS.filter(([m, p]) => m === 'GET' && p === '/jobs/common').length
// Where an element sits among its card's, for "in this order".
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('stopping one', () => {
  // Each case's job is a job of its own, with an id of its own, as the server's
  // jobs are: a Stop pressed on one job is never a Stop pressed on another.
  const running = (id) => {
    rowOf('fill-all').current = job({ id, kind: 'fill', params: { all: true }, state: 'running', total: 12, done: 3, finished_at: null })
  }
  // A Stop the server has not answered yet, and the way to answer it.
  const unanswered = () => {
    let answer
    STOP = (id) => new Promise((resolve) => { answer = () => resolve({ ok: true, data: { job: { id } } }) })
    return () => answer()
  }
  const currentCard = () => screen.findByRole('region', { name: /^Current jobs/ })

  it('says Stopping… at the press, before the server has answered', async () => {
    running(21)
    const answer = unanswered()
    const card = await page()
    within(card).getByText('Running · 3 of 12')
    fireEvent.click(within(card).getByRole('button', { name: 'Stop Fill gaps in every work' }))
    // The server has not answered yet.
    expect(within(card).getByText('Stopping…')).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Stop Fill gaps in every work' })).toBeNull()
    expect(posted('/jobs/21/stop')).toHaveLength(1)
    await act(async () => answer())
  })

})
