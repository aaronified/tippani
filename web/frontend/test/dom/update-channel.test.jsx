// THE RELEASE-LINE TOGGLE on Settings → Updates.
//
// The bug it exists for: a branch build (version 3.0.0-edge.<sha>) is a run-up
// to a version no release has reached, so every published release is BEHIND it
// — and the card offered the newest of them as "an update", which would have
// walked a v3 tester back onto 2.x with one click. The server decides the
// default line from the version it is running; this file pins that the card
// shows that decision, says it is an implication rather than a choice, and
// re-checks when the reader overrides it.
//
// Re-checking is the part worth a test: without it the toggle moves, the label
// says "pre-release", and the release under it is still the stable one the last
// check found. Nothing about that reads as stale.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let CHECK // what GET /admin/update/check answers next

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path === '/admin/update/check') return { ok: true, data: CHECK }
    if (path === '/admin/update/channel') {
      CHECK = { ...CHECK, channel: body.channel || 'prerelease', channel_explicit: !!body.channel }
      if (body.channel === 'stable') CHECK = { ...CHECK, latest: 'v2.9.9', update_available: false }
      return { ok: true, data: { channel: CHECK.channel, channel_explicit: CHECK.channel_explicit } }
    }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { username: 'a', is_admin: true, version: '3.0.0-edge.f7ddba5', preferences: {} }

beforeEach(() => {
  CALLS = []
  CHECK = {
    current: '3.0.0-edge.f7ddba5',
    channel: 'prerelease',
    channel_explicit: false,
    latest: 'v3.0.0-rc.1',
    update_available: true,
    can_self_update: false,
    guided_command: 'docker compose up -d',
  }
})

async function openUpdates() {
  render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  fireEvent.click(await screen.findByText('Check for updates'))
  return await screen.findByText('pre-release')
}

describe('the release line', () => {
  it('is not offered at all until a check has said which line this build is on', async () => {
    render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
    await screen.findByText('Check for updates')
    expect(screen.queryByText('release line')).toBeNull()
  })

  it('shows the line the server implied, and says it was implied', async () => {
    await openUpdates()
    expect(screen.getByText('release line')).toBeTruthy()
    // The distinguishing half: the reader is told WHY it is on this line, so a
    // branch build's "pre-release" does not read as somebody else's setting.
    expect(screen.getByText(/you are running a pre-release build/)).toBeTruthy()
  })

  it('sends the override and re-checks, so the release on screen belongs to the new line', async () => {
    await openUpdates()
    expect(screen.getByText(/v3\.0\.0-rc\.1/)).toBeTruthy()

    fireEvent.click(screen.getByText('stable'))

    await waitFor(() => {
      const posts = CALLS.filter(([m, p]) => m === 'POST' && p === '/admin/update/channel')
      expect(posts).toHaveLength(1)
      expect(posts[0][2]).toEqual({ channel: 'stable' })
    })
    // Two checks: the one that opened the card, and the one the switch forced.
    await waitFor(() => {
      expect(CALLS.filter(([m, p]) => m === 'GET' && p === '/admin/update/check')).toHaveLength(2)
    })
    // And the implication note is gone, because it is a choice now.
    await waitFor(() => expect(screen.queryByText(/you are running a pre-release build/)).toBeNull())
  })
})
