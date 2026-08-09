// The user list stops offering what the server is about to refuse.
//
// The rules themselves are the server's, and they are tested there — a hidden
// button is a courtesy to the person who was not going to press it, and the
// request is four words of curl. What this file is for is the other failure:
// a page that shows "Revoke admin" beside somebody else's name, which is an
// invitation to an error message and, worse, a claim about what you are allowed
// to do that is not true.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

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
  it('offers to promote a member', async () => {
    await show()
    // The half that stays: an admin may make anyone an admin.
    expect(screen.getAllByTitle('Make bob an admin')).toHaveLength(1)
  })

  it('is not offered on another admin, in either direction', async () => {
    await show()
    // carol is an admin and is not me. There is nothing here I may do to her
    // role, so there is no control — not a disabled one, which still reads as
    // "this is mine to do, just not right now".
    expect(screen.queryByTitle(/carol/i)).toBeNull()
    expect(screen.queryByText('Revoke admin')).toBeNull()
  })

  it('lets me step down, and says so in the first person', async () => {
    await show()
    // "Step down", not "Revoke admin": the button on my own row is the only
    // revoke there is, and it is something I do rather than something done.
    expect(screen.getByText('Step down')).toBeTruthy()
  })

  it('offers nobody a way out when I am the only admin', async () => {
    USERS = [row(1, 'alice', true), row(2, 'bob', false)]
    await show()
    expect(screen.queryByText('Step down')).toBeNull()
    expect(screen.getByText('only admin')).toBeTruthy()
  })
})

describe('the delete control', () => {
  it('removes a member', async () => {
    await show()
    expect(screen.getByLabelText('Delete bob')).toBeTruthy()
  })

  it('will not remove another admin', async () => {
    // THE BYPASS. Refusing to take carol's rights while offering to delete her
    // account protects nothing — it is the same act, louder, and it takes her
    // library with it.
    await show()
    expect(screen.queryByLabelText('Delete carol')).toBeNull()
  })

  it('will not remove me either', async () => {
    await show()
    expect(screen.queryByLabelText('Delete alice')).toBeNull()
  })
})

describe('the second copy of this screen', () => {
  it('is gone', async () => {
    // Settings.jsx carried an unused AdminUsers with the same list, the same
    // add form, the same delete — and none of the rules. Dead code that
    // duplicates a live screen reads as the implementation.
    const src = await import('../../src/Settings.jsx')
    expect(Object.keys(src)).not.toContain('AdminUsers')
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const text = readFileSync(join(process.env.TIPPANI_SRC, 'Settings.jsx'), 'utf8')
    expect(text).not.toMatch(/function AdminUsers\b/)
  })
})
