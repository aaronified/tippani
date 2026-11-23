// Settings › Server: the system logs, which an admin reads to find out why a
// lookup failed. The reader narrows the window, pages back through it, and
// exports exactly what is on the screen.
//
// THE NETWORK IS A SMALL FAKE SERVER, answering in the shape the logs contract
// fixes. What the test reads back from it is only what a request SAID — which
// path, which filters — because "the screen sent the query the reader chose" is
// the claim, and a request is where a query becomes a fact.
//
// DECLARED EXCEPTION, one: the logs are read through the section the screen
// opens on, which is found by its name on the rail — no class name is spelled.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let LOGS
let LOGS_MORE

const HOUR = 60 * 60 * 1000
// THE SERVER'S CLOCK, which is not this browser's: the window the fake server
// says it read is set by it, as the real one's is by its own now.
const SERVER_NOW = Date.parse('2026-09-27T12:00:00Z')

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const [p, qs = ''] = path.split('?')
    const q = new URLSearchParams(qs)
    if (method === 'GET' && p === '/admin/logs') {
      const from = Number(q.get('from')) || SERVER_NOW - Number(q.get('since'))
      return { ok: true, data: { lines: LOGS, more: LOGS_MORE, from, upto: Number(q.get('upto')) || 41 } }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '3.1.0' }

beforeEach(() => {
  CALLS = []
  LOGS = [{ id: 40, at: SERVER_NOW - 60000, level: 'warn', code: 'TIP-NET-004', line: 'openlibrary.org answered 503' }]
  LOGS_MORE = false
})

const page = async (user = ADMIN) => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <>
        <Settings user={user} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} />
        <ToastHost />
      </>,
    )
  } finally {
    quiet.mockRestore()
  }
  await openSettingsSection('Server')
}
const card = (name) => screen.findByRole('region', { name })
const logReads = () => CALLS.filter(([m, p]) => m === 'GET' && p.startsWith('/admin/logs?')).map(([, p]) => new URLSearchParams(p.split('?')[1]))

describe('System logs', () => {

  // A BROWSER WHOSE CLOCK IS MONTHS BEHIND THE SERVER'S — the journey tier's is
  // fixed at 2026-01-01 — reads, pages and exports the server's window. When the
  // screen sent its own clock, the export's window ended before the lines on the
  // card and the file held none of them.
  it('reads, pages and exports the server’s window when this browser’s clock is months out', async () => {
    const real = Date.now.bind(Date)
    const skew = Date.parse('2026-01-01T12:00:00Z') - real()
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => real() + skew)
    try {
      LOGS_MORE = true
      await page()
      const logs = await card('System logs')
      await within(logs).findByText('openlibrary.org answered 503', { exact: false })
      expect(logReads()[0].get('since')).toBe(String(24 * HOUR))

      fireEvent.click(within(logs).getByRole('button', { name: 'Load older' }))
      await waitFor(() => expect(logReads().length).toBe(2))
      const next = logReads()[1]
      expect(Number(next.get('from'))).toBe(SERVER_NOW - 24 * HOUR)
      expect(next.get('upto')).toBe('41')
      expect(next.get('before')).toBe('40')

      const shown = new URLSearchParams(within(logs).getByRole('link', { name: /What is shown/ }).getAttribute('href').split('?')[1])
      expect(Number(shown.get('from'))).toBe(SERVER_NOW - 24 * HOUR)
      expect(shown.get('upto')).toBe('41')
      expect(shown.has('to')).toBe(false)
    } finally {
      clock.mockRestore()
    }
  })
})
