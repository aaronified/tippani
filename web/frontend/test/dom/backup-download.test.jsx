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

  it('asks for the archive, not for the archive AND a copy of it', async () => {
    // The label named two acts, which is how the second one got welded on.
    await card()
    fireEvent.click(screen.getByRole('button', { name: /Back up now/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Back up' })
    expect(within(dialog).getByRole('button', { name: /^Back up$/ })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /download/i })).toBeNull()
  })

  it('offers the copy in the toast, one tap away', async () => {
    await card()
    await makeOne()
    const download = await screen.findByRole('button', { name: 'Download' })
    fireEvent.click(download)
    expect(went).toEqual(['/api/admin/backup/download'])
  })

  it('says only that it was created — the five-word rule', async () => {
    await card()
    await makeOne()
    // "backup created — downloading" was true only because of the bug.
    expect(await screen.findByText('backup created')).toBeTruthy()
  })

  it('offers nothing to download when the backup failed', async () => {
    CREATE_OK = false
    await card()
    await makeOne()
    await screen.findByText(/wrong password/i)
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(went).toEqual([])
  })
})

describe('the backup, as a job', () => {
  it('is asked for with the credential typed into the prompt', async () => {
    await card()
    await makeOne()
    expect(JOBS.started()).toEqual([['backup', { password: 'hunter2' }]])
  })

  // THE PROMPT CLOSES AND THE CARD WATCHES: the archive is sealed on the server,
  // and the button says so until the job ends — then the new archive is on the
  // card, and the toast offers the copy.
  it('keeps the card busy while its job runs, then shows the new archive', async () => {
    JOBS.hold('backup')
    await card()
    await makeOne()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Back up' })).toBeNull())
    const busy = await screen.findByRole('button', { name: /Backing up/ })
    expect(busy.disabled).toBe(true)
    const [id] = [...JOBS.jobs.keys()]
    JOBS.finish(id)
    expect(await screen.findByText('backup created', {}, { timeout: 4000 })).toBeTruthy()
    expect(await screen.findByRole('link', { name: /Download the last one/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Back up now/ }).disabled).toBe(false)
  })

  // LIVE FROM THE PRESS: between the start's answer and the card's first read of
  // the job there is an id and no job to draw, and a Back up now that came back
  // for that beat invites a second backup behind the first. The beat is held open.
  it('stays busy between the start and the first read of its job', async () => {
    JOBS.hold('backup')
    JOBS.hangRead(2)
    await card()
    await makeOne()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Back up' })).toBeNull())
    await waitFor(() => expect(JOBS.reads(100)).toBe(2))
    expect(screen.queryByRole('button', { name: /Back up now/ }), 'Back up now came back before its job was read').toBeNull()
    expect(screen.getByRole('button', { name: /Backing up/ }).disabled).toBe(true)
  })

  it('says where it stands while it waits behind another job', async () => {
    JOBS.plan('backup', { queued: true, ahead: 1 })
    JOBS.hold('backup')
    await card()
    await makeOne()
    expect(await screen.findByText('Waiting — one job ahead')).toBeTruthy()
  })

  // THE SEAL CAN STILL FAIL AFTER THE PRESS — the password changed while the job
  // waited, say — and the card says so in the job's own words, with nothing
  // offered to download.
  it('says why when its job fails, and offers nothing to download', async () => {
    JOBS.plan('backup', { state: 'failed', error: 'your password changed since this backup was started — run it again' })
    await card()
    await makeOne()
    expect(await screen.findByText('your password changed since this backup was started — run it again', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })

  it('says a stopped backup stopped', async () => {
    JOBS.plan('backup', { state: 'stopped' })
    await card()
    await makeOne()
    expect(await screen.findByText('backup stopped', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
  })
})

describe('the download control on the card', () => {
  it('is not offered before there is anything to download', async () => {
    await card()
    expect(screen.queryByRole('link', { name: /Download the last one/ })).toBeNull()
    expect(screen.getByText(/no backup on this server yet/)).toBeTruthy()
  })

  it('appears once an archive exists, as a real link', async () => {
    // An anchor rather than a button on purpose: a real href is what gives it
    // middle-click, "save link as", and a URL you can read before committing to a
    // multi-megabyte file.
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true }
    await card()
    const link = await screen.findByRole('link', { name: /Download the last one/ })
    expect(link.getAttribute('href')).toBe('/api/admin/backup/download')
  })

  it('carries a glyph, and reads as a control rather than a footnote', async () => {
    // It was the bare word `download` beside a button, which read as a footnote to
    // the backup rather than the other half of it — and mattered less while
    // creating one downloaded it anyway.
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true }
    await card()
    const link = await screen.findByRole('link', { name: /Download the last one/ })
    expect(link.querySelector('svg')).toBeTruthy()
    expect(link.className).toContain('tp-btn')
  })

  it('says where the archive lives, now that creating one does not hand it over', async () => {
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true }
    await card()
    expect(await screen.findByText(/kept on this server until the next one/)).toBeTruthy()
  })
})

describe('every button on the card has a glyph', () => {
  it('Back up now, Choose file… and Restore… all draw one', async () => {
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true }
    await card()
    for (const name of [/Back up now/, /Restore…/]) {
      expect(screen.getByRole('button', { name }).querySelector('svg'), String(name)).toBeTruthy()
    }
    // The file picker only exists once "A file" is the chosen source. The source
    // control is a Toggle, whose options are tabs rather than buttons.
    fireEvent.click(screen.getByRole('tab', { name: 'A file' }))
    const choose = await screen.findByRole('button', { name: /Choose file/ })
    expect(choose.querySelector('svg')).toBeTruthy()
  })

  it('keeps their words at every width', async () => {
    // Every control here either replaces the whole instance or writes a
    // multi-megabyte file. A glyph is a thing you have to have learned already,
    // and none of these is a thing to find out by trying.
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'a', recoverable: true }
    await card()
    for (const name of [/Back up now/, /Restore…/]) {
      const b = screen.getByRole('button', { name })
      expect(b.querySelector('.btn-label-fixed'), String(name)).toBeTruthy()
      expect(b.className, String(name)).not.toContain('has-btn-icon')
    }
  })

  it('gives the prompt’s own three controls glyphs too', async () => {
    await card()
    fireEvent.click(screen.getByRole('button', { name: /Back up now/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Back up' })
    // Scoped to the form: the dialog's header carries a CloseButton whose label is
    // also "Cancel", and it has always had its glyph.
    const form = dialog.querySelector('form')
    for (const name of [/^Back up$/, /^Cancel$/, /passphrase instead/]) {
      expect(within(form).getByRole('button', { name }).querySelector('svg'), String(name)).toBeTruthy()
    }
  })
})

// THE SAFETY COPY'S PASSWORD FILLS THE RESTORE ONLY WHERE IT OPENS THE ARCHIVE.
// An archive this server made opens with the current password, so typing it twice
// is ceremony; one sealed somewhere else wants the password of its own era, and a
// box already filled with today's reads as answered when it is wrong.
describe('the password typed for the safety copy', () => {
  const takeCopy = async (recoverable) => {
    BACKUP = { name: 'x.tpbk', created: '2026-08-14T09:00:00Z', size: 2 << 20, key: 'password', account: 'someone-else', recoverable }
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'attachment; filename="c-safety-copy.tpbk"' },
      blob: async () => new Blob(['x']),
    }))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await card()
    fireEvent.click(screen.getByRole('button', { name: /Restore…/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Restore' })
    fireEvent.change(within(dialog).getByLabelText(/to seal the copy/), { target: { value: 'hunter2' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Download a backup first/ }))
    await within(dialog).findByText(/Copy downloaded/)
    return within(dialog).getByLabelText(/^Your password(?!,)/)
  }

  it('fills the restore when this server made the archive', async () => {
    expect((await takeCopy(true)).value).toBe('hunter2')
  })

  it('leaves it empty when the archive was sealed somewhere else', async () => {
    expect((await takeCopy(false)).value).toBe('')
  })
})
