// WHY A WORK HAS NO FILE, on its Source files row (issue #62). The row used to say nothing, so
// "no folder is set up", "never scanned", "scanned, no match" and "the scan stopped" all looked like
// an empty box. What is pinned: each situation gets its own sentence, and nothing is said while a
// file is held or offered, while a scan runs, or before the answer is in.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

let mounts
let scan
let candidates
let held

const BOOK = {
  id: 7, title: 'Dust of Dreams', author: '', translator: '', editor: '', isbn: '', asin: '', description: '',
  published_year: 2009, published_circa: false, language: '', orig_language: '', subtitle: '', publisher: '',
  pages: 0, links: '', genres: [], series: '', series_index: 0, favorite: false, annotation_count: 4,
}
const FOUND = {
  token: 'tok-1', mount: 'books', rel: 'Erikson/Dust of Dreams.epub', format: 'epub',
  subject: 'book', work_id: 7, title: 'Dust of Dreams', how: 'title', bucket: 'review',
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    const ok = (data) => ({ ok: true, status: 200, data })
    if (path.startsWith('/sources?')) {
      return ok({ state: held ? 'mounted' : 'none', sources: held ? [{ id: 3, name: 'Dust of Dreams.epub', format: 'epub', bytes: 900000, origin: 'mount', state: 'mounted' }] : [] })
    }
    if (path === '/sources/mounts') return ok({ mounts })
    if (path.startsWith('/sources/found')) return ok({ scan, candidates })
    if (path.startsWith('/sources/context-ids')) return ok({ ids: [] })
    if (method === 'GET' && /^\/books\/\d+$/.test(path)) return ok(BOOK)
    if (path.endsWith('/cast')) return ok({ cast: [], actor_role: 'none' })
    if (path.startsWith('/people')) return ok({ people: [] })
    return ok({})
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')
const { invalidateContext, forgetFound } = await import('../../src/sources.jsx')

beforeEach(() => {
  cleanup()
  mounts = [{ id: 'books', label: 'Books' }]
  scan = { state: 'done', scanned: 40, found: 0 }
  candidates = []
  held = false
  invalidateContext()
  forgetFound()
  resetPanelHistory()
})

const panel = () =>
  render(<PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })} />)

describe('why a work has no file', () => {
  it('says no folder is set up when none is', async () => {
    mounts = []
    panel()
    expect(await screen.findByTestId('source-why')).toHaveProperty('textContent', expect.stringContaining('No library folder is set up'))
  })

  it('says the folders have not been scanned when no scan has run', async () => {
    scan = { state: 'none', scanned: 0, found: 0 }
    panel()
    expect((await screen.findByTestId('source-why')).textContent).toContain('have not been scanned yet')
  })

  it('says a scan that stopped early may not have looked, rather than that nothing exists', async () => {
    scan = { state: 'partial', scanned: 10, found: 0 }
    panel()
    expect((await screen.findByTestId('source-why')).textContent).toContain('did not finish')
  })

  it('says the last scan found nothing for the work when a finished scan did', async () => {
    panel()
    expect((await screen.findByTestId('source-why')).textContent).toContain('found no file for this work')
  })

  it('says nothing while a scan is running; that has its own line', async () => {
    scan = { state: 'running', scanned: 5, found: 0 }
    panel()
    await screen.findByText(/Scanning your library folders/)
    expect(screen.queryByTestId('source-why')).toBeNull()
  })

  it('says nothing when a file is offered for the work', async () => {
    candidates = [FOUND]
    panel()
    await screen.findByText(/A file was found in Books/)
    expect(screen.queryByTestId('source-why')).toBeNull()
  })

  it('says nothing when the work holds a file', async () => {
    held = true
    panel()
    await screen.findByText(/Dust of Dreams\.epub/)
    await waitFor(() => expect(screen.queryByTestId('source-why')).toBeNull())
  })
})
