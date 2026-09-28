// The copy a factory reset (and a restore) takes first is a job: it waits its
// turn with a Stop beside it, and downloads once the server has sealed it.
//
// WHY. Every backup queues from 3.1.0 — the owner's answer of 28 September — and
// the safety copy is a backup. So the step no longer streams a file out of its
// press: it asks for the copy, says where it stands in the queue while it waits
// and while it is sealed, can be stopped there, and downloads the copy from the
// one address the finished job names. Only once the file is down does the reset
// open; a Stop, a failure or a refused download gives the button back with the
// reason, and downloads nothing.
//
// THE NETWORK: the jobs routes are answered by test/dom/helpers/jobsServer.js,
// which declares what it knows; the copy's own two addresses — the press
// (POST /admin/backup/safety, answered 202 with a job of kind backup.safety, or
// the 401 a wrong password gets) and the one download its job's result names —
// are faked here in the server's shapes, the press through the app's json() and
// the download through fetch, since the step saves a file from it; one case
// holds the watch's first read of the job unanswered (jobsServer's hangRead), so
// the step has only the press's own answer to go on. What is
// asserted is what the step shows and what the browser was handed to save: the
// name of the file an anchor was clicked for (the one way a page saves a file,
// which jsdom does not follow).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jobsServer } from './helpers/jobsServer.js'

let JOBS
let PRESSES // the bodies the copy was asked for with
let FETCHED // the addresses the step fetched a file from
let SAVED // the names the browser was handed a file under
let DOWNLOAD // how the one download answers: [status, body, headers]

const COPY = 'tippani-backup-20260928-120000-safety-copy.tpbk'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'POST' && path === '/admin/backup/safety') {
      PRESSES.push(body)
      if (body?.password === 'not-it') return { ok: false, status: 401, data: { error: 'that is not your password' } }
      const job = JOBS.add({ kind: 'backup.safety', state: 'queued', ahead: 2 })
      return { ok: true, status: 202, data: { job: { ...job } } }
    }
    const job = JOBS.answer(method, path, body)
    if (job) return job
    if (method === 'GET' && path === '/admin/users') return { ok: true, data: { users: [] } }
    return { ok: true, data: {} }
  }),
}))

const { Profile } = await import('../../src/Account.jsx')

const ADMIN = { id: 1, username: 'a', is_admin: true, preferences: {} }

beforeEach(() => {
  JOBS = jobsServer()
  PRESSES = []
  FETCHED = []
  SAVED = []
  DOWNLOAD = [200, 'TPBK sealed bytes', { 'Content-Disposition': `attachment; filename="${COPY}"` }]
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    FETCHED.push(String(url))
    const [status, body, headers] = DOWNLOAD
    return new Response(body, { status, headers })
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    SAVED.push(this.download)
  })
})

const openReset = async () => {
  render(<Profile user={ADMIN} onUser={() => {}} logout={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Reset all data…' }))
}

const askForTheCopy = async (password = 'hunter2') => {
  fireEvent.change(screen.getByLabelText('Your password, to seal the copy'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /Download a backup first/ }))
  await waitFor(() => expect(PRESSES).toEqual([{ password }]))
}

const theJob = () => [...JOBS.jobs.values()].find((j) => j.kind === 'backup.safety')
const resetButton = () => screen.getByRole('button', { name: 'Delete everything & restart' })

describe('the safety copy, as a job', () => {
  it('waits its turn with a Stop, and downloads the copy once its job has sealed it', async () => {
    await openReset()
    await askForTheCopy()

    expect(await screen.findByText('Waiting — 2 jobs ahead')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop the copy' })).toBeTruthy()
    expect(screen.getByLabelText('Your password, to seal the copy').disabled, 'the box stayed open while the copy was on its way').toBe(true)
    expect(resetButton().disabled, 'the reset opened before the copy was down').toBe(true)
    expect(SAVED).toEqual([])

    JOBS.finish(theJob().id, { result: { name: COPY, size: 17, url: '/admin/backup/safety/0f0f', expires_at: Date.now() + 300_000 } })
    expect(await screen.findByText(/^Copy downloaded\./, {}, { timeout: 4000 })).toBeTruthy()
    expect(FETCHED).toEqual(['/api/admin/backup/safety/0f0f'])
    expect(SAVED).toEqual([COPY])
    fireEvent.change(screen.getByPlaceholderText('RESET'), { target: { value: 'RESET' } })
    expect(resetButton().disabled, 'the reset stayed shut after the copy was down').toBe(false)
  })

  it('says a copy queued behind another job is waiting from the press, not being prepared', async () => {
    // The watch's first read of the job never comes back, so what the step says
    // is what the press itself was answered.
    JOBS.hangRead(1)
    await openReset()
    await askForTheCopy()
    expect(await screen.findByText('Waiting — 2 jobs ahead')).toBeTruthy()
    expect(screen.queryByText('Preparing the copy…'), 'a waiting copy was said to be under way').toBeNull()
  })

  it('says it is being sealed once its job runs', async () => {
    await openReset()
    await askForTheCopy()
    await screen.findByText('Waiting — 2 jobs ahead')
    Object.assign(theJob(), { state: 'running', ahead: 0 })
    expect(await screen.findByText('Preparing the copy…', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop the copy' })).toBeTruthy()
  })

  it('stops at once, downloads nothing, and offers the copy again', async () => {
    await openReset()
    await askForTheCopy()
    fireEvent.click(await screen.findByRole('button', { name: 'Stop the copy' }))
    expect(await screen.findByText('Stopped: no copy was made, and nothing of it is left on the server. Take it again when you are ready.')).toBeTruthy()
    expect(JOBS.stops()).toEqual([theJob().id])
    expect(screen.getByRole('button', { name: /Download a backup first/ }).disabled).toBe(false)
    expect(FETCHED).toEqual([])
    expect(SAVED).toEqual([])
    expect(resetButton().disabled).toBe(true)
  })

  it('says why a copy that failed was not made, and gives the button back', async () => {
    await openReset()
    await askForTheCopy()
    await screen.findByText('Waiting — 2 jobs ahead')
    JOBS.finish(theJob().id, { state: 'failed', error: 'a backup or restore is already running' })
    expect(await screen.findByText('a backup or restore is already running', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Download a backup first/ })).toBeTruthy()
    expect(SAVED).toEqual([])
    expect(resetButton().disabled).toBe(true)
  })

  it('is told a wrong password at once, and waits on nothing', async () => {
    await openReset()
    await askForTheCopy('not-it')
    expect(await screen.findByText('that is not your password')).toBeTruthy()
    expect(JOBS.calls.filter(([, p]) => /^\/jobs\/\d+/.test(p)), 'a job was followed for a copy the server refused').toEqual([])
    expect(screen.getByRole('button', { name: /Download a backup first/ }).disabled).toBe(false)
  })

  it('says so when the download is refused, and keeps the reset shut', async () => {
    DOWNLOAD = [404, JSON.stringify({ error: 'no such copy — take it again' }), { 'Content-Type': 'application/json' }]
    await openReset()
    await askForTheCopy()
    await screen.findByText('Waiting — 2 jobs ahead')
    JOBS.finish(theJob().id, { result: { name: COPY, size: 17, url: '/admin/backup/safety/0f0f', expires_at: Date.now() + 300_000 } })
    expect(await screen.findByText('no such copy — take it again', {}, { timeout: 4000 })).toBeTruthy()
    expect(SAVED).toEqual([])
    expect(screen.getByRole('button', { name: /Download a backup first/ })).toBeTruthy()
    expect(resetButton().disabled).toBe(true)
  })
})
