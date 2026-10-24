// FILES FOUND IN A MOUNTED LIBRARY, a section of Checks.
//
// WHAT THIS KNOWS: the addresses it reads and presses, the words on screen and what a
// person can do. It asserts the three things that make the section safe: NOTHING happens
// until the reader presses Scan (no automatic scan), a large library is walked in as many
// passes as the server asks for with the cursor it gave, and a bulk press names its bucket
// and sends only the tokens the server issued.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let mounts = [{ id: 'library', label: 'Library' }]
let passes

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    calls.push({ method, path, body })
    if (path === '/sources/mounts') return { ok: true, data: { mounts } }
    if (path === '/sources/scan') {
      const n = passes.shift()
      return { ok: true, data: n }
    }
    if (path === '/sources/attach-found') return { ok: true, data: { attached: body.tokens.length, skipped: 0, failed: 0, context: { matched: 3, ambiguous: 1, unmatched: 0, skipped: 0 } } }
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

beforeEach(() => {
  cleanup()
  calls.length = 0
  mounts = [{ id: 'library', label: 'Library' }]
  passes = [
    { candidates: [C({})], scanned: 400, unclaimed: 5, truncated: true, cursor: 'movies/Z' },
    { candidates: [C({ token: 't2', title: 'Dust of Dreams', format: 'epub', subject: 'book', how: 'title', bucket: 'review', rel: 'books/Dust of Dreams.epub' })], scanned: 12, unclaimed: 1, truncated: false, cursor: '' },
  ]
})

describe('files found in a mounted library', () => {
  it('draws nothing for a box with no folders mounted, and scans nothing on its own', async () => {
    mounts = []
    const { container } = render(<FoundFilesPage embedded />)
    await waitFor(() => expect(calls.some((c) => c.path === '/sources/mounts')).toBe(true))
    expect(container.innerHTML).toBe('')
    expect(calls.some((c) => c.path === '/sources/scan')).toBe(false)
  })

  it('does not scan until the reader presses Scan', async () => {
    render(<FoundFilesPage embedded />)
    await screen.findByRole('button', { name: 'Scan' })
    expect(calls.some((c) => c.path === '/sources/scan')).toBe(false)
  })

  it('walks as many passes as the server asks for, resuming from the cursor it gave', async () => {
    render(<FoundFilesPage embedded />)
    fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))
    await screen.findByText('Dust of Dreams')
    const scans = calls.filter((c) => c.path === '/sources/scan')
    expect(scans).toHaveLength(2)
    expect(scans[0].body).toEqual({ mount_id: 'library', cursor: '' })
    expect(scans[1].body).toEqual({ mount_id: 'library', cursor: 'movies/Z' })
    // Both passes' files are on screen and counted, so a truncation is never silent.
    expect(screen.getByText('V for Vendetta')).toBeTruthy()
    expect(screen.getByText(/412 scanned · 2 found · 6 not matched/)).toBeTruthy()
  })

  it('accepts the exact group together, naming the bucket and sending only tokens', async () => {
    render(<FoundFilesPage embedded />)
    fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))
    const exact = await screen.findByTestId('found-exact')
    fireEvent.click(within(exact).getByRole('button', { name: 'Accept all 1' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/sources/attach-found')).toBe(true))
    const press = calls.find((c) => c.path === '/sources/attach-found')
    expect(press.body).toEqual({ bucket: 'exact', tokens: ['t1'] })
    // The fuzzy group has no Accept all: those are one press each.
    const review = screen.getByTestId('found-review')
    expect(within(review).queryByRole('button', { name: /Accept all/ })).toBeNull()
  })

  it('refuses a file with a cross and the row goes', async () => {
    render(<FoundFilesPage embedded />)
    fireEvent.click(await screen.findByRole('button', { name: 'Scan' }))
    const review = await screen.findByTestId('found-review')
    fireEvent.click(within(review).getByRole('button', { name: 'Do not offer this file for Dust of Dreams again' }))
    await waitFor(() => expect(calls.find((c) => c.path === '/sources/ignore-found')?.body).toEqual({ tokens: ['t2'] }))
    await waitFor(() => expect(screen.queryByText('Dust of Dreams')).toBeNull())
  })
})
