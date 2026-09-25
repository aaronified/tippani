// An admin deletes a reader's account. The account waits in the admin's Bin so
// it can be restored, and the admin can see whose it is and how much it holds —
// but not open it and read the reader's quotes.
//
// WHAT THIS GUARDS. The admin-data gap the owner chose to close before v3: an
// account in the bin sat behind the same "What is inside" chevron as a deleted
// book, so deleting somebody handed the admin their whole library to read. The
// bin holds it for custody, not access. The Go test proves the server sends no
// contents; this proves the screen offers no door to them.
//
// ONE DECLARED EXCEPTION, the one per-user-isolation.journey.mjs makes: switching
// back into the admin types the admin's own password, from TIPPANI_JOURNEY_PASS.
//
// Mutation: with the account kind's exclusion removed from the bin's expandable
// rule, "What is inside sealed-reader" can be pressed and the rejection fails. A
// first draft asserted it with `gone`, which reads text, and passed with the
// chevron drawn — the mutation is what showed it.
//
// It knows the words on the screen and that password.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const LINE = 'A private line nobody else should read.'

it("a deleted account shows its name in the bin but not what it holds", async () => {
  // SETUP: a second reader with one quote of their own, made through the screen.
  await app.goto('/profile')
  await app.type('username', 'sealed-reader')
  await app.type('password for the new account', 'from-the-admin')
  await app.press('Add user')
  await app.see('sealed-reader')
  await app.press('Switch')
  await app.type('account name', 'sealed-reader')
  await app.type('their password', 'from-the-admin')
  await app.press('Sign in')
  // The switch reloads the page; typing before the new screen is up types into
  // the old document, which is gone.
  await app.see('Choose your own password')
  await app.type('current password', 'from-the-admin')
  await app.type('new password (8–20)', 'sealed-own-pw')
  await app.type('repeat new password', 'sealed-own-pw')
  await app.press('Update password')
  await app.see('Daily quiz')
  await app.press('skip tour')
  await app.goto('/quotes')
  await app.press('Add or import')
  await app.press('A quote')
  await app.press('Proverb')
  await app.type('Quote', LINE)
  await app.press('Save')
  await app.gone('Show every field')

  // BACK TO THE ADMIN, who deletes the account.
  await app.press('Profile — sealed-reader')
  await app.press('Switch')
  await app.type('account name', 'journey-reader')
  await app.type('their password', app.account.password)
  await app.press('Sign in')
  await app.see('Daily quiz')
  await app.goto('/profile')
  await app.press('Delete sealed-reader')
  // The question says where it goes: the account is binned, not destroyed.
  await app.see('waits in your bin')
  await app.press('Confirm')

  // THE BIN HOLDS IT BY NAME, AND KEEPS IT SHUT.
  await app.goto('/bin')
  await app.see('sealed-reader')
  // A PRESS, NOT A `gone`. The chevron is a glyph with only a name, so its words
  // are never on the screen and `gone` would pass with it drawn; asking to press
  // it is what a reader looking for the way in would do, and there is none.
  await expect(app.press('What is inside sealed-reader', { timeout: 2000 }))
    .rejects.toThrow('nothing a person could press is named')
  await app.gone(LINE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
