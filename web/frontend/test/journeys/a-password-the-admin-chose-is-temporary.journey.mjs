// An admin makes an account for a friend and tells them the password. The friend
// signs in and meets one screen only — choose your own — and their library opens
// once they have. Picking the admin's password again is refused.
//
// WHAT THIS GUARDS. The owner: "admin shall never have access to others' data".
// An admin who chose a reader's password could sign in as that reader for as long
// as the reader kept it, so the password is temporary until the reader replaces it.
//
// Mutations: with `press('Update password')` for the new password deleted, the
// library never opens and "Daily quiz" waits in vain; with the Log out
// request removed, "Sign in" never appears.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader given a password by the admin must choose their own before the library opens', async () => {
  await app.goto('/profile')
  await app.type('username', 'friend-reader')
  await app.type('password for the new account', 'from-the-admin')
  await app.press('Add user')
  await app.see('friend-reader')

  await app.press('Switch')
  await app.type('account name', 'friend-reader')
  await app.type('their password', 'from-the-admin')
  await app.press('Sign in')

  await app.see('Choose your own password')
  await app.gone('Daily quiz')

  // THE WAY OUT WORKS, and signs out for real: back at the sign-in form, and
  // signing in again lands on the same screen, not in the library.
  await app.press('Log out')
  await app.see('Sign in')
  // A reload asks the server: a session that survived would land back on the
  // password screen instead.
  await app.goto('/')
  await app.see('Sign in')
  await app.type('username', 'friend-reader')
  await app.type('password', 'from-the-admin')
  await app.press('Sign in')
  await app.see('Choose your own password')

  // The admin's password again is not a password of one's own.
  await app.type('current password', 'from-the-admin')
  await app.type('new password (8–20)', 'from-the-admin')
  await app.type('repeat new password', 'from-the-admin')
  await app.press('Update password')
  await app.see('choose a password of your own')

  await app.type('current password', 'from-the-admin')
  await app.type('new password (8–20)', 'friends-own-pw')
  await app.type('repeat new password', 'friends-own-pw')
  await app.press('Update password')
  // Home, signed in as friend-reader. Not the greeting: on 1 January (the harness's
  // clock) it is one of several holiday lines, and which one varies by run.
  await app.see('Daily quiz')
  await app.see('friend-reader')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
