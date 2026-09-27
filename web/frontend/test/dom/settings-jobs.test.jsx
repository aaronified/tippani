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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let CALLS
let CURRENT
let PAST
let LINES
let LOGS

const HOUR = 60 * 60 * 1000
const NOW = Date.now()
const job = (over) => ({
  id: 0, kind: 'fill', queued: true, subject: '', state: 'queued', params: {}, counts: {},
  error: '', total: 0, done: 0, ahead: 0, username: '', own: true, rerunnable: false, applied: false,
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
    if (method === 'POST' && p === '/jobs/stop-all') return { ok: true, data: { stopping: 1, stopped_waiting: 2 } }
    if (method === 'POST' && /^\/jobs\/\d+\/rerun$/.test(p)) return { ok: true, status: 202, data: { job: job({ id: 99 }) } }
    if (method === 'GET' && p === '/admin/logs') return { ok: true, data: { lines: LOGS, more: false } }
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
  LOGS = [{ id: 40, at: NOW - 60000, level: 'warn', code: 'TIP-NET-004', line: 'openlibrary.org answered 503' }]
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

describe('Current jobs', () => {
  it('counts what is running and what is waiting, in words, in its head', async () => {
    await page()
    const current = await card('Current jobs')
    await within(current).findByText(phrase('1 running'))
    expect(within(current).getByText(phrase('2 waiting'))).toBeTruthy()
  })

  it('opens the running job on its live log, and says of each waiting one how many are ahead', async () => {
    await page()
    const current = await card('Current jobs')
    const log = await within(current).findByRole('log', { name: 'Log of Fetch covers' })
    await within(log).findByText('«Rooms of Attention» — cover fetched')
    expect(within(current).getByRole('button', { name: 'Fetch covers', expanded: true })).toBeTruthy()
    expect(within(current).getByText('Waiting — one job ahead')).toBeTruthy()
    expect(within(current).getByText('Waiting — 2 jobs ahead')).toBeTruthy()
    expect(within(current).getByRole('button', { name: 'Stop Fetch covers' })).toBeTruthy()
  })

  it('asks before Stop all, says what happens to each job, and sends nothing on Cancel', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    expect(ask.textContent).toContain('The running job stops after the item in hand.')
    expect(ask.textContent).toContain('The 2 waiting are stopped before they start.')
    expect(ask.textContent).toContain('Each is kept with its log and can be run again.')
    // An admin's press reaches every reader's queue, and the confirm says so.
    expect(ask.textContent).toContain("This includes other readers' jobs.")
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(posted('/jobs/stop-all')).toHaveLength(0)
  })

  it('stops everything on the confirm, with one request, and says what it stopped', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Stop them' }))
    await waitFor(() => expect(posted('/jobs/stop-all')).toHaveLength(1))
    await screen.findByText('1 stopping · 2 stopped before starting')
  })

  it('tells a reader nothing about other readers’ jobs', async () => {
    await page(READER)
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    expect(ask.textContent).not.toContain('other readers')
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
  })

  it('draws no Stop all over an empty queue — absent, not disabled', async () => {
    CURRENT = []
    await page()
    const current = await card('Current jobs')
    await within(current).findByText('Nothing is running or waiting.')
    expect(within(current).getByText(phrase('0 waiting'))).toBeTruthy()
    expect(within(current).queryByRole('button', { name: 'Stop all' })).toBeNull()
  })
})

