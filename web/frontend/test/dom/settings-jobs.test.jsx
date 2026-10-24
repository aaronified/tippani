// Settings › Jobs: what is running, what waits, what finished, and — for an admin —
// the server's own log.
//
// WHAT A READER COMES HERE TO DO, and so what this file presses: read the two
// counts, stop everything (and be asked first, in words that say what happens to
// each job), open a finished job and take its log away, run it again, and — as an
// admin — narrow the system log and export exactly what is on the screen.
//
// THE NETWORK IS A SMALL FAKE SERVER, answering in the shapes the jobs contract
// fixes, the way the neighbouring Settings tests fake theirs. What the test reads
// back from it is only what a request SAID — which path, which filters, whether a
// Stop all was sent at all — because "the screen sent the query the reader chose"
// is the claim, and a request is where a query becomes a fact.
//
// DECLARED EXCEPTION, one: "red" is read through test/css-cascade.js — the
// stylesheet the app ships, resolved over the button's own classes, whatever
// they are. jsdom paints nothing, so the colour a reader would see can only be
// asked of the cascade; no class name is spelled here.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let CURRENT
let PAST
let LINES
let LOGS
let LOGS_MORE
let STOPALL
let HANG_STOP // a Stop the server accepts and has not answered yet

const HOUR = 60 * 60 * 1000
const NOW = Date.now()
// THE SERVER'S CLOCK, which is not this browser's: the window the fake server
// says it read is set by it, as the real one's is by its own now.
const SERVER_NOW = Date.parse('2026-09-27T12:00:00Z')
const job = (over) => ({
  id: 0, kind: 'fill', queued: true, subject: '', state: 'queued', params: {}, counts: {},
  error: '', total: 0, done: 0, ahead: 0, username: '', own: true, rerunnable: false, carried: false, applied: false,
  rerun_of: null, from_job: null, created_at: NOW - HOUR, started_at: null, finished_at: null,
  ...over,
})

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const [p, qs = ''] = path.split('?')
    const q = new URLSearchParams(qs)
    if (method === 'GET' && p === '/jobs') {
      if (q.get('view') === 'current') {
        return { ok: true, data: { jobs: CURRENT, running: CURRENT.filter((j) => j.state === 'running').length, waiting: CURRENT.filter((j) => j.state === 'queued').length, more: false } }
      }
      const state = q.get('state')
      return { ok: true, data: { jobs: PAST.filter((j) => !state || j.state === state), running: 0, waiting: 0, more: false } }
    }
    const one = /^\/jobs\/(\d+)$/.exec(p)
    if (method === 'GET' && one) {
      const id = Number(one[1])
      const found = [...CURRENT, ...PAST].find((j) => j.id === id)
      const after = Number(q.get('log_after') || 0)
      return { ok: true, data: { job: found, lines: (LINES[id] || []).filter((l) => l.id > after), more: false } }
    }
    if (method === 'POST' && p === '/jobs/stop-all') return { ok: true, data: STOPALL }
    if (method === 'POST' && /^\/jobs\/\d+\/stop$/.test(p) && HANG_STOP) return new Promise(() => {})
    if (method === 'POST' && /^\/jobs\/\d+\/rerun$/.test(p)) return { ok: true, status: 202, data: { job: job({ id: 99 }) } }
    if (method === 'GET' && p === '/admin/logs') {
      const from = Number(q.get('from')) || SERVER_NOW - Number(q.get('since'))
      return { ok: true, data: { lines: LOGS, more: LOGS_MORE, from, upto: Number(q.get('upto')) || 41 } }
    }
    if (method === 'GET' && p === '/admin/backup') return { ok: true, data: { backup: null } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { ToastHost, useScreenSearchState } = await import('../../src/ui.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '3.1.0' }
const READER = { ...ADMIN, id: 2, username: 'bina', is_admin: false }

// The shell's search bar, as the shell sees it: which context it is in, and what
// it calls as the reader types. Rendering the whole shell to type into its field
// would test the shell; this is the one thing it hands a screen.
let HERE = null
const BarProbe = () => {
  HERE = useScreenSearchState()
  return null
}

beforeEach(() => {
  CALLS = []
  HERE = null
  CURRENT = [
    job({ id: 10, kind: 'covers', state: 'running', total: 40, done: 12, started_at: NOW - 60000 }),
    job({ id: 11, kind: 'fill', state: 'queued', ahead: 1 }),
    job({ id: 12, kind: 'lookup.book', state: 'queued', ahead: 2, subject: 'The Dispossessed' }),
  ]
  PAST = [
    job({ id: 7, kind: 'fill', state: 'succeeded', counts: { fields: 9, failed: 1 }, rerunnable: true, started_at: NOW - 2 * HOUR, finished_at: NOW - 2 * HOUR + 125000 }),
    job({ id: 6, kind: 'backup', state: 'failed', error: 'the disk is full', rerunnable: true, started_at: NOW - 3 * HOUR, finished_at: NOW - 3 * HOUR + 4000 }),
    job({ id: 5, kind: 'reverify', state: 'succeeded', counts: { items: 20, changes: 4 }, started_at: NOW - 4 * HOUR, finished_at: NOW - 4 * HOUR + 30000 }),
  ]
  LINES = {
    10: [{ id: 1, at: NOW - 30000, level: 'info', line: '«Rooms of Attention» — cover fetched' }],
    7: [{ id: 2, at: NOW - 2 * HOUR, level: 'info', line: '«The Paper Boat» — filled year, pages' }],
  }
  STOPALL = { stopping: 1, stopped_waiting: 2 }
  HANG_STOP = false
  LOGS = [{ id: 40, at: NOW - 60000, level: 'warn', code: 'TIP-NET-004', line: 'openlibrary.org answered 503' }]
  LOGS_MORE = false
})

const page = async (user = ADMIN, extra = {}) => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <>
        <Settings user={user} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} {...extra} />
        <BarProbe />
        <ToastHost />
      </>,
    )
  } finally {
    quiet.mockRestore()
  }
  await openSettingsSection('Jobs')
}
const card = (name) => screen.findByRole('region', { name })
// A COUNT READS AS ONE PHRASE — "2 waiting" — though the figure and its word are
// two pieces of text beside a glyph. So it is matched as a reader reads it: the
// smallest element whose whole text is the phrase.
const phrase = (words) => (_, el) => {
  const text = (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return text === words && ![...(el?.children || [])].some((c) => c.textContent.replace(/\s+/g, ' ').trim() === words)
}
const posted = (path) => CALLS.filter(([m, p]) => m === 'POST' && p === path)
const logReads = () => CALLS.filter(([m, p]) => m === 'GET' && p.startsWith('/admin/logs?')).map(([, p]) => new URLSearchParams(p.split('?')[1]))

const RED = 'var(--error)'

describe('Current jobs', () => {

  it('asks before Stop all, says what happens to each job, and sends nothing on Cancel', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    expect(ask.textContent).toContain('The running job stops at once, and the item it has in hand is left untouched.')
    expect(ask.textContent).toContain('The 2 waiting are stopped before they start.')
    // Only the reader who started a job can run it again, so the sentence says
    // exactly that — an admin stopping somebody else's cannot rerun it.
    expect(ask.textContent).toContain('Each is kept with its log, and whoever started it can run it again.')
    // An admin's press reaches every reader's queue, and the confirm says so.
    expect(ask.textContent).toContain("This includes other readers' jobs.")
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(posted('/jobs/stop-all')).toHaveLength(0)
  })

})

describe('System logs', () => {

  it('exports exactly what the filters show, or everything the server keeps', async () => {
    await page()
    const logs = await card('System logs')
    await within(logs).findByText('openlibrary.org answered 503', { exact: false })
    fireEvent.change(within(logs).getByRole('searchbox', { name: 'Search the system logs' }), { target: { value: 'openlibrary' } })
    await waitFor(() => expect(logReads().at(-1).get('q')).toBe('openlibrary'))
    const shown = within(logs).getByRole('link', { name: /What is shown/ }).getAttribute('href')
    expect(shown.startsWith('/api/admin/logs.md?')).toBe(true)
    const params = new URLSearchParams(shown.split('?')[1])
    expect(params.get('level')).toBe('error,warn,info,request')
    expect(params.get('q')).toBe('openlibrary')
    // The window the list was read over, as the server answered it.
    expect(Number(params.get('from'))).toBe(SERVER_NOW - 24 * HOUR)
    expect(params.get('upto')).toBe('41')
    expect(within(logs).getByRole('link', { name: /Export all the logs kept/ }).getAttribute('href')).toBe('/api/admin/logs.md?all=1')
  })

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

