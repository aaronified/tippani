// The user list stops offering what the server is about to refuse.
//
// The rules themselves are the server's, and they are tested there — a hidden
// button is a courtesy to the person who was not going to press it, and the
// request is four words of curl. What this file is for is the other failure:
// a page that shows "Revoke admin" beside somebody else's name, which is an
// invitation to an error message and, worse, a claim about what you are allowed
// to do that is not true.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let USERS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/admin/users') return { ok: true, data: { users: USERS } }
    return { ok: true, data: {} }
  }),
}))

const { UserManagement } = await import('../../src/Account.jsx')

const ME = { id: 1, username: 'alice', is_admin: true }
const row = (id, username, is_admin) => ({ id, username, is_admin, created_at: '2026-01-01' })

beforeEach(() => {
  USERS = [row(1, 'alice', true), row(2, 'bob', false), row(3, 'carol', true)]
})

const show = async () => {
  render(<UserManagement me={ME} />)
  await screen.findByText('bob')
}

describe('the role control', () => {

  it('offers nobody a way out when I am the only admin', async () => {
    USERS = [row(1, 'alice', true), row(2, 'bob', false)]
    await show()
    expect(screen.queryByText('Step down')).toBeNull()
    expect(screen.getByText('only admin')).toBeTruthy()
  })
})

describe('the delete control', () => {

  it('will not remove another admin', async () => {
    // THE BYPASS. Refusing to take carol's rights while offering to delete her
    // account protects nothing — it is the same act, louder, and it takes her
    // library with it.
    await show()
    expect(screen.queryByLabelText('Delete carol')).toBeNull()
  })

})

