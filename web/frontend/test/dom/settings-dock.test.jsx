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
import { act, render, screen, waitFor } from '@testing-library/react'
import { useScreenBarState } from '../../src/ui.jsx'
import { openSettingsSection } from './helpers/settingsSection.jsx'

const AVAILABLE = {
  update_available: true,
  can_self_update: true,
  latest: '1.99.0',
  channel: 'stable',
  channel_explicit: true,
}

let applied = 0
let checks = 0
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/admin/update/check') { checks++; return { ok: true, data: AVAILABLE } }
    if (path === '/admin/update/apply') { applied++; return { ok: true, data: {} } }
    if (path === '/admin/backup') return { ok: true, data: { backup: null } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '1.0.0' }

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

  it('opens the backup prompt rather than making one', async () => {
    asPhone()
    page()
    await openSettingsSection('Server')
    await waitFor(() => expect(keys()).toContain('backup'))
    press('backup')
    // The archive is sealed with a credential, and the key does not invent one.
    await waitFor(() => expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThan(0))
  })

})
