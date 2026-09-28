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
// settings-jobs.test.jsx fakes the rest of the section. Which rows a viewer gets
// is the server's decision (the Go tier, common_jobs_test.go, holds it), so each
// case hands the fake the rows that viewer would get. What the test reads back
// from it is only what a request SAID — which kind and params a Run sent, whether
// a Stop was sent — and how often the card asked, because "it reads again closely
// after a Stop" is a claim about requests.
//
// No declared exception beyond that fake: nothing here names a class, a component
// or a module of the app.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const readerRows = () => adminRows().filter((r) => !r.admin_only)
const rowOf = (id) => COMMON.find((r) => r.id === id)

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const [p] = path.split('?')
    if (method === 'GET' && p === '/jobs/common') return { ok: true, data: { jobs: COMMON } }
    if (method === 'GET' && p === '/jobs') return { ok: true, data: { jobs: [], running: 0, waiting: 0, more: false } }
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

describe('the rows', () => {
  it('lists the four an admin may run, in order, each with what it does and how it went the last time', async () => {
    const card = await page()
    const titles = ['Fill gaps in every work', 'Fetch missing people', 'Fetch covers and details', 'Back up now'].map((n) => within(card).getByText(n))
    for (let i = 1; i < titles.length; i++) expect(before(titles[i - 1], titles[i]), `${titles[i].textContent} is out of order`).toBe(true)
    within(card).getByText('Looks up what every book and film is missing, and fills only the empty fields.')
    within(card).getByText('Seals the library into the one archive the server keeps.')

    // Run once, it is Run again, with how it ended and what it did.
    expect(within(card).getByRole('button', { name: 'Run again: Fill gaps in every work' })).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Run Fill gaps in every work' })).toBeNull()
    expect(within(card).getByRole('button', { name: /^Last run of Fill gaps in every work: Succeeded, / })).toBeTruthy()
    within(card).getByText('9 fields filled · 1 failed')
    expect(within(card).getByRole('button', { name: /^Last run of Fetch covers and details: Interrupted, / })).toBeTruthy()

    // Never run in the thirty days the server keeps, it says so and offers Run.
    expect(within(card).getAllByText('Not run in the last 30 days')).toHaveLength(2)
    expect(within(card).getByRole('button', { name: 'Run Fetch missing people' })).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Run Back up now' })).toBeTruthy()

    // The covers pass has its quick run too, as the Metadata page always had.
    expect(within(card).getByRole('button', { name: 'Fetch covers and details: missing only' })).toBeTruthy()
  })

  it('gives a reader the two rows the server lets them run, and nothing of the server’s own', async () => {
    COMMON = readerRows()
    const card = await page(READER)
    within(card).getByText('Fetch missing people')
    expect(within(card).queryByText('Back up now')).toBeNull()
    expect(within(card).queryByText('Fetch covers and details')).toBeNull()
    expect(within(card).getAllByRole('button', { name: /^Run/ }).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Run again: Fill gaps in every work', 'Run Fetch missing people'])
  })

  it('sits under Current jobs, where the job it starts appears', async () => {
    const card = await page()
    const current = await screen.findByRole('region', { name: /^Current jobs/ })
    const past = await screen.findByRole('region', { name: 'Past jobs' })
    expect(before(current, card)).toBe(true)
    expect(before(card, past)).toBe(true)
  })
})

describe('running one', () => {
  it('sends the row’s own job, and then shows it waiting with a Stop where Run was', async () => {
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: 'Run Fetch missing people' }))
    await waitFor(() => expect(posted('/jobs').map(([, , b]) => b)).toEqual([{ kind: 'people', params: { missing: true } }]))
    expect(await within(card).findByRole('button', { name: 'Stop Fetch missing people' })).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Run Fetch missing people' })).toBeNull()
    within(card).getByText('Waiting — one job ahead')
  })

  it('runs the covers pass whole, or for the missing art only', async () => {
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: 'Fetch covers and details: missing only' }))
    await waitFor(() => expect(posted('/jobs').map(([, , b]) => b)).toEqual([{ kind: 'covers', params: { missing_only: true } }]))
    rowOf('covers').current = null
    fireEvent.click(await within(card).findByRole('button', { name: 'Run again: Fetch covers and details' }))
    await waitFor(() => expect(posted('/jobs').map(([, , b]) => b).at(-1)).toEqual({ kind: 'covers', params: { missing_only: false } }))
  })

  it('asks for the backup’s credential first, through the Server card’s own prompt, and sends it with the job', async () => {
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: 'Run Back up now' }))
    const prompt = await screen.findByRole('dialog', { name: 'Back up' })
    expect(posted('/jobs'), 'the backup started before its credential was given').toEqual([])
    fireEvent.change(within(prompt).getByLabelText(/Your password/i), { target: { value: 'hunter2' } })
    fireEvent.click(within(prompt).getByRole('button', { name: /^Back up$/ }))
    await waitFor(() => expect(posted('/jobs').map(([, , b]) => b)).toEqual([{ kind: 'backup', params: { password: 'hunter2' } }]))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Back up' })).toBeNull())
  })
})

