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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'
import { valueOf } from '../css-cascade.js'

let CALLS
let CURRENT
let PAST
let LINES
let LOGS
let STOPALL

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
    if (method === 'POST' && p === '/jobs/stop-all') return { ok: true, data: STOPALL }
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
  STOPALL = { stopping: 1, stopped_waiting: 2 }
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
// The colour a reader sees on a control, from the shipped stylesheet (see the header).
const inkOf = (el) => valueOf([...el.classList].map((c) => `.${c}`).join(''), 'color')
const RED = 'var(--error)'

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
    expect(within(current).getByRole('button', { name: 'Stop Fetch covers (running)' })).toBeTruthy()
  })

  // EACH PRESS OF FILL GAPS IS A NEW JOB, so three fills in the queue are three
  // rows with one title. Each Stop still has a name of its own — where that job
  // stands, as its row says — or a screen reader hears one button three times.
  it('names every Stop by where its job stands, so three of one kind are three names', async () => {
    CURRENT = [
      job({ id: 10, kind: 'fill', state: 'running', total: 40, done: 12, started_at: NOW - 60000 }),
      job({ id: 11, kind: 'fill', state: 'queued', ahead: 1 }),
      job({ id: 12, kind: 'fill', state: 'queued', ahead: 2 }),
    ]
    await page()
    const current = await card('Current jobs')
    await within(current).findByRole('button', { name: 'Stop Fill gaps (running)' })
    expect(within(current).getByRole('button', { name: 'Stop Fill gaps (one job ahead)' })).toBeTruthy()
    expect(within(current).getByRole('button', { name: 'Stop Fill gaps (2 jobs ahead)' })).toBeTruthy()
    const names = within(current).getAllByRole('button', { name: /^Stop Fill gaps/ }).map((b) => b.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(3)
  })

  it('carries a job’s subject in its Stop’s name', async () => {
    CURRENT = [job({ id: 13, kind: 'fill', state: 'queued', ahead: 0, subject: 'The Dispossessed' })]
    await page()
    const current = await card('Current jobs')
    expect(await within(current).findByRole('button', { name: 'Stop Fill gaps · The Dispossessed (next)' })).toBeTruthy()
  })

  it('asks before Stop all, says what happens to each job, and sends nothing on Cancel', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    expect(ask.textContent).toContain('The running job stops after the item in hand.')
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

  it('stops everything on the confirm, with one request, and says what it stopped', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Stop them' }))
    await waitFor(() => expect(posted('/jobs/stop-all')).toHaveLength(1))
    await screen.findByText('3 jobs stopped')
    // The running row says it heard rather than keep offering a Stop.
    await within(current).findByText('Stopping after the item in hand…')
    expect(within(current).queryByRole('button', { name: 'Stop Fetch covers (running)' })).toBeNull()
  })

  it('says nothing when Stop all reached nothing — the jobs ended while the confirm was up', async () => {
    STOPALL = { stopping: 0, stopped_waiting: 0 }
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop all' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Stop all jobs?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Stop them' }))
    await waitFor(() => expect(posted('/jobs/stop-all')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.queryByText(/jobs? stopped/)).toBeNull()
  })

  it('stops the running job on its own Stop, and the row says it will stop after the item in hand', async () => {
    await page()
    const current = await card('Current jobs')
    fireEvent.click(await within(current).findByRole('button', { name: 'Stop Fetch covers (running)' }))
    await waitFor(() => expect(posted('/jobs/10/stop')).toHaveLength(1))
    await screen.findByText('Stopping after this item')
    expect(within(current).getByText('Stopping after the item in hand…')).toBeTruthy()
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
      // The copy a restore asks for first: the server keeps it under this kind.
      job({ id: 1, kind: 'backup.safety', queued: false, subject: '', state: 'succeeded', finished_at: NOW - 4 * HOUR }),
    ]
    await page()
    const past = await card('Past jobs')
    const row = await within(past).findByRole('button', { name: /^Person lookup/ })
    expect(within(row).getByText('Ursula K. Le Guin')).toBeTruthy()
    expect(within(past).getByRole('button', { name: /^Cast from TheTVDB/ })).toBeTruthy()
    expect(within(past).getByRole('button', { name: /^Safety backup/ })).toBeTruthy()
    const stranger = within(past).getByRole('button', { name: /^Job/ })
    expect(within(stranger).getByText('from a later server')).toBeTruthy()
  })

  // A WARNING IN A JOB'S LOG SAYS SO IN WORDS. It was a line in the accent — the
  // colour of a press — with nothing else to tell it from the rest; the word is
  // what a reader scanning the column finds, whatever colours they can see.
  it('says "Warning" and "Error" before those lines of a job’s log, and nothing before the rest', async () => {
    LINES[7] = [
      { id: 2, at: NOW - 2 * HOUR, level: 'info', line: '«The Paper Boat» — filled year, pages' },
      { id: 3, at: NOW - 2 * HOUR, level: 'warn', line: 'openlibrary.org answered 429' },
      { id: 4, at: NOW - 2 * HOUR, level: 'error', line: '«Lanterns» — not found' },
    ]
    await page()
    const past = await card('Past jobs')
    fireEvent.click(await within(past).findByRole('button', { name: /^Fill gaps/ }))
    const log = await within(past).findByRole('log', { name: 'Log of Fill gaps' })
    const line = async (text) => (await within(log).findByText(text)).parentElement.textContent
    // THE WORD AND THE LINE ARE TWO WORDS IN THE TEXT, a space between them. This
    // read "Warningopenlibrary.org" here, pinned, because the gap was a margin:
    // air on the screen and nothing in what a copy, a screen reader or
    // find-in-page gets. The journeys' screen dumps read "RequestGET /api/…".
    expect(await line('openlibrary.org answered 429')).toBe('Warning openlibrary.org answered 429')
    expect(await line('«Lanterns» — not found')).toBe('Error «Lanterns» — not found')
    expect(await line('«The Paper Boat» — filled year, pages')).toBe('«The Paper Boat» — filled year, pages')
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
    await screen.findByText('Started again')
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

// WHO MAY DO WHAT. Each press below is offered only where the server will do it,
// and each case here is a row where it would NOT — so a gate that let the press
// through for everyone is a red case, not a green one with nothing to see.
describe('who may press what', () => {
  // Opens each row whose head matches, in turn, and runs `check` over the card
  // once that row's body is on the screen. One row is open at a time, so the one
  // export link on the card is the proof it is open — an absence below is an
  // absence in an open row, not in a closed one.
  const eachOpened = async (past, name, check) => {
    const heads = await within(past).findAllByRole('button', { name })
    for (const head of heads) {
      fireEvent.click(head)
      await waitFor(() => expect(head.getAttribute('aria-expanded')).toBe('true'))
      expect(await within(past).findAllByRole('link', { name: /Export/ })).toHaveLength(1)
      check(past)
    }
    return heads.length
  }

  // A CHECK THAT FOUND EVERYTHING UP TO DATE has nothing to decide, and a Review
  // that only opens "everything is up to date" is a dead end kept for thirty days.
  it('offers no Review on a re-verify that was applied, found nothing to change, is somebody else’s, or did not succeed', async () => {
    PAST = [
      job({ id: 21, kind: 'reverify', state: 'succeeded', applied: true, subject: 'applied', finished_at: NOW - HOUR }),
      job({ id: 22, kind: 'reverify', state: 'succeeded', own: false, username: 'bina', subject: 'theirs', finished_at: NOW - 2 * HOUR }),
      job({ id: 23, kind: 'reverify', state: 'stopped', subject: 'stopped', finished_at: NOW - 3 * HOUR }),
      job({ id: 25, kind: 'reverify', state: 'succeeded', counts: { items: 12, changes: 0 }, subject: 'up to date', finished_at: NOW - 4 * HOUR }),
    ]
    await page(ADMIN, { onReviewJob: vi.fn() })
    const past = await card('Past jobs')
    const opened = await eachOpened(past, /^Re-verify/, (row) => {
      expect(within(row).queryByRole('button', { name: 'Review' })).toBeNull()
    })
    expect(opened).toBe(4)
  })

  it('offers no Run again where the server says the job cannot be run again', async () => {
    PAST = [job({ id: 24, kind: 'fill', state: 'failed', error: 'offline', rerunnable: false, finished_at: NOW - HOUR })]
    await page()
    const past = await card('Past jobs')
    const opened = await eachOpened(past, /^Fill gaps/, (row) => {
      expect(within(row).queryByRole('button', { name: 'Run again' })).toBeNull()
    })
    expect(opened).toBe(1)
  })

  const theirs = () => [
    job({ id: 30, kind: 'covers', state: 'running', own: false, username: 'bina', total: 40, done: 3, started_at: NOW - 60000 }),
    job({ id: 31, kind: 'fill', state: 'queued', own: false, username: 'bina', ahead: 1 }),
  ]

  it('draws a reader no Stop on a job that is somebody else’s', async () => {
    CURRENT = theirs()
    await page(READER)
    const current = await card('Current jobs')
    await within(current).findByText('Waiting — one job ahead')
    expect(within(current).queryByRole('button', { name: /^Stop Fetch covers/ })).toBeNull()
    expect(within(current).queryByRole('button', { name: /^Stop Fill gaps/ })).toBeNull()
  })

  it('and draws an admin one on anybody’s, red', async () => {
    CURRENT = theirs()
    await page(ADMIN)
    const current = await card('Current jobs')
    const running = await within(current).findByRole('button', { name: 'Stop Fetch covers (running)' })
    const waiting = within(current).getByRole('button', { name: 'Stop Fill gaps (one job ahead)' })
    expect(inkOf(running)).toBe(RED)
    expect(inkOf(waiting)).toBe(RED)
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

  // Every System logs line leads with its level, and the level is a word of its
  // own in the text, as in a job's log.
  it('reads each line as its level, a space, and the server’s words', async () => {
    await page()
    const logs = await card('System logs')
    const words = await within(logs).findByText('openlibrary.org answered 503', { exact: false })
    expect(words.parentElement.textContent).toBe('Warning TIP-NET-004 openlibrary.org answered 503')
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

  // THE SERVER STAMPS THE LINES, SO THE SERVER'S CLOCK ENDS THE FILE. The export
  // was closed at the moment the browser read the list, and a browser whose clock
  // is behind the server's exported an empty block under a screen full of lines —
  // found by narrowing-the-system-logs.journey.mjs, whose browser keeps 1 January
  // while its server keeps the real date. Here the one line is stamped a day after
  // the browser's "now"; the file must still reach it.
  it('ends "what is shown" at the newest line on the screen, whatever the browser’s clock says', async () => {
    const DAY = 24 * HOUR
    LOGS = [{ id: 41, at: NOW + DAY, level: 'info', code: '', line: 'stamped by a server a day ahead' }]
    await page()
    const logs = await card('System logs')
    await within(logs).findByText('stamped by a server a day ahead', { exact: false })
    const shown = within(logs).getByRole('link', { name: /What is shown/ }).getAttribute('href')
    expect(Number(new URLSearchParams(shown.split('?')[1]).get('to'))).toBe(NOW + DAY)
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
    const stopAll = screen.getByRole('button', { name: 'Stop all' })
    expect(inkOf(stopAll)).toBe(RED)
    fireEvent.click(stopAll)
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
