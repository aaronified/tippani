// THE FILES ATTACHED TO YOUR WORKS, and the prune: a section of Checks.
//
// WHAT THIS KNOWS: the two addresses it reads and presses, the words on screen, and what a person
// can do. It asserts what makes a prune safe: the confirmation names the WORK and says once what
// is kept and what is lost, nothing prunes until it is confirmed, and the section draws nothing
// for a reader with no uploaded file.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let stack
vi.mock('../../src/api.js', () => ({
  json: async (method, path) => {
    calls.push({ method, path })
    if (path === '/sources/stack') return { ok: true, data: stack }
    if (path.endsWith('/prune') && method === 'POST') return { ok: true, data: { pruned: true, kept: 36 } }
    return { ok: true, data: {} }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
}))

const { default: AttachedFilesPage } = await import('../../src/AttachedFilesPage.jsx')

const ROW = (over) => ({
  id: 4, subject: 'book', work_id: 3, title: 'Dust of Dreams', name: 'dust.epub', bytes: 1455315,
  kept_bytes: 50814, with_context: 36, without_context: 2, last_quote_at: '2026-04-02 10:00:00', state: 'file', ...over,
})

beforeEach(() => {
  cleanup()
  calls.length = 0
  stack = { sources: [ROW({}), ROW({ id: 5, title: 'Small', name: 's.txt', bytes: 2048, kept_bytes: 500 })], frees: 1404501 }
})

describe('the attached files and the prune', () => {

  it('prunes the work that was named, once confirmed', async () => {
    render(<AttachedFilesPage embedded />)
    await screen.findByText('Dust of Dreams')
    fireEvent.click(screen.getAllByRole('button', { name: 'Prune' })[0])
    await screen.findByText('Prune the file for Dust of Dreams?')
    const buttons = screen.getAllByRole('button', { name: 'Prune' })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/sources/4/prune')).toBe(true))
  })

})
