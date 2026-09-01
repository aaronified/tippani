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
  const confirm = await screen.findByPlaceholderText('UPDATE')
  fireEvent.change(confirm, { target: { value: 'UPDATE' } })
  await act(async () => {
    screen.getByText('Update & restart now').closest('button').click()
  })
  await screen.findByText(/updating & restarting/)
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
    expect(screen.getByText(/updating & restarting/)).toBeTruthy()
  })

  it('reloads once the version answering is a different one', async () => {
    await startUpdate()
    await tick(2)
    expect(RELOAD).not.toHaveBeenCalled()

    DOWN = true
    await tick(2)
    DOWN = false
    VERSION = '3.1.1'
    await tick(1)
    expect(RELOAD).toHaveBeenCalled()
  })

  it('stops the moment the server says the apply died, and names the step', async () => {
    // THE FAILURE THE PAGE COULD NOT SEE, and the one that was reported: "the
    // page gets stuck on this message, and the app is not even posting any
    // update command on the docker shell."
    //
    // The apply identifies its own container by asking the Engine about the
    // machine's HOSTNAME, so a compose file that sets `hostname:` gets a 404
    // there — before a single image is pulled. The page had no way to learn that:
    // the apply's own answer almost never arrives (the pull outlasts the server's
    // 60-second write timeout, so the browser's fetch resolves to no status at
    // all), so it waited six minutes for a version that was never going to
    // change and then said something about reloading.
    //
    // Now the server writes down which step it reached and the page reads it.
    await startUpdate()
    await tick(1)
    expect(RELOAD).not.toHaveBeenCalled()

    PHASE = 'failed'
    PHASE_ERROR = 'identify this container: inspect self: docker 404'
    await tick(1)

    expect(RELOAD).not.toHaveBeenCalled()
    // The Engine's own words, on the card and not only in a toast — this is the
    // line that gets pasted into an issue.
    expect(await screen.findByText(/inspect self: docker 404/)).toBeTruthy()
    expect(TOASTS.join(' ')).toContain('docker 404')
    // And it is over: no more waiting for a restart that was never started.
    expect(screen.queryByText(/updating & restarting/)).toBeNull()
  })

  it('does not stop for a step the apply is still inside', async () => {
    // "pulling" is not an ending. A record naming a step in progress must read as
    // keep waiting, or every slow pull reports a failure and invites a second
    // press — which is the thing the apply lock exists to refuse.
    await startUpdate()
    PHASE = 'pulling'
    await tick(4)
    expect(screen.getByText(/updating & restarting/)).toBeTruthy()
    expect(RELOAD).not.toHaveBeenCalled()
  })

  it('says so when it comes back on the build it left on', async () => {
    await startUpdate()
    // Down for two turns, then back — with the same version, which is what a
    // branch build does when the image behind the tag has not been rebuilt.
    DOWN = true
    await tick(2)
    DOWN = false
    await tick(1)

    expect(RELOAD).not.toHaveBeenCalled()
    expect(TOASTS.join(' ')).toMatch(/running the same build/)
  })

  // ONE FAILED POLL IS NOT A RESTART. A dropped request is at least as likely as
  // a container being stopped, and treating it as one would report "it came back
  // on the same build" about a container that never went anywhere.
  it('does not call a single dropped request a restart', async () => {
    await startUpdate()
    DOWN = true
    await tick(1)
    DOWN = false
    await tick(3)
    expect(RELOAD).not.toHaveBeenCalled()
    expect(screen.getByText(/updating & restarting/)).toBeTruthy()
  })
})