describe('Past jobs', () => {
  it('opens a finished job to its details, its log and an export of that log', async () => {
    await page()
    const past = await card('Past jobs')
    fireEvent.click(await within(past).findByRole('button', { name: /^Fill gaps/ }))
    await within(past).findByText('«The Paper Boat» — filled year, pages')
    expect(within(past).getByText('9 fields filled · 1 failed', { selector: 'dd' })).toBeTruthy()
    expect(within(past).getByText('2m 5s')).toBeTruthy()
    const exportLink = within(past).getByRole('link', { name: /Export/ })
    expect(exportLink.getAttribute('href')).toBe('/api/jobs/7/log.md')
  })

  // THE SERVER NAMES A JOB BY ITS KIND and this screen says the kind in words. The
  // People row's Fetch is the commonest single job there is, and for a stage it
  // came out as "Job" because the screen's list had not heard of it.
  it('names each job by what it did, and a kind it has no words for as a job', async () => {
    PAST = [
      job({ id: 4, kind: 'lookup.person', queued: false, subject: 'Ursula K. Le Guin', state: 'succeeded', finished_at: NOW - HOUR }),
      job({ id: 3, kind: 'lookup.cast-tvdb', queued: false, subject: 'Severance', state: 'succeeded', finished_at: NOW - 2 * HOUR }),
      job({ id: 2, kind: 'something.new', queued: false, subject: 'from a later server', state: 'succeeded', finished_at: NOW - 3 * HOUR }),
    ]
    await page()
    const past = await card('Past jobs')
    const row = await within(past).findByRole('button', { name: /^Person lookup/ })
    expect(within(row).getByText('Ursula K. Le Guin')).toBeTruthy()
    expect(within(past).getByRole('button', { name: /^Cast from TheTVDB/ })).toBeTruthy()
    const stranger = within(past).getByRole('button', { name: /^Job/ })
    expect(within(stranger).getByText('from a later server')).toBeTruthy()
  })

  it('narrows to how a job ended with the state chips', async () => {
    await page()
    const past = await card('Past jobs')
    await within(past).findByRole('button', { name: /^Fill gaps/ })
    fireEvent.click(within(past).getByRole('button', { name: 'Failed' }))
    await waitFor(() => expect(within(past).queryByRole('button', { name: /^Fill gaps/ })).toBeNull())
    expect(within(past).getByRole('button', { name: /^Back up/ })).toBeTruthy()
    expect(within(past).getByRole('button', { name: 'Failed', pressed: true })).toBeTruthy()
    expect(CALLS.some(([m, p]) => m === 'GET' && p.startsWith('/jobs?') && new URLSearchParams(p.split('?')[1]).get('state') === 'failed')).toBe(true)
  })

  it('asks the server to prune on the tab’s first page, and only then', async () => {
    await page()
    const past = await card('Past jobs')
    await within(past).findByRole('button', { name: /^Fill gaps/ })
    fireEvent.click(within(past).getByRole('button', { name: 'Failed' }))
    await waitFor(() => expect(within(past).queryByRole('button', { name: /^Fill gaps/ })).toBeNull())
    const reads = CALLS.filter(([m, p]) => m === 'GET' && p.startsWith('/jobs?') && p.includes('view=past'))
    expect(reads.filter(([, p]) => p.includes('prune=1'))).toHaveLength(1)
    expect(reads[0][1]).toContain('prune=1')
  })

  it('runs a backup again only through the credential prompt that sealed it', async () => {
    await page()
    const past = await card('Past jobs')
    fireEvent.click(await within(past).findByRole('button', { name: /^Back up/ }))
    fireEvent.click(await within(past).findByRole('button', { name: 'Run again' }))
    const prompt = await screen.findByRole('dialog', { name: 'Back up' })
    expect(posted('/jobs/6/rerun')).toHaveLength(0)
    fireEvent.change(within(prompt).getByLabelText(/Your password/i), { target: { value: 'hunter2' } })
    fireEvent.click(within(prompt).getByRole('button', { name: /^Back up$/ }))
    await waitFor(() => expect(posted('/jobs/6/rerun')).toHaveLength(1))
    expect(posted('/jobs/6/rerun')[0][2]).toEqual({ password: 'hunter2' })
  })

  it('offers Review on a re-verify nobody has applied, and opens it by its job', async () => {
    const onReviewJob = vi.fn()
    await page(ADMIN, { onReviewJob })
    const past = await card('Past jobs')
    fireEvent.click(await within(past).findByRole('button', { name: /^Re-verify/ }))
    fireEvent.click(await within(past).findByRole('button', { name: 'Review' }))
    expect(onReviewJob).toHaveBeenCalledWith(5)
  })
})

