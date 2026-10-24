// METADATA > SOURCE FILES. The owner: "the base of this should be in metadata. Add a
// section for this." Every work with quotes is listed with its file or the lack of one,
// a scan of the library folders starts here and shows its progress, and a file a scan
// found is attached from the work's row. A Scan press whose request fails says so and
// gives the button back: on the owner's NAS a press once sent a request that never came
// back and the screen showed nothing at all.
//
// WHAT THIS KNOWS: the addresses the section reads and presses (the library, the attached
// files, the folders, the findings, the scan start, the attach), the words on screen and
// what a person can press. The network is the only fake.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let calls
let scanState
let scanAnswer

const LIB = {
  books: [
    { id: 7, title: 'Dust of Dreams', annotation_count: 4 },
    { id: 8, title: 'Gardens of the Moon', annotation_count: 2 },
  ],
  movies: [],
}
const FOUND = {
  token: 'tok-1', mount: 'books', rel: 'Erikson/Dust of Dreams.epub', format: 'epub',
  subject: 'book', work_id: 7, title: 'Dust of Dreams', how: 'title', bucket: 'review',
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    calls.push({ method, path, body })
    const ok = (data) => ({ ok: true, status: 200, data })
    if (path === '/sources/all') {
      return ok({ sources: [{ id: 2, subject: 'book', subject_id: 8, name: 'Gardens.epub', format: 'epub', bytes: 500000, origin: 'upload', state: 'file', with_context: 2 }] })
    }
    if (path === '/sources/mounts') return ok({ mounts: [{ id: 'books', label: 'Books' }] })
    if (path === '/sources/scan') return scanAnswer()
    if (path.startsWith('/sources/found')) {
      const scan = scanState === 'none' ? { state: 'none' } : { state: scanState, job_id: 11, scanned: 512, found: 1, unclaimed: 3 }
      return ok(path.includes('status=1') ? { scan } : { scan, candidates: scanState === 'none' ? [] : [FOUND] })
    }
    if (path === '/sources/attach-found') {
      return ok({ attached: 1, skipped: 0, failed: 0, done: body.tokens, context: { matched: 4, ambiguous: 0, unmatched: 0, skipped: 0 } })
    }
    if (path.startsWith('/jobs')) return ok({ jobs: [], running: 0, waiting: 0, more: false })
    return ok({})
  }),
}))

const { default: SourceFilesConsole, ScanShortcuts } = await import('../../src/SourceFilesConsole.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

beforeEach(() => {
  cleanup()
  calls = []
  scanState = 'none'
  scanAnswer = () => {
    scanState = 'running'
    return { ok: true, status: 202, data: { job_id: 11 } }
  }
})

const open = () =>
  render(
    <>
      <SourceFilesConsole lib={LIB} />
      <ToastHost />
    </>,
  )

describe('Metadata > Source files', () => {
  it('lists works without a file, scans with progress, and attaches a found file', async () => {
    open()
    const dust = (await screen.findByText('Dust of Dreams')).closest('[data-testid="source-work"]')
    expect(within(dust).getByText('No source file for its 4 quotes')).toBeTruthy()
    expect(await screen.findByText('Gardens.epub')).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))
    expect(await screen.findByText(/512 scanned · 1 found · 3 not matched/)).toBeTruthy()
    expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(1)

    const offer = await screen.findByText(/A file was found in Books/)
    expect(screen.getByText(/Erikson\/Dust of Dreams\.epub/)).toBeTruthy()
    fireEvent.click(within(offer.closest('[data-testid="source-work"]')).getByRole('button', { name: 'Attach' }))
    await waitFor(() => expect(calls.find((c) => c.path === '/sources/attach-found')?.body).toEqual({ bucket: 'review', tokens: ['tok-1'] }))
    await waitFor(() => expect(screen.queryByText(/A file was found in Books/)).toBeNull())
  })

  it('says the server did not answer a Scan, and gives the button back', async () => {
    // What a request that never settles turns into once its timeout passes.
    scanAnswer = () => ({ ok: false, status: 0, data: null })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))
    expect(await screen.findByText(/did not answer the scan request/)).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan' }).disabled).toBe(false))
    expect(screen.queryByText('Scanning…')).toBeNull()
  })

  // THE PHONE INDEX SHORTCUTS, drawn under Metadata > Source files and Settings > Server:
  // Scan starts the same scan with its progress, and Found files says how many wait.
  it('gives a phone a Scan shortcut with progress, and Found files with its count', async () => {
    scanState = 'done'
    render(<ScanShortcuts />)
    expect(await screen.findByRole('button', { name: /Found files.*1/ })).toBeTruthy()
    scanState = 'none'
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(await screen.findByText(/512 scanned · 1 found · 3 not matched/)).toBeTruthy()
    expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(1)
  })
})
