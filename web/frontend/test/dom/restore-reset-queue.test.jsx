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
import { fireEvent, render, screen, within } from '@testing-library/react'
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

})
