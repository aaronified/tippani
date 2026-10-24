// THE QUOTE IN ITS FILE, ON THE FORM THAT EDITS IT. The owner: "Context isn't shown in
// quote edit page or anywhere." Editing a highlight shows the lines around it, the quote
// marked, the file it came from, and Show more widens it. A quote the file could not
// place says so only when the work has a file; with no file there is nothing at all.
// A context that could not be loaded says so, with a way to try again.
//
// WHAT THIS KNOWS: the addresses the form reads (the work's file, the quote's context),
// the words on screen, and what a person can press. The network is the only fake.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let sources
let context

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path.startsWith('/sources?')) return { ok: true, status: 200, data: { state: sources.length ? 'file' : 'none', sources } }
    if (path.startsWith('/quotes/annotation/5/context')) return context(path)
    return { ok: true, status: 200, data: {} }
  },
}))

const { AnnotationForm } = await import('../../src/Library.jsx')

const BEFORE = ['The road ran north along the river.', 'Nobody walked it after dark.', 'The bells had stopped years ago.']
const ROW = { id: 5, book_id: 3, quote: 'It was a bright cold day in April' }
const answer = (before) => ({
  before: BEFORE.slice(BEFORE.length - before).join('\n\n'),
  body: 'It was a bright cold day in April, and the clocks were striking thirteen.',
  after: 'Winston Smith slipped quickly through the glass doors.',
  unit: 'paragraph',
  span: { before, after: 1 },
  stored: { before: 3, after: 1 },
  bound_before: false,
  bound_after: false,
  from: 'work',
})
const form = () => render(<AnnotationForm initial={ROW} onSubmit={() => {}} onCancel={() => {}} submitLabel="Save" />)

beforeEach(() => {
  cleanup()
  sources = [{ id: 9, name: '1984.epub', format: 'epub', bytes: 300000, origin: 'upload', state: 'file' }]
  context = (path) => {
    const m = /before=(\d+)/.exec(path)
    return { ok: true, status: 200, data: answer(m ? Number(m[1]) : 1) }
  }
})

describe('the edit form', () => {
  it('shows the lines around the quote, names the file, and Show more widens it', async () => {
    form()
    expect(await screen.findByText(/It was a bright cold day in April, and the clocks/)).toBeTruthy()
    expect(screen.getByText(BEFORE[2])).toBeTruthy()
    expect(screen.queryByText(BEFORE[0])).toBeNull()
    expect(screen.getByText(/1984\.epub/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText(BEFORE[0])).toBeTruthy()
  })

  it('says why there is no context only when the work has a file', async () => {
    context = () => ({ ok: false, status: 404, data: { error: 'this quote has no context' } })
    form()
    expect(await screen.findByText(/Not found in 1984\.epub/)).toBeTruthy()

    cleanup()
    sources = []
    form()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /quote/i })).toBeTruthy())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(/Not found in/)).toBeNull()
    expect(screen.queryByText('In context')).toBeNull()
  })

  it('says when the context could not be loaded, and Try again loads it', async () => {
    let fail = true
    context = (path) => (fail ? { ok: false, status: 0, data: null } : { ok: true, status: 200, data: answer(1) })
    form()
    expect(await screen.findByText(/Could not load the context/)).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(BEFORE[2])).toBeTruthy()
  })
})
