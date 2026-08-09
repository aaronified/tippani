// Switching to another account.
//
// The mechanism was never the problem — it is a real sign-in through the same
// endpoint as the front door, and getting it wrong changes nothing. What was
// wrong was the form: two placeholder-only boxes, no statement of which account
// you were leaving, and a shape that matched nothing else in the card it sits
// in. So the assertions here are about what the form SAYS, because that is what
// was broken, and because "it still logs in" is the part that was already true.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

let LOGIN
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (path === '/auth/login') { LOGIN.push(body); return { ok: false, status: 401, data: { error: 'wrong password' } } }
    return { ok: true, data: {} }
  }),
}))

const { Profile } = await import('../../src/Account.jsx')

const ME = { id: 1, username: 'alice', is_admin: false, avatar_path: '' }

beforeEach(() => { LOGIN = [] })

const profile = () => render(<Profile user={ME} onUser={() => {}} logout={() => {}} />)
const openIt = () => { profile(); fireEvent.click(screen.getByRole('button', { name: /^switch$/i })) }

describe('the switch-account section', () => {
  it('sits closed as one row, like the log out beside it', () => {
    // Two ways out of this account, in one card, that used to be laid out as two
    // different kinds of thing: a heading over a full-width button here, a
    // right-aligned button there.
    profile()
    expect(screen.getByText('Switch account')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^switch$/i })).toBeTruthy()
    expect(screen.queryByLabelText('account name')).toBeNull()
  })

  it('names the account you are leaving', () => {
    // The one fact the form is about, and it was nowhere on it. On a server
    // where several accounts have adjacent names, "switch" with no subject is a
    // question about something you cannot see.
    openIt()
    expect(screen.getByText(/Leaving/)).toBeTruthy()
    expect(screen.getByText('alice')).toBeTruthy()
  })

  it('labels its fields instead of hinting at them', () => {
    // A placeholder is gone the moment you type, which leaves two identical
    // boxes and a password manager's guess about which is which.
    openIt()
    expect(screen.getByLabelText('account name')).toBeTruthy()
    expect(screen.getByLabelText('their password')).toBeTruthy()
  })

  it('says why the button is grey, where you are looking', () => {
    // It said so only in a title attribute, which a touch screen has no way to
    // show at all.
    openIt()
    expect(screen.getByText('Enter the account name')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('account name'), { target: { value: 'bob' } })
    expect(screen.getByText('Enter that account’s password')).toBeTruthy()
  })

  it('refuses the account you are already in', () => {
    // Not an error after a round trip: a switch to yourself is a no-op that
    // would log you out and back in for nothing.
    openIt()
    fireEvent.change(screen.getByLabelText('account name'), { target: { value: 'alice' } })
    expect(screen.getByText('That is the account you are already in')).toBeTruthy()
    expect(LOGIN).toEqual([])
  })

  it('still signs in, which is the part that already worked', () => {
    openIt()
    fireEvent.change(screen.getByLabelText('account name'), { target: { value: ' bob ' } })
    fireEvent.change(screen.getByLabelText('their password'), { target: { value: 'hunter22' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    // Trimmed, and through /auth/login — a real re-authentication rather than an
    // impersonation endpoint that trusts the caller.
    expect(LOGIN).toEqual([{ username: 'bob', password: 'hunter22' }])
  })

  it('closes back to one row, with nothing left in it', () => {
    openIt()
    fireEvent.change(screen.getByLabelText('account name'), { target: { value: 'bob' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByLabelText('account name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^switch$/i }))
    // A half-typed username left behind is a stale answer to a question you did
    // not ask again.
    expect(screen.getByLabelText('account name').value).toBe('')
  })
})
