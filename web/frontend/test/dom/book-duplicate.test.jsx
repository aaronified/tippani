// A BOOK ADDED BY TITLE THAT LOOKS LIKE ONE YOU HAVE. The server holds the add (409 + needs_confirm)
// and sends the look-alikes; the manual form shows them and asks. "Add it anyway" repeats the add with
// confirm_new; Cancel adds nothing. A different 409 (an isbn already held) is still a plain error.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS, REPLY

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'POST' && path === '/books') return REPLY(body)
    return { ok: true, status: 200, data: {} }
  }),
}))

const { ManualTab } = await import('../../src/Library.jsx')
const LOOKALIKE = { ok: false, status: 409, data: { error: 'you already have a book with this title', needs_confirm: true, existing: [{ id: 4, title: 'Fires of Heaven', author: 'Robert Jordan' }] } }

beforeEach(() => {
  cleanup()
  CALLS = []
  REPLY = (body) => (body.confirm_new ? { ok: true, status: 201, data: { id: 9, title: body.title } } : LOOKALIKE)
})

function form(onAdded = () => {}) {
  render(<ManualTab formId="f" title="Fires of Heaven" setTitle={() => {}} onAdded={onAdded} onBusy={() => {}} />)
  fireEvent.submit(document.getElementById('f'))
}

describe('adding a book whose title you already have', () => {
  it('shows the look-alike and its author and adds nothing yet', async () => {
    const added = vi.fn()
    form(added)
    const box = await screen.findByTestId('book-duplicate')
    expect(box.textContent).toContain('You already have a book called “Fires of Heaven”')
    expect(box.textContent).toContain('Robert Jordan')
    expect(added).not.toHaveBeenCalled()
    expect(CALLS.filter(([, , b]) => b?.confirm_new)).toHaveLength(0)
  })

  it('adds it as a separate book, once, when told to', async () => {
    const added = vi.fn()
    form(added)
    fireEvent.click(await screen.findByRole('button', { name: 'Add it anyway' }))
    await waitFor(() => expect(added).toHaveBeenCalledTimes(1))
    const posts = CALLS.filter(([m, p]) => m === 'POST' && p === '/books')
    expect(posts).toHaveLength(2)
    expect(posts[1][2].confirm_new).toBe(true)
  })

  it('adds nothing on Cancel and the box goes away', async () => {
    const added = vi.fn()
    form(added)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByTestId('book-duplicate')).toBeNull())
    expect(added).not.toHaveBeenCalled()
  })

  it('treats a 409 that is not a look-alike as an ordinary error', async () => {
    REPLY = () => ({ ok: false, status: 409, data: { error: 'book already in your library' } })
    form()
    await screen.findByText(/book already in your library|Could not add/i)
    expect(screen.queryByTestId('book-duplicate')).toBeNull()
  })
})
