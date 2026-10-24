// THE ONE-CLICK UPDATE, AND THE THING IT USED TO DO INSTEAD.
//
// The reported bug, in the reader's words: "it shows updating and then after a
// bit, refreshes, but does not update anything." The cause is in the polling,
// not in the update: the card reloaded on the FIRST successful /auth/me, and the
// first one is three seconds after the apply — while this container is still up
// and answering, because the recreater has not stopped it yet. So it reloaded
// onto the build it was already running, every time, and the update it started
// finished afterwards to an empty room.
//
// So what these pin is that the page does not reload until the VERSION has
// changed, and that a container which restarts onto the same build is reported
// as exactly that rather than as a success. The second case is not theoretical:
// on a branch build the check offers an update because the BRANCH moved, and the
// image that tag points at may not have been rebuilt yet.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let VERSION // what GET /admin/update/state answers with, when it answers at all
let DOWN // true while the container is being recreated
// The apply's own record of where it got to (internal/httpapi/update_progress.go).
// Empty for the ordinary run; a test that wants a stopped apply sets it.
let PHASE = ''
let PHASE_ERROR = ''
let RELOAD
let TOASTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/auth/me') {
      if (DOWN) return { ok: false, status: 0, data: null }
      return { ok: true, data: { username: 'a', is_admin: true, version: VERSION } }
    }
    // THE WAIT ASKS THE SERVER WHAT IT DID, not just whether it is up. The apply's
    // answer almost never reaches the browser — the pull outlasts the server's
    // 60-second write timeout — so "is it back yet" and "what did it do" are one
    // request, and the version comes back in the same reply as the phase so the
    // two cannot disagree.
    if (path === '/admin/update/state') {
      if (DOWN) return { ok: false, status: 0, data: null }
      return { ok: true, data: { attempted: true, phase: PHASE, error: PHASE_ERROR, current: VERSION } }
    }
    if (path === '/admin/update/check') return { ok: true, data: CHECK }
    if (path === '/admin/update/apply') return { ok: true, data: { ok: true } }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

vi.mock('../../src/ui.jsx', async (orig) => ({
  ...(await orig()),
  // The outcome of a failed wait is a toast, and the toast host lives in the
  // shell rather than in this card — so the message is captured here rather than
  // looked for in a DOM that never draws it.
  toast: vi.fn((m) => TOASTS.push(m)),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { username: 'a', is_admin: true, version: '3.1.0', preferences: {} }
let CHECK

beforeEach(() => {
  VERSION = '3.1.0'
  DOWN = false
  PHASE = ''
  PHASE_ERROR = ''
  CHECK = {
    current: '3.1.0',
    channel: 'stable',
    channel_explicit: true,
    latest: 'v3.1.1',
    update_available: true,
    can_self_update: true,
    guided_command: 'docker compose up -d',
  }
  TOASTS = []
  RELOAD = vi.fn()
  // jsdom's own location.reload navigates and warns; the assertion here is
  // whether it was CALLED, so it is replaced wholesale.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: RELOAD },
  })
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

// Drive the card to the point where the update has been started.
async function startUpdate() {
  render(<Settings user={ADMIN} onPreferences={() => {}} update={CHECK} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Server')
  const confirm = await screen.findByPlaceholderText('UPDATE')
  fireEvent.change(confirm, { target: { value: 'UPDATE' } })
  await act(async () => {
    screen.getByText('Update & restart now').closest('button').click()
  })
  await screen.findByText(/updating and restarting/i)
}

// One poll turn: the card waits three seconds, then asks.
const tick = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
  }
}

describe('waiting for the new version', () => {
  it('does not reload while the old container is still answering', async () => {
    await startUpdate()
    // Five turns — fifteen seconds — of this build answering happily. The old
    // code reloaded on the first of them.
    await tick(5)
    expect(RELOAD).not.toHaveBeenCalled()
    expect(screen.getByText(/updating and restarting/i)).toBeTruthy()
  })

  // ONE FAILED POLL IS NOT A RESTART. A dropped request is at least as likely as
  // a container being stopped, and treating it as one would report "it came back
  // on the same build" about a container that never went anywhere.
  
})
