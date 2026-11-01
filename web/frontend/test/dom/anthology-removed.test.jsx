// WHAT WAS TAKEN OUT OF AN ANTHOLOGY, on its page.
//
// A removed passage used to vanish, and a rule that fills the anthology put it back. Now the page
// lists what was removed, folded, with a way back; bringing one back is one press and the list
// is read again.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS, REMOVED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies/1') {
      return {
        ok: true,
        data: {
          anthology: { id: 1, title: 'On keeping quiet', intro: '', entries: 1 },
          entries: [{ kind: 'book', item_id: 2, position: 2, note: '', quote: 'Quiet is attention.', source: 'The Wide Margin', credit: 'A. Whitfield', work_id: 1 }],
        },
      }
    }
    if (method === 'GET' && path === '/anthologies/1/removed') return { ok: true, data: { removed: REMOVED } }
    if (method === 'POST' && path.startsWith('/anthologies/1/removed/')) {
      REMOVED = []
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

beforeEach(() => {
  CALLS = []
  REMOVED = [{ kind: 'book', item_id: 5, note: 'second', quote: 'Silence is not empty.', source: 'Walden', credit: 'Thoreau' }]
})

describe('the removed passages of an anthology', () => {
  it('counts them, keeps them folded, and shows what they were when opened', async () => {
    open()
    const heading = await screen.findByRole('button', { name: /Removed \(1\)/ })
    expect(screen.queryByText('Silence is not empty.')).toBeNull()
    fireEvent.click(heading)
    expect(screen.getByText('Silence is not empty.')).toBeTruthy()
    expect(screen.getByText('Walden · Thoreau')).toBeTruthy()
  })

  it('brings one back with one press, asking the server for that passage and reading the list again', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Removed \(1\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /Bring this passage back/ }))
    await waitFor(() => expect(CALLS).toContainEqual(['POST', '/anthologies/1/removed/book/5', undefined]))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Removed \(/ })).toBeNull())
  })

  it('draws no list at all when nothing was removed', async () => {
    REMOVED = []
    open()
    await screen.findByText('Quiet is attention.')
    expect(screen.queryByRole('button', { name: /Removed \(/ })).toBeNull()
  })
})
