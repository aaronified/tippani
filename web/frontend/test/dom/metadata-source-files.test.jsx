// METADATA > SOURCE FILES. The owner: "the base of this should be in metadata. Add a
// section for this." Every work with quotes is listed with its file or the lack of one,
// a scan of the library folders starts from here and shows its progress, and a file a
// scan found is attached from the work's row. The phone's Scan shortcut opens this
// section at /metadata/files?scan=1, which scans once and drops the query.
//
// WHAT THIS KNOWS: the address it opens, the addresses the section reads and presses
// (the library, the attached files, the folders, the findings, the scan start, the
// attach), the words on screen and what a person can press. The network is the only
// fake.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The address the shortcut opens, set before the app's modules read it.
window.history.replaceState(null, '', '/metadata/files?scan=1')

const calls = []
let scanState = 'none'

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
    if (path === '/metadata/library') return ok(LIB)
    if (path === '/sources/all') {
      return ok({ sources: [{ id: 2, subject: 'book', subject_id: 8, name: 'Gardens.epub', format: 'epub', bytes: 500000, origin: 'upload', state: 'file', with_context: 2 }] })
    }
    if (path === '/sources/mounts') return ok({ mounts: [{ id: 'books', label: 'Books' }] })
    if (path === '/sources/scan') {
      scanState = 'running'
      return { ok: true, status: 202, data: { job_id: 11 } }
    }
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

const { default: MetadataPage } = await import('../../src/MetadataPage.jsx')

describe('Metadata > Source files', () => {
  it('lists works without a file, scans once from the shortcut, and attaches a found file', async () => {
    cleanup()
    render(<MetadataPage user={{ id: 1, is_admin: false, preferences: {} }} section="files" onSection={() => {}} />)

    // A work with no file says so; the one with a file shows it.
    const dust = (await screen.findByText('Dust of Dreams')).closest('[data-testid="source-work"]')
    expect(within(dust).getByText('No source file for its 4 quotes')).toBeTruthy()
    expect(await screen.findByText('Gardens.epub')).toBeTruthy()

    // The shortcut's scan ran once, and the address no longer asks for another.
    await waitFor(() => expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(1))
    expect(window.location.search).toBe('')
    expect(await screen.findByText(/512 scanned · 1 found · 3 not matched/)).toBeTruthy()

    // What the scan found is offered on the work's own row, and Attach attaches it.
    const offer = await screen.findByText(/A file was found in Books: Erikson\/Dust of Dreams\.epub/)
    fireEvent.click(within(offer.closest('[data-testid="source-work"]')).getByRole('button', { name: 'Attach' }))
    await waitFor(() => expect(calls.find((c) => c.path === '/sources/attach-found')?.body).toEqual({ bucket: 'review', tokens: ['tok-1'] }))
    await waitFor(() => expect(screen.queryByText(/A file was found in Books/)).toBeNull())
    expect(calls.filter((c) => c.path === '/sources/scan')).toHaveLength(1)
  })
})