describe('stopping one', () => {
  const running = () => {
    rowOf('fill-all').current = job({ id: 21, kind: 'fill', params: { all: true }, state: 'running', total: 12, done: 3, finished_at: null })
  }

  it('says Stopping… at the press, before the server has answered', async () => {
    running()
    let answer
    STOP = (id) => new Promise((resolve) => { answer = () => resolve({ ok: true, data: { job: { id } } }) })
    const card = await page()
    within(card).getByText('Running · 3 of 12')
    fireEvent.click(within(card).getByRole('button', { name: 'Stop Fill gaps in every work' }))
    // The server has not answered yet.
    expect(within(card).getByText('Stopping after the item in hand…')).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Stop Fill gaps in every work' })).toBeNull()
    expect(posted('/jobs/21/stop')).toHaveLength(1)
    await act(async () => answer())
  })

  it('reads the row again closely after the Stop, and shows how the job ended as soon as it has', async () => {
    running()
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: 'Stop Fill gaps in every work' }))
    await waitFor(() => expect(posted('/jobs/21/stop')).toHaveLength(1))
    // Still running on the server: the card asks again well inside the two
    // seconds it waits between reads while a job runs.
    const pressed = reads()
    await waitFor(() => expect(reads() - pressed).toBeGreaterThanOrEqual(3), { timeout: 1500 })
    // It ends: the row says so at the next read and offers Run again.
    const r = rowOf('fill-all')
    r.last = { ...r.current, state: 'stopped', finished_at: Date.now() }
    r.current = null
    expect(await within(card).findByRole('button', { name: 'Run again: Fill gaps in every work' }, { timeout: 1000 })).toBeTruthy()
    expect(within(card).getByRole('button', { name: /^Last run of Fill gaps in every work: Stopped, / })).toBeTruthy()
  })

  it('puts the Stop back when the server refuses it, and says why', async () => {
    running()
    STOP = () => ({ ok: false, status: 404, data: { error: 'job not found' } })
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: 'Stop Fill gaps in every work' }))
    expect(await screen.findByText('job not found')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Stop Fill gaps in every work' })).toBeTruthy()
    expect(within(card).queryByText('Stopping after the item in hand…')).toBeNull()
  })
})

describe('the last run', () => {
  it('opens its log right there, and exports it', async () => {
    const card = await page()
    fireEvent.click(within(card).getByRole('button', { name: /^Last run of Fill gaps in every work/ }))
    expect(await within(card).findByText('every work in the library as the fill starts: 10 books and 2 films, shows and games')).toBeTruthy()
    const exp = within(card).getByRole('link', { name: 'Export' })
    expect(exp.getAttribute('href')).toMatch(/\/jobs\/7\/log\.md$/)
  })
})
