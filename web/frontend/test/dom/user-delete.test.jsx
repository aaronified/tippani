// Deleting another account — the most destructive of the thirteen doors that
// `confirm()` had made untestable.
//
// WHY THIS ONE NEXT. `removeUser` takes a whole person's library with it, and
// until the question became the app's own dialog the DELETE under it could not be
// reached from a test at all: jsdom has no `confirm()`, so the guard was always
// taken. Nothing in this repo had ever asserted that pressing the bin on a user
// row sends the request, or that cancelling sends nothing.
//
// The sentence matters as much as the request. "Their books and annotations are
// removed too" is the whole reason a reader is being asked, and a dialog that
// asked without it would be a confirmation of the wrong thing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let USERS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path === '/admin/users') return { ok: true, data: { users: USERS } }
    if (method === 'DELETE' && path.startsWith('/admin/users/')) {
      USERS = USERS.filter((u) => `/admin/users/${u.id}` !== path)
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { UserManagement } = await import('../../src/Account.jsx')

const ME = { id: 1, username: 'alice', is_admin: true }

beforeEach(() => {
  CALLS = []
  USERS = [
    { id: 1, username: 'alice', is_admin: true },
    { id: 2, username: 'bob', is_admin: false },
  ]
})
afterEach(() => cleanup())

const rowFor = async (name) => (await screen.findByText(name)).closest('li')

const pressDelete = async (row) => {
  await act(async () => {
    within(row).getByLabelText(/^Delete /).click()
  })
}

describe('deleting another account', () => {
  it('asks first, names them, and says the library goes too', async () => {
    render(<UserManagement me={ME} />)
    await pressDelete(await rowFor('bob'))

    // ALERTDIALOG, because this one destroys something. `ConfirmDialog` takes
    // the role the pack gives it (`book-detail.dc.html:562`) whenever the act
    // is destructive or final, so a screen reader interrupts rather than waits —
    // and asking for it by name here is what keeps this question in that class.
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Delete user "bob"\?/)).toBeTruthy()
    expect(within(dialog).getByText(/books and annotations are removed too/)).toBeTruthy()
    // The dialog is a question, not a receipt.
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })

  it('sends the delete once the question is answered yes', async () => {
    render(<UserManagement me={ME} />)
    await pressDelete(await rowFor('bob'))
    await act(async () => {
      screen.getByText('Confirm').closest('button').click()
    })
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/admin/users/2')).toBe(true))
  })

  it('sends nothing when the question is answered no', async () => {
    render(<UserManagement me={ME} />)
    await pressDelete(await rowFor('bob'))
    await act(async () => {
      screen.getByText('Cancel').closest('button').click()
    })
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
    expect(await rowFor('bob')).toBeTruthy()
  })

  // NO DOOR AT ALL ON YOUR OWN ROW, so there is no question to answer on it. The
  // server refuses this too; the page not offering it is what stops a reader
  // reaching a dialog whose only outcome is an error.
  it('offers no delete on your own row', async () => {
    render(<UserManagement me={ME} />)
    const mine = await rowFor('alice')
    expect(within(mine).queryByLabelText(/^Delete /)).toBeNull()
  })
})
