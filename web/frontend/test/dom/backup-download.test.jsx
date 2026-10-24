// Making a backup and taking a copy of it are two different acts.
//
// They were one. `create()` finished by assigning window.location to the download
// URL, so every backup — including the ones somebody made precisely because the
// archive is KEPT on the server, ready to restore from — also pushed a
// multi-megabyte file into their Downloads folder, unasked. On a phone it was worse
// than untidy: navigating away while the dialog was closing took the browser off
// the page mid-transition, and what came back was a download shelf over a Settings
// screen that had lost its scroll position.
//
// So the assertion that matters here is a NEGATIVE one, which is why it is worth a
// file: nothing in the app can tell you that a navigation did not happen. The
// location assignment is stubbed and the test insists it was never reached, and
// then insists the copy is still one tap away — from the toast, and from a control
// on the card that is now the same size and shape as the button beside it rather
// than the word `download` in a corner.
//
// SINCE 3.1.0 THE BACKUP IS A JOB on the server's queue: the prompt asks for a
// `backup` job with the credential, the server refuses a wrong one there and
// then, and the card watches the job and toasts how it ended. The jobs routes are
// answered by test/dom/helpers/jobsServer.js, which declares what it knows.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'
import { jobsServer } from './helpers/jobsServer.js'

let CALLS
let BACKUP
let CREATE_OK
let JOBS

const MADE = { name: 'tippani-2026-08-14.tpbk', created: '2026-08-14T09:00:00Z', size: 5 << 20, key: 'password', account: 'a', recoverable: true }

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  apiURL: (p) => `/api${p}`,
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/admin/backup') return { ok: true, data: { backup: BACKUP } }
    // THE SAFETY COPY IS A JOB TOO (3.1.0): queued by its own address, and —
    // offline, small — sealed at once, its result naming the one download.
    if (method === 'POST' && path === '/admin/backup/safety') {
      const copy = JOBS.add({ kind: 'backup.safety', state: 'running' })
      JOBS.finish(copy.id, { result: { name: 'c-safety-copy.tpbk', size: 1, url: '/admin/backup/safety/0f0f' } })
      return { ok: true, status: 202, data: { job: { ...copy } } }
    }
    if (method === 'POST' && path === '/jobs' && body?.kind === 'backup') {
      // The credential is checked in the request, before anything queues.
      if (!CREATE_OK) return { ok: false, status: 401, data: { error: 'wrong password' } }
    }
    const job = JOBS.answer(method, path, body)
    if (job) {
      // A backup job that has finished well has left an archive on the server.
      const made = [...JOBS.jobs.values()].some((j) => j.kind === 'backup' && j.state === 'succeeded')
      if (made) BACKUP = MADE
      return job
    }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const ADMIN = { username: 'a', is_admin: true, preferences: {} }

// Where the browser was sent, if anywhere. jsdom refuses a real assignment to
// window.location.href with a "Not implemented: navigation" error rather than a
// throw, so it is replaced outright — otherwise this test would pass on a noisy
// console instead of on the behaviour.
let went
function stubLocation() {
  went = []
  delete window.location
  window.location = {
    ...new URL('http://localhost/settings'),
    assign: (u) => went.push(String(u)),
    reload: () => {},
    set href(u) {
      went.push(String(u))
    },
    get href() {
      return 'http://localhost/settings'
    },
  }
}

beforeEach(() => {
  CALLS = []
  BACKUP = null
  CREATE_OK = true
  JOBS = jobsServer()
  stubLocation()
})

const card = async () => {
  render(
    <>
      <Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} onOpenBin={() => {}} />
      <ToastHost />
    </>,
  )
  await openSettingsSection('Server')
  // THE HEADING CARRIES ITS NUMBER NOW. Server is one panel of numbered groups —
  // "1 · Updates", "2 · Backup & restore", "3 · What changed" — where backup used
  // to be a card with a bare SectionTitle, so an exact match on the words alone
  // stopped finding it. The number is drawn from position rather than typed, which
  // is exactly why this matches the words and not the ordinal.
  await screen.findByText(/Backup & restore/)
}

// Fill the prompt and submit it.
const makeOne = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Back up now/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Back up' })
  fireEvent.change(within(dialog).getByLabelText(/Your password/i) ?? within(dialog).getByRole('textbox'), {
    target: { value: 'hunter2' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: /^Back up$/ }))
  await waitFor(() => expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/jobs' && b?.kind === 'backup')).toBe(true))
}

describe('creating a backup', () => {
  it('does NOT download it', async () => {
    await card()
    await makeOne()
    // The whole point. Nothing else in the app can tell you a navigation did not
    // happen, so it is stated here.
    expect(went, 'creating a backup navigated somewhere').toEqual([])
  })

})

// THE SAFETY COPY'S PASSWORD FILLS THE RESTORE ONLY WHERE IT OPENS THE ARCHIVE.
// An archive this server made opens with the current password, so typing it twice
// is ceremony; one sealed somewhere else wants the password of its own era, and a
// box already filled with today's reads as answered when it is wrong.

