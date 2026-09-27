// A RE-VERIFY THAT RAN AS A JOB IS REVIEWED WHERE ITS REVIEW LIVES, FROM ITS
// ADDRESS.
//
// In 3.1.0 a re-verify runs on the server and outlives the screen that started
// it, so its findings are looked over later: Settings › Jobs lists it under Past
// jobs with a Review press, and Review opens Metadata on that job
// (/metadata/reverify/{job}) because the flow that applies findings lives there.
//
// WHY THIS MOUNTS THE WHOLE APP. For a stage the two halves were each green on
// their own — the Review press called the shell's door with the right job, and
// the router turned the address into a detail — while the page at the end of
// the door drew the plain console, because nothing on Metadata read the job.
// CLAUDE.md's testing section is named after exactly that shape. The only test
// that can fail on it presses Review, or opens the address, and looks at what is
// drawn.
//
// WHAT A READER SEES AND MAY DO:
//  * the findings, as the job left them — no second check against the sources;
//  * a field somebody edited after the check is marked so and is not ticked for
//    them, even when it is empty now (the check's answer was about a value that
//    is gone), while an untouched empty field is ticked as a re-verify always
//    ticks a pure fill;
//  * closing the review takes them back to where they pressed Review.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const USER = { id: 1, username: 'aro', preferences: {}, is_admin: true, version: '3.1.0' }
const NOW = Date.now()
let CALLS

const REVERIFY = {
  id: 5, kind: 'reverify', queued: true, subject: '', state: 'succeeded', params: { book_ids: [3] },
  counts: { items: 1, changes: 1 }, error: '', total: 1, done: 1, ahead: 0, username: '', own: true,
  rerunnable: false, applied: false, rerun_of: null, from_job: null,
  created_at: NOW - 3600000, started_at: NOW - 3600000, finished_at: NOW - 3500000,
}
const FINDINGS = [{
  type: 'book', id: 3, title: 'The Paper Boat', status: 'ok', source: 'openlibrary',
  diffs: [
    // Empty then and empty now: a pure fill, ticked as it always is.
    { field: 'published_year', stored: null, fresh: 1921 },
    // Somebody cleared it after the check: empty now, and NOT ticked for them.
    { field: 'description', stored: '', fresh: 'A boat folded from a letter.', changed: true },
  ],
}]

const LISTS = {
  books: [], movies: [], annotations: [], dialogues: [], utterances: [],
  people: [], characters: [], tags: [], stickers: [], anthologies: [],
  items: [], batches: [], works: [], quotes: [], fonts: [], locales: [],
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const [p, qs = ''] = path.split('?')
    if (p === '/auth/me') return { ok: true, status: 200, data: USER }
    if (method === 'GET' && p === '/jobs') {
      const past = new URLSearchParams(qs).get('view') === 'past'
      return { ok: true, status: 200, data: { jobs: past ? [REVERIFY] : [], running: 0, waiting: 0, more: false } }
    }
    if (method === 'GET' && p === '/jobs/5') return { ok: true, status: 200, data: { job: REVERIFY, lines: [], more: false } }
    if (method === 'GET' && p === '/jobs/5/result') return { ok: true, status: 200, data: { kind: 'reverify', result: FINDINGS } }
    return { ok: true, status: 200, data: LISTS }
  }),
}))

const { default: App } = await import('../../src/App.jsx')

// App boots on a bare fetch for who is signed in, before its screens use the
// api helper.
const okJSON = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

beforeEach(() => {
  CALLS = []
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/auth/me')) return okJSON(USER)
    if (u.includes('/auth/status')) return okJSON({ needs_onboarding: false })
    return okJSON({})
  }))
  window.scrollTo = () => {}
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const mountAt = async (path) => {
  window.history.replaceState(null, '', path)
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(<App />)
    await act(async () => {})
    await act(async () => {})
  } finally {
    quiet.mockRestore()
  }
}

const theReview = () => screen.findByRole('dialog', { name: 'Re-verify metadata' })
const checkedAgain = () => CALLS.filter(([m, p]) => m === 'POST' && p === '/metadata/reverify')

describe('a finished re-verify, opened at its address', () => {
  it('draws the job’s findings, without checking the sources again', async () => {
    await mountAt('/metadata/reverify/5')
    const review = await theReview()
    await within(review).findByText('The Paper Boat')
    expect(checkedAgain()).toHaveLength(0)
  })

  it('ticks the untouched empty field and leaves the one changed since the check for the reader', async () => {
    await mountAt('/metadata/reverify/5')
    const review = await theReview()
    await within(review).findByText('changed since the check')
    // Two empty fields, one of them changed since the check: one is ticked.
    expect(within(review).getByRole('button', { name: 'Apply 1 approved change' })).toBeTruthy()
    const boxes = within(review).getAllByRole('checkbox')
    expect(boxes.map((b) => b.checked)).toEqual([true, false])
  })
})

describe('Review, pressed on a past job in Settings › Jobs', () => {
  it('opens that job’s findings on Metadata, and closing them goes back to the jobs', async () => {
    await mountAt('/settings/jobs')
    const past = await screen.findByRole('region', { name: 'Past jobs' })
    fireEvent.click(await within(past).findByRole('button', { name: /^Re-verify/ }))
    fireEvent.click(await within(past).findByRole('button', { name: 'Review' }))
    const review = await theReview()
    await within(review).findByText('The Paper Boat')
    expect(window.location.pathname).toBe('/metadata/reverify/5')
    fireEvent.click(within(review).getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Re-verify metadata' })).toBeNull())
    await screen.findByRole('region', { name: 'Past jobs' })
    expect(window.location.pathname).toBe('/settings/jobs')
  })
})
