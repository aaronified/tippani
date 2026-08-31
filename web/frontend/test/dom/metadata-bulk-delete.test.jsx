// Deleting a selection of works from the Metadata console.
//
// THE WIDEST DELETE ON THAT SCREEN, and the fourth of the thirteen paths that
// jsdom's missing `confirm()` had made unreachable: the guard was always taken,
// so the loop below it — one DELETE per selected work, each taking that work's
// quotes with it — had never run in a test.
//
// The plural is the part worth pinning. "Delete 1 item" and "Delete 2 items"
// are two strings in the locale file, and the number in the question is the only
// thing telling a reader how much of their library the button is about to take.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let LIB

// FLAGGED ON PURPOSE: the console opens on the works that still need something,
// so a fixture with nothing missing is a fixture the screen correctly hides.
const book = (id, title) => ({
  id,
  title,
  author: 'Le Guin',
  series: '',
  isbn: '',
  asin: '',
  has_cover: false,
  low_res_cover: false,
  has_ids: true,
  has_author: true,
  has_series: false,
  has_year: true,
  has_genre: true,
  has_source: true,
  links: '',
})

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path === '/metadata/library') return { ok: true, data: LIB }
    if (method === 'DELETE') return { ok: true, data: {} }
    return { ok: true, data: { people: [], characters: [] } }
  }),
}))

const { default: MetadataPage } = await import('../../src/MetadataPage.jsx')

beforeEach(() => {
  CALLS = []
  LIB = { books: [book(1, 'A Wizard of Earthsea'), book(2, 'The Dispossessed')], movies: [] }
})
afterEach(() => cleanup())

// The whole page, not the console alone: the console is not exported, and
// driving the screen a reader actually sees is the more faithful test anyway.
const mount = async () => {
  render(<MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} />)
  await screen.findByText(/A Wizard of Earthsea/)
}

const press = async (el) => {
  await act(async () => {
    el.click()
  })
}

const selectAll = async () => {
  const box = screen.getByText(/select all/i).closest('label').querySelector('input')
  await act(async () => {
    box.click()
  })
}

describe('deleting a selection of works', () => {
  it('asks with the count, and deletes nothing until it is answered', async () => {
    await mount()
    await selectAll()
    await press(screen.getByText('Delete').closest('button'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Delete 2 items/)).toBeTruthy()
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })

  it('deletes every selected work once answered yes', async () => {
    await mount()
    await selectAll()
    await press(screen.getByText('Delete').closest('button'))
    await press(screen.getByText('Confirm').closest('button'))

    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/books/1')).toBe(true))
    expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/books/2')).toBe(true)
  })

  it('deletes nothing when answered no', async () => {
    await mount()
    await selectAll()
    await press(screen.getByText('Delete').closest('button'))
    await press(screen.getByText('Cancel').closest('button'))
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })
})
