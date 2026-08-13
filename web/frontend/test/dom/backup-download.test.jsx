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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let BACKUP
let CREATE_OK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  apiURL: (p) => `/api${p}`,
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/admin/backup') return { ok: true, data: { backup: BACKUP } }
    if (method === 'POST' && path === '/admin/backup') {
      if (!CREATE_OK) return { ok: false, status: 403, data: { error: 'wrong password' } }
      BACKUP = { name: 'tippani-2026-08-14.tpbk', created: '2026-08-14T09:00:00Z', size: 5 << 20, key: 'password', account: 'a', recoverable: true }
      return { ok: true, data: { backup: BACKUP } }
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
  stubLocation()
})

const card = async () => {
  render(
    <>
      <Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} onOpenBin={() => {}} />
      <ToastHost />
    </>,
  )
  await screen.findByText('Backup & restore')
}

// Fill the prompt and submit it.
const makeOne = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Back up now/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Back up' })
  fireEvent.change(within(dialog).getByLabelText(/Your password/i) ?? within(dialog).getByRole('textbox'), {
    target: { value: 'hunter2' },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: /^Back up$/ }))
  await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/admin/backup')).toBe(true))
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
    expect(await screen.findByText(/kept on this server until the next one replaces it/)).toBeTruthy()
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
