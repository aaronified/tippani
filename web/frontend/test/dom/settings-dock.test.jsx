// The two ACTS on the Settings page are reachable from a thumb.
//
// Everything else on this page is a preference — you change it where it is drawn,
// and a dock key pointing at a toggle would be a door to a switch. Making an
// archive and installing a release are different: both are verbs, both live in
// admin-only cards six cards down a scroll on a phone.
//
// AND NEITHER KEY SKIPS THE DECISION, which is the half worth guarding. Backup
// still asks for the credential that seals the archive; the update still asks for
// the word UPDATE, typed. A one-tap update on a phone is precisely the accident
// that confirmation exists to prevent.

import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useScreenBarState } from '../../src/ui.jsx'

const AVAILABLE = {
  update_available: true,
  can_self_update: true,
  latest: '1.99.0',
  channel: 'stable',
  channel_explicit: true,
}

let applied = 0
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/admin/update/check') return { ok: true, data: AVAILABLE }
    if (path === '/admin/update/apply') { applied++; return { ok: true, data: {} } }
    if (path === '/admin/backup') return { ok: true, data: { backup: null } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '1.0.0' }
const READER = { ...ADMIN, is_admin: false }

let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

const asPhone = () => {
  window.matchMedia = (media) => ({
    matches: true, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

const page = (user = ADMIN) => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <>
        <Settings user={user} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />
        <Probe />
      </>,
    )
  } finally {
    quiet.mockRestore()
  }
}
const keys = () => (BAR.keys || []).map((k) => k.id)
const press = (id) => act(() => (BAR.keys || []).find((k) => k.id === id).onClick())

describe('the Settings dock', () => {
  it('carries the page’s two verbs and nothing else', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toEqual(['backup', 'update']))
  })

  it('offers neither to a reader who is not an admin', async () => {
    asPhone()
    page(READER)
    // Both cards are admin-only; a key to a card that is not on the page would
    // be a door to nothing.
    await waitFor(() => expect(BAR.keys).toBeNull())
  })

  it('opens the backup prompt rather than making one', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toContain('backup'))
    press('backup')
    // The archive is sealed with a credential, and the key does not invent one.
    await waitFor(() => expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThan(0))
  })

  it('checks before it offers, and still asks for the word', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toContain('update'))
    press('update')
    // The check runs on open: a key that showed a stale "nothing to do" would be
    // lying about the one thing it is for.
    // Scoped to the sheet: the card behind it draws the same confirmation off
    // the same state, which is the point — two views of one field cannot
    // disagree — but a bare query would not know which it had found.
    const sheet = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-card')
      expect(el, 'no sheet opened').toBeTruthy()
      return el
    })
    const box = await within(sheet).findByPlaceholderText('UPDATE')
    const start = applied
    // The wrong word does nothing, and says so before it is pressed — the button
    // is dead AND the handler refuses, because either one alone is a guard that
    // a change to the other silently removes.
    fireEvent.change(box, { target: { value: 'update' } })
    expect(within(sheet).getByRole('button', { name: /update/i }).disabled).toBe(true)
    fireEvent.submit(box.closest('form'))
    expect(applied).toBe(start)

    fireEvent.change(box, { target: { value: 'UPDATE' } })
    fireEvent.submit(box.closest('form'))
    await waitFor(() => expect(applied).toBe(start + 1))
  })
})
