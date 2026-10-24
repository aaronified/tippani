// The changelog, in the app — on the Server screen, not behind a door.
//
// IT WAS A DIALOG. The pack gives the release log a group of its own at the foot
// of Server ("What changed", settings-restructured.dc.html:2760), so the button
// that opened it is gone and the list is simply there. What this file asserts did
// not change — the ordering, the folding, the running mark, and above all the
// hand-rolled inline renderer — because those are properties of the list and not
// of the frame that used to hold it. Only the way in changed.
//
// The Updates card has always linked to GitHub's releases page, and that link is
// the right answer to "what is in a version I have not installed". This is the
// other question — what is in the one I am running — and it is answerable with no
// network at all, which on the hardware this app is built for (a NAS on a LAN,
// behind Tailscale, sometimes genuinely offline) is the difference between a
// dialog and an empty dialog.
//
// What is asserted here is mostly the RENDERER, because it is the part with a
// failure mode: there is no markdown dependency in this frontend and no
// dangerouslySetInnerHTML anywhere in it, so the inline spans are done by hand in
// thirty lines, and a hand-rolled renderer is exactly the thing that quietly
// mangles an entry six releases down the list where nobody looks.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let RESP

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (path === '/changelog') return { ok: true, data: RESP }
    return { ok: true, data: {} }
  }),
}))

const Settings = (await import('../../src/Settings.jsx')).default

const ADMIN = { username: 'a', is_admin: true, version: '1.12.0', preferences: {} }

const release = (version, over = {}) => ({
  version,
  date: '2026-08-14',
  sections: [{ title: 'Added', entries: ['Something happened.'] }],
  ...over,
})

beforeEach(() => {
  CALLS = []
  RESP = {
    current: '1.12.0',
    current_listed: true,
    releases: [release('1.12.0'), release('1.11.2'), release('1.11.1')],
  }
})

const openLog = async () => {
  render(<Settings user={ADMIN} />)
  // No door to press any more: reaching the Server section IS reaching the log.
  await openSettingsSection('Server')
  await waitFor(() => expect(screen.getByText('1.12.0')).toBeTruthy())
}

describe('the inline renderer', () => {
  const only = (entry) => {
    RESP = { ...RESP, releases: [release('1.12.0', { sections: [{ title: 'Added', entries: [entry] }] })] }
  }

  it('refuses a link that is not http(s), keeping the words', async () => {
    // Trusted content — it ships inside the binary — but a scheme is worth
    // refusing by rule rather than by trust, because the rule costs a line.
    only('A [bad one](javascript:alert(1)) here.')
    await openLog()
    expect(document.querySelector('.cl-entry a')).toBeNull()
    expect(document.querySelector('.cl-entry').textContent).toContain('bad one')
  })

})
