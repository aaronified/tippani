// A WORK'S SOURCE FILE, ON ITS OWN PANEL. The owner asked for the library scan "in the
// work details too". A file the last scan found for this work and nobody attached is
// offered on the work's panel, and Attach attaches it there. A panel whose file could
// not be read says so, with a way to try again.
//
// WHAT THIS KNOWS: the addresses the panel reads and presses (the work's file, the
// folders, what a scan found, the attach), the words on screen, and what a person can
// press. The network is the only fake.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let calls
let attached
let sourcesFail

const BOOK = {
  id: 7, title: 'Dust of Dreams', author: '', translator: '', editor: '', isbn: '', asin: '', description: '',
  published_year: 2009, published_circa: false, language: '', orig_language: '', subtitle: '', publisher: '',
  pages: 0, links: '', genres: [], series: '', series_index: 0, favorite: false, annotation_count: 4,
}
const FOUND = {
  token: 'tok-1', mount: 'books', rel: 'Erikson/Dust of Dreams.epub', format: 'epub',
  subject: 'book', work_id: 7, title: 'Dust of Dreams', how: 'title', bucket: 'review',
}
const OTHER = { ...FOUND, token: 'tok-2', work_id: 8, title: 'The Crippled God', rel: 'Erikson/The Crippled God.epub' }

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    calls.push({ method, path, body })
    const ok = (data) => ({ ok: true, status: 200, data })
    if (path.startsWith('/sources?')) {
      if (sourcesFail) return { ok: false, status: 0, data: null }
      return ok({ state: attached ? 'mounted' : 'none', sources: attached ? [{ id: 3, name: 'Dust of Dreams.epub', format: 'epub', bytes: 900000, origin: 'mount', state: 'mounted' }] : [] })
    }
    if (path === '/sources/mounts') return ok({ mounts: [{ id: 'books', label: 'Books' }] })
    if (path.startsWith('/sources/found')) return ok({ scan: { state: 'done', scanned: 40, found: 2 }, candidates: attached ? [OTHER] : [FOUND, OTHER] })
    if (path.startsWith('/sources/context-ids')) return ok({ ids: attached ? [1, 2, 3] : [] })
    if (path === '/sources/attach-found') {
      attached = true
      return ok({ attached: 1, skipped: 0, failed: 0, done: body.tokens, context: { matched: 3, ambiguous: 0, unmatched: 1, skipped: 0 } })
    }
    if (method === 'GET' && /^\/books\/\d+$/.test(path)) return ok(BOOK)
    if (path.endsWith('/cast')) return ok({ cast: [], actor_role: 'none' })
    if (path.startsWith('/people')) return ok({ people: [] })
    return ok({})
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')
const { invalidateContext } = await import('../../src/sources.jsx')

beforeEach(() => {
  cleanup()
  calls = []
  attached = false
  sourcesFail = false
  invalidateContext()
  resetPanelHistory()
})

const panel = () =>
  render(<PanelHarness panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: BOOK, onChanged: () => {}, onDelete: null })} />)

describe('a work’s source file on its panel', () => {
  it('offers the file a scan found for this work, and Attach attaches it', async () => {
    panel()
    expect(await screen.findByText(/A file was found in Books/)).toBeTruthy()
    expect(screen.getByText(/Erikson\/Dust of Dreams\.epub/)).toBeTruthy()
    // Only this work's finding, not the other book's.
    expect(screen.queryByText(/The Crippled God/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Attach' }))
    await waitFor(() => expect(screen.queryByText(/A file was found in Books/)).toBeNull())
    const attach = calls.find((c) => c.path === '/sources/attach-found')
    expect(attach.body).toEqual({ bucket: 'review', tokens: ['tok-1'] })
    // The panel now shows the attached file and what it gave.
    expect(await screen.findByText('Dust of Dreams.epub')).toBeTruthy()
    expect(await screen.findByText('Context for 3 of 4 quotes')).toBeTruthy()
  })

  it('says when the file could not be read, and Try again reads it', async () => {
    sourcesFail = true
    attached = true
    panel()
    expect(await screen.findByText(/The server did not answer/)).toBeTruthy()
    sourcesFail = false
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0])
    expect(await screen.findByText('Dust of Dreams.epub')).toBeTruthy()
  })
})
