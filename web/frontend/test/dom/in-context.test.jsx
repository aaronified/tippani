// A QUOTE IN ITS FILE. A highlight can be opened in context — what came before and
// after, from rows stored when the work's file was added — and the action is ABSENT,
// not disabled, on a quote with nothing to show.
//
// WHAT THIS KNOWS: the two addresses the card reads (the work's list of quotes that
// have context, and one quote's context), the words on screen, and what a person can
// press. It names no function and no class. The read is a stored row, so the panel
// opening is itself the claim that the file is not needed.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const reads = []
let hasContext = [5]
let answer
const THEN = {
  before: 'The road ran north along the river.',
  body: 'It was a bright cold day in April, and the clocks were striking thirteen.',
  after: 'Winston Smith slipped quickly through the glass doors.',
  unit: 'paragraph',
  span: { before: 1, after: 1 },
  stored: { before: 1, after: 4 },
  bound_before: true,
  bound_after: false,
}

vi.mock('../../src/api.js', () => ({
  json: async (method, path) => {
    reads.push(path)
    if (path.startsWith('/sources/context-ids')) return { ok: true, data: { ids: hasContext } }
    if (path.startsWith('/quotes/annotation/5/context')) return { ok: true, data: answer(path) }
    return { ok: true, data: {} }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
  putUpload: async () => ({ ok: true, data: {} }),
}))

const { AnnotationCard } = await import('../../src/Library.jsx')
const { invalidateContext } = await import('../../src/sources.jsx')

const ROW = (id) => ({ id, book_id: 3, quote: 'It was a bright cold day in April', chapter: 'One', created_at: '2024-01-02' })
const card = (id) =>
  render(<AnnotationCard a={ROW(id)} tagMap={{}} editing={false} save={() => {}} patch={() => {}} remove={() => {}} />)
const menu = () => fireEvent.contextMenu(screen.getAllByText(/bright cold day/)[0])
const labels = () => screen.getAllByRole('menuitem').map((n) => n.textContent.trim())

beforeEach(() => {
  cleanup()
  // The work's list is kept between cards, which is the point of it; a test starts clean.
  invalidateContext()
  reads.length = 0
  hasContext = [5]
  answer = () => THEN
})

describe('a highlight in its file', () => {
  it('offers In context when the work has stored context for it, and opens it from one row', async () => {
    card(5)
    await waitFor(() => expect(reads.some((p) => p.startsWith('/sources/context-ids?subject=book&subject_id=3'))).toBe(true))
    await waitFor(() => {
      menu()
      expect(labels()).toContain('In context')
    })
    fireEvent.click(screen.getByText('In context'))
    expect(await screen.findByText(THEN.body)).toBeTruthy()
    expect(screen.getByText(THEN.before)).toBeTruthy()
    expect(screen.getByText(THEN.after)).toBeTruthy()
    // It says where it ran out, once, and what window is shown.
    expect(screen.getByText('Its chapter begins here.')).toBeTruthy()
    expect(screen.getByText('1 before, 1 after')).toBeTruthy()
  })

  it('does not offer it on a quote the file could not place', async () => {
    card(6)
    await waitFor(() => expect(reads.some((p) => p.startsWith('/sources/context-ids'))).toBe(true))
    menu()
    expect(labels()).not.toContain('In context')
  })

})
