// THE FILES TAB WHEN NOTHING IS WAITING. Its four sections each draw nothing when they have nothing, so
// a reader with no findings opened the tab to a blank page, which reads as broken. The tab now says
// that nothing is waiting, but only once all four have answered: "nothing" is never claimed while any of
// them is still asking, and never when any of them has something to show.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

let MOUNTS, CANDIDATES, STACK

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    const ok = (data) => ({ ok: true, status: 200, data })
    if (path === '/sources/mounts') return ok({ mounts: MOUNTS })
    if (path.startsWith('/sources/found')) return ok({ scan: { state: 'done', scanned: 5, found: CANDIDATES.length, unclaimed: 0 }, candidates: CANDIDATES })
    if (path === '/locators/proposals') return ok({ proposals: [] })
    if (path === '/corrections') return ok({ proposals: [], wrong_file: [], buckets: [] })
    if (path === '/sources/stack') return ok({ sources: STACK, frees: 0 })
    return ok({})
  }),
}))

const { default: ChecksPage } = await import('../../src/ChecksPage.jsx')

beforeEach(() => {
  cleanup()
  MOUNTS = [{ id: 'books', label: 'Books' }]
  CANDIDATES = []
  STACK = []
})

const openFiles = async () => {
  render(<ChecksPage onPending={() => {}} onOpenBook={() => {}} onOpenMovie={() => {}} onApproved={() => {}} onOpenQuotes={() => {}} />)
  const tab = await screen.findByRole('tab', { name: /Files/ })
  fireEvent.click(tab)
}

describe('the Files tab with nothing waiting', () => {
  it('says so once every section has answered', async () => {
    await openFiles()
    expect((await screen.findByTestId('files-empty')).textContent).toContain('Nothing is waiting here')
  })

  it('says so with no folders mounted too', async () => {
    MOUNTS = []
    await openFiles()
    expect(await screen.findByTestId('files-empty')).toBeTruthy()
  })

  it('says nothing when a section has something to show', async () => {
    CANDIDATES = [{
      token: 'tok-1', mount: 'books', rel: 'Erikson/Dust of Dreams.epub', format: 'epub',
      subject: 'book', work_id: 7, title: 'Dust of Dreams', how: 'title', bucket: 'review',
    }]
    await openFiles()
    await screen.findByTestId('found-row', {}, { timeout: 4000 })
    expect(screen.queryByTestId('files-empty')).toBeNull()
  })
})
