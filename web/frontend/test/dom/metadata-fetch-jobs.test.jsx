// The Metadata screen's bulk fetches run on the server, and the screen draws them.
//
// WHAT CHANGED IN 3.1.0. The covers fetch walked the library from this tab, one
// request per chunk, so it lasted exactly as long as the tab did; it is a job on
// the server's queue now, and the screen's part is to start it, draw its
// progress while the screen is up, and say what it did when it ends.
//
// WHAT A READER SEES AND MAY DO, and so what this file presses:
//   * Fetch starts one covers fetch, draws how far it has got, and says what it
//     fetched when it ends — then the counts on the page are re-read;
//   * a fetch already running (pressed a minute ago, or on the phone) is drawn
//     when the screen opens, and Fetch does not start a second;
//   * the phone's Fetch key asks for missing art only, as it always has;
//   * a refusal, a failure and a stopped run each say so in words.
//
// THE NETWORK IS FAKED the way the neighbouring Metadata tests fake it, with the
// jobs routes answered by test/dom/helpers/jobsServer.js (its header declares
// what it knows). What is read back from it is only what a request SAID.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { jobsServer } from './helpers/jobsServer.js'

let CALLS
let JOBS
let WIDTH = 1280

const book = (id, title) => ({
  id, title, author: 'Le Guin', series: '', isbn: '', asin: '',
  has_cover: false, cover_path: '', low_res_cover: false, has_ids: true, has_author: true,
  has_series: true, has_year: true, has_genre: true, has_source: true, links: '',
})

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    const job = JOBS.answer(method, path, body)
    if (job) return job
    if (method === 'GET' && path === '/metadata/library') {
      return { ok: true, data: { books: [book(1, 'A Wizard of Earthsea'), book(2, 'The Dispossessed')], movies: [] } }
    }
    return { ok: true, data: { people: [], characters: [], groups: [] } }
  }),
}))

const { default: MetadataPage } = await import('../../src/MetadataPage.jsx')
const { useScreenBarState } = await import('../../src/ui.jsx')

let BAR = { keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

beforeEach(() => {
  CALLS = []
  JOBS = jobsServer()
  WIDTH = 1280
  localStorage.clear()
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q) && WIDTH <= 768,
    media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  })
})
afterEach(() => cleanup())

const ADMIN = { username: 'alice', is_admin: true }
const mount = async () => {
  render(<><MetadataPage user={ADMIN} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} /><Probe /></>)
  await screen.findByText(WIDTH <= 768 ? 'Works' : 'Duplicate works')
}
const fetchButton = () => screen.getByRole('button', { name: 'Fetch missing covers and metadata' })
const libraryReads = () => CALLS.filter(([m, p]) => m === 'GET' && p === '/metadata/library').length

describe('fetching covers, as a job', () => {
  it('starts one, draws how far it has got, and says what it did at the end', async () => {
    JOBS.plan('covers', { total: 40 })
    JOBS.hold('covers')
    await mount()
    fireEvent.click(fetchButton())
    await waitFor(() => expect(JOBS.started()).toEqual([['covers', { missing_only: false }]]))
    expect(await screen.findByRole('progressbar', { name: 'fetching covers & metadata · 0/40' })).toBeTruthy()
    expect(fetchButton().disabled, 'Fetch stayed pressable while its job ran').toBe(true)

    const before = libraryReads()
    const [id] = [...JOBS.jobs.keys()]
    JOBS.finish(id, { counts: { fetched: 3, enriched: 2, failed: 0, skipped: 0 } })
    expect(await screen.findByText('3 covers fetched/upgraded · 2 details filled', {}, { timeout: 4000 })).toBeTruthy()
    // The counts on the page came from the library, so the library is read again.
    await waitFor(() => expect(libraryReads()).toBeGreaterThan(before))
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(fetchButton().disabled).toBe(false)
  })

  // A FETCH STARTED ELSEWHERE IS THE SAME FETCH. The screen looks when it opens,
  // and a second press would only have queued the same work behind the first.
  it('draws a fetch already running when the screen opens, and does not start another', async () => {
    JOBS.add({ kind: 'covers', state: 'running', total: 10, done: 4 })
    await mount()
    expect(await screen.findByRole('progressbar', { name: 'fetching covers & metadata · 4/10' })).toBeTruthy()
    expect(fetchButton().disabled).toBe(true)
    await act(async () => { fireEvent.click(fetchButton()) })
    expect(JOBS.started()).toEqual([])
  })

  it('says where it stands while it waits its turn', async () => {
    JOBS.plan('covers', { queued: true, ahead: 1 })
    JOBS.hold('covers')
    await mount()
    fireEvent.click(fetchButton())
    expect(await screen.findByRole('progressbar', { name: 'Waiting — one job ahead' })).toBeTruthy()
  })

  it('asks for missing art only from the phone’s key, as it always has', async () => {
    WIDTH = 390
    await mount()
    const key = (BAR.keys || []).find((k) => k.id === 'fetch')
    await act(async () => key.onClick())
    await waitFor(() => expect(JOBS.started()).toEqual([['covers', { missing_only: true }]]))
  })

  it('says why when the server will not start it', async () => {
    JOBS.refuse(409, { error: 'A restore is running. Try again when it has finished.', busy: true })
    await mount()
    fireEvent.click(fetchButton())
    expect(await screen.findByText('A restore is running. Try again when it has finished.')).toBeTruthy()
    expect(fetchButton().disabled).toBe(false)
  })

  it('says why when the fetch failed', async () => {
    JOBS.plan('covers', { state: 'failed', error: 'Open Library did not answer' })
    await mount()
    fireEvent.click(fetchButton())
    expect(await screen.findByText('Open Library did not answer', {}, { timeout: 4000 })).toBeTruthy()
  })

  // STOPPED IS NOT "UP TO DATE". A run stopped part-way reports what it reached
  // and says first that it did not reach the end.
  it('says a stopped fetch stopped, before what it reached', async () => {
    JOBS.plan('covers', { state: 'stopped', counts: { fetched: 1 } })
    await mount()
    fireEvent.click(fetchButton())
    expect(await screen.findByText('Stopped · 1 cover fetched/upgraded · 0 details filled', {}, { timeout: 4000 })).toBeTruthy()
  })
})
