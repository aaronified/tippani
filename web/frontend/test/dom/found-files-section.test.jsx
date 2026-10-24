// WHAT THE LAST LIBRARY SCAN LEFT TO DECIDE, a section of Checks.
//
// The owner: "Checks should have it after the scan, for issues found in the scan." The
// scan starts on Metadata > Source files; Checks shows its findings, live while it runs,
// and draws nothing when there is nothing to decide. Accepting sends only the tokens the
// server issued.
//
// WHAT THIS KNOWS: the addresses it reads and presses, the words on screen and what a
// person can do.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let mounts = [{ id: 'library', label: 'Library' }]
let fulls // answers to the full read of a folder, in order
let statuses // answers to the progress poll, in order
const failing = new Set()

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    calls.push({ method, path, body })
    if (path === '/sources/mounts') return { ok: true, data: { mounts } }
    if (path === '/sources/scan') return { ok: true, status: 202, data: { job_id: 7, running: false } }
    if (path.startsWith('/sources/found') && path.includes('status=1')) return { ok: true, data: { scan: statuses.shift() } }
    if (path.startsWith('/sources/found')) return { ok: true, data: fulls.length > 1 ? fulls.shift() : fulls[0] }
    if (path === '/sources/attach-found') {
      const ok = body.tokens.filter((tok) => !failing.has(tok))
      return { ok: true, data: { attached: ok.length, skipped: 0, failed: body.tokens.length - ok.length, done: ok, context: { matched: 3, ambiguous: 1, unmatched: 0, skipped: 0 } } }
    }
    if (path === '/sources/ignore-found') return { ok: true, data: { ignored: body.tokens.length } }
    return { ok: true, data: {} }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
}))

const { default: FoundFilesPage } = await import('../../src/FoundFilesPage.jsx')

const C = (over) => ({
  token: 't1',
  mount: 'library',
  rel: 'movies/V for Vendetta (2005) {tmdb-752}/V for Vendetta (2005).en.srt',
  format: 'subtitle',
  subject: 'screen',
  work_id: 1,
  title: 'V for Vendetta',
  how: 'id',
  bucket: 'exact',
  ...over,
})

const book = C({ token: 't2', title: 'Dust of Dreams', format: 'epub', subject: 'book', work_id: 2, how: 'title', bucket: 'review', rel: 'books/Dust of Dreams.epub' })
const scan = (over) => ({ state: 'done', scanned: 0, found: 0, unclaimed: 0, skipped: 0, ...over })

beforeEach(() => {
  cleanup()
  calls.length = 0
  failing.clear()
  mounts = [{ id: 'library', label: 'Library' }]
  fulls = [
    { scan: scan({ state: 'none' }), candidates: [] },
    { scan: scan({ state: 'running', job_id: 7, scanned: 400, found: 1, unclaimed: 5 }), candidates: [C({})] },
    { scan: scan({ scanned: 1412, found: 2, unclaimed: 6 }), candidates: [C({}), book] },
  ]
  statuses = [scan({ state: 'running', job_id: 7, scanned: 900, found: 2, unclaimed: 6 })]
})

describe('files found in a mounted library', () => {
  it('shows a running scan and its findings, then the finished list, with no Scan of its own', async () => {
    fulls = fulls.slice(1)
    render(<FoundFilesPage embedded />)
    // One quiet line while it runs, and the first finding already offered.
    await screen.findByText(/A scan is running: 400 files read, 1 found/)
    expect(screen.getByText('V for Vendetta')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Scan' })).toBeNull()

    // Then the finished list, and the files that matched no work, as one line.
    await waitFor(() => expect(screen.getByText('Dust of Dreams')).toBeTruthy(), { timeout: 6000 })
    expect(screen.getByText('6 files in your folders matched no work.')).toBeTruthy()
    expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(0)
  })

  it('draws nothing when the last scan left nothing to decide', async () => {
    fulls = [{ scan: scan({ scanned: 1412, found: 0, unclaimed: 0 }), candidates: [] }]
    const { container } = render(<FoundFilesPage embedded />)
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/sources/found'))).toBe(true))
    await new Promise((r) => setTimeout(r, 50))
    expect(container.textContent).toBe('')
  })

  it('accepts one finding and keeps the rest', async () => {
    fulls = [{ scan: scan({ scanned: 1412, found: 2, unclaimed: 6 }), candidates: [C({}), book] }]
    render(<FoundFilesPage embedded />)
    await screen.findByText('Dust of Dreams')
    fireEvent.click(screen.getByRole('button', { name: 'Attach this file to V for Vendetta' }))
    await waitFor(() => expect(screen.queryByText('V for Vendetta')).toBeNull())
    const attach = calls.find((c) => c.path === '/sources/attach-found')
    expect(attach.body).toEqual({ bucket: 'exact', tokens: ['t1'] })
    expect(screen.getByText('Dust of Dreams')).toBeTruthy()
  })

  it('shows a scan that was already running when the screen opened', async () => {
    fulls = [{ scan: scan({ state: 'running', job_id: 7, scanned: 300, found: 1, unclaimed: 2 }), candidates: [C({})] }]
    statuses = [scan({ state: 'running', job_id: 7, scanned: 300, found: 1, unclaimed: 2 })]
    render(<FoundFilesPage embedded />)
    await screen.findByText(/A scan is running: 300 files read, 1 found/)
    expect(screen.getByText('V for Vendetta')).toBeTruthy()
    expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(0)
  })
})