describe('System logs', () => {
  it('is an admin’s card, and a reader has no such card at all', async () => {
    await page(READER)
    await card('Past jobs')
    expect(screen.queryByRole('region', { name: 'System logs' })).toBeNull()
    // …and the bar stays Settings' own on the Jobs section for a reader.
    await waitFor(() => expect(HERE?.label).toBe('settings'))
  })

  it('reads every level but the file reads and the trace, over the last day, before anything is chosen', async () => {
    await page()
    const logs = await card('System logs')
    await within(logs).findByText('openlibrary.org answered 503', { exact: false })
    const first = logReads()[0]
    expect(first.get('level')).toBe('error,warn,info,request')
    const span = NOW - Number(first.get('from'))
    expect(span).toBeGreaterThan(23 * HOUR)
    expect(span).toBeLessThan(25 * HOUR + 60000)
    expect(within(logs).getByRole('button', { name: 'File', pressed: false })).toBeTruthy()
    expect(within(logs).getByRole('button', { name: 'Trace', pressed: false })).toBeTruthy()
  })

  it('sends the levels, the time range and the keyword the reader chose', async () => {
    await page()
    const logs = await card('System logs')
    await within(logs).findByText('openlibrary.org answered 503', { exact: false })
    fireEvent.click(within(logs).getByRole('button', { name: 'Trace' }))
    await waitFor(() => expect(logReads().at(-1).get('level')).toBe('error,warn,info,request,trace'))
    // The time range is the app's own dropdown.
    fireEvent.click(within(logs).getByRole('button', { name: /How far back/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'Last 7 days' }))
    await waitFor(() => {
      const span = Date.now() - Number(logReads().at(-1).get('from'))
      expect(span).toBeGreaterThan(6.9 * 24 * HOUR)
    })
    // The keyword is the shell's bar, which says it is searching the system logs.
    await waitFor(() => expect(HERE?.label).toBe('system logs'))
    act(() => HERE.onQuery('503'))
    await waitFor(() => expect(logReads().at(-1).get('q')).toBe('503'))
    // …mirrored in the card's own field on a desk.
    expect(within(logs).getByRole('searchbox', { name: 'Search the system logs' }).value).toBe('503')
  })

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
    expect(Number(params.get('to'))).toBeGreaterThanOrEqual(Number(params.get('from')))
    expect(within(logs).getByRole('link', { name: /Everything kept/ }).getAttribute('href')).toBe('/api/admin/logs.md?all=1')
  })
})

describe('the phone’s Jobs tile', () => {
  const desk = window.matchMedia
  afterEach(() => { window.matchMedia = desk })
  const asPhone = () => {
    window.matchMedia = (media) => ({
      matches: true, media, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })
  }
  const index = () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} />)
    } finally {
      quiet.mockRestore()
    }
  }
  // THE INDEX, NOT A SECTION: nothing is pressed, so what is on the screen is the
  // list of sections with each one's shortcuts under it — and the Jobs row's are
  // the only ones that count jobs or stop them.
  it('counts what is queued and offers one red Stop all, which asks first', async () => {
    asPhone()
    index()
    await screen.findByRole('navigation', { name: /which settings to change/i })
    await screen.findByText(phrase('2 waiting'))
    fireEvent.click(screen.getByRole('button', { name: 'Stop all' }))
    await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    expect(posted('/jobs/stop-all')).toHaveLength(0)
  })

  it('reads 0 and draws no Stop all when nothing runs or waits', async () => {
    CURRENT = []
    asPhone()
    index()
    await screen.findByText(phrase('0 waiting'))
    expect(screen.queryByRole('button', { name: 'Stop all' })).toBeNull()
  })
})
