// A restore and a factory reset say what they will do to the job queue, before
// the first step.
//
// WHY. Both replace the database the queue lives in (3.1.0), so the server
// refuses them while a job is running and ends the jobs still waiting. Without a
// word at the top of the dialog a reader learns the first from a refusal — after
// downloading the safety copy that step one asks for — and the second not at
// all. So each prompt reads the queue when it opens and, while anything runs or
// waits, says so above step one; with nothing in the queue it says nothing.
//
// THE NETWORK: the queue's summary is answered by test/dom/helpers/jobsServer.js,
// which declares what it knows; the rest the way the neighbouring Settings and
// Profile tests fake it. What is asserted is what the dialog shows, and in what
// order a reader meets it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'
import { jobsServer } from './helpers/jobsServer.js'

let JOBS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    const job = JOBS.answer(method, path, body)
    if (job) return job
    if (method === 'GET' && path === '/admin/backup') {
      return { ok: true, data: { backup: { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true } } }
    }
    if (method === 'GET' && path === '/admin/users') return { ok: true, data: { users: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { Profile } = await import('../../src/Account.jsx')

const ADMIN = { id: 1, username: 'a', is_admin: true, preferences: {} }

beforeEach(() => {
  JOBS = jobsServer()
})

const RUNNING = 'Fill gaps is running. The restore is refused until it stops or finishes — stop it in Settings → Jobs first.'

// THE ORDER A READER MEETS THINGS IN: the notice, then step one's button.
const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('the restore prompt', () => {
  const openRestore = async () => {
    render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} onOpenBin={() => {}} />)
    await openSettingsSection('Server')
    fireEvent.click(await screen.findByRole('button', { name: /Restore…/ }))
    return screen.findByRole('dialog', { name: 'Restore' })
  }

  it('says a running job blocks it, above step one', async () => {
    JOBS.add({ kind: 'fill', state: 'running' })
    const dialog = await openRestore()
    const notice = await within(dialog).findByText(RUNNING)
    expect(before(notice, within(dialog).getByRole('button', { name: /Download a backup first/ }))).toBe(true)
  })

  it('says what becomes of the jobs waiting, too', async () => {
    JOBS.add({ kind: 'fill', state: 'running' })
    JOBS.add({ kind: 'covers', state: 'queued' })
    JOBS.add({ kind: 'people', state: 'queued' })
    const dialog = await openRestore()
    expect(await within(dialog).findByText(`${RUNNING} 2 jobs are waiting; a restore ends them, and each is kept as interrupted.`)).toBeTruthy()
  })

  it('names what is running by what it was about', async () => {
    JOBS.add({ kind: 'lookup.book', state: 'running', subject: 'Dune' })
    const dialog = await openRestore()
    expect(await within(dialog).findByText(/^Book lookup · Dune is running\./)).toBeTruthy()
  })

  it('says nothing about the queue when nothing runs or waits', async () => {
    const dialog = await openRestore()
    await waitFor(() => expect(JOBS.calls.some(([m, p]) => m === 'GET' && p === '/jobs/summary')).toBe(true))
    expect(within(dialog).queryByText(/is running\.|jobs? (is|are) waiting/)).toBeNull()
  })
})

describe('the factory reset', () => {
  const openReset = async () => {
    render(<Profile user={ADMIN} onUser={() => {}} logout={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reset all data…' }))
  }

  it('says a running job blocks it and a waiting one goes with everything, above step one', async () => {
    JOBS.add({ kind: 'backup', state: 'running' })
    JOBS.add({ kind: 'fill', state: 'queued' })
    await openReset()
    const notice = await screen.findByText('Back up is running. The reset is refused until it stops or finishes — stop it in Settings → Jobs first. One job is waiting; a reset deletes it with everything else.')
    expect(before(notice, screen.getByRole('button', { name: /Download a backup first/ }))).toBe(true)
  })

  it('asks the queue only when the reset is opened, and says nothing when it is empty', async () => {
    render(<Profile user={ADMIN} onUser={() => {}} logout={() => {}} />)
    await screen.findByRole('button', { name: 'Reset all data…' })
    expect(JOBS.calls.some(([, p]) => p === '/jobs/summary'), 'the summary was read before anybody opened the reset').toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Reset all data…' }))
    await waitFor(() => expect(JOBS.calls.some(([, p]) => p === '/jobs/summary')).toBe(true))
    expect(screen.queryByText(/is running\.|jobs? (is|are) waiting/)).toBeNull()
  })
})
