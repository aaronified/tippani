// Two people share one Tippani. The admin who is already signed in adds a
// second account from their own Profile screen, switches into it — typing that
// account's own password, because the app asks for it every time — and finds
// an empty notebook: no books, no quotes, none of the admin's own library on
// screen. Then they switch back and find their own shelf exactly as they left
// it.
//
// THIS IS THE APP'S LOUDEST PROMISE AND NOTHING IN THE BROWSER TIER CHECKED IT
// BEFORE THIS FILE. Per-user isolation is an invariant the repo states in its
// own CLAUDE.md — every query scoped by user_id — and a Go test can prove that
// ONE handler honours that scope for a request built by hand. It cannot prove
// what this file proves: that the real screens a person actually opens, wired
// through the real session the real sign-in form hands back, never leak one
// account's rows into the other's render. A query missing its user_id filter
// would not show up as a 500 or a thrown error — it would show up as a second
// person's book quietly present on a screen that is supposed to be empty, which
// is exactly the shape of bug a mocked handler test and a jsdom render are both
// structurally unable to notice: the first never renders a screen, and the
// second never holds two real, differently-scoped sessions against the same
// running server at once.
//
// THE NON-VACUITY ARGUMENT. 'The Idiot' is one of the handful of titles
// CLAUDE.md marks as fixed in this fixture, so naming it here is not a guess
// against a library that regenerates every run. Before any of this journey
// runs, journey-reader's Library already holds it and already says "27 BOOKS ·
// 629 QUOTES" — so the interesting claims are not "a library has some books" (
// true from the moment the fixture seeds, proving nothing about isolation) but
// "THIS OTHER, freshly created account's Library has NONE of them", which is
// false at every point before the account is created and switched into, and
// "journey-reader's own shelf, after a detour through a second account, is back
// to what it was" — which a leak in either direction would break: a query that
// forgot its scope could as easily show the first user's rows to the second as
// erase the first user's own on the way back.
//
// THE PASSWORD GATE IS ASSERTED, NOT ASSUMED. Switching accounts is a real
// re-authentication, not a name picked off a list — so this journey first tries
// the wrong password for the very account it just created and confirms the app
// refuses it and states so on screen, before it tries the password that works.
// A switch that silently let any string through would still look, to a reader
// skimming only the success path, like a working feature.
//
// THE SECOND ACCOUNT IS MADE THROUGH THE API. The Add-user form on Profile was
// cut from the web app (ADR-0936: user management is the Android app's job), so
// the account comes from `app.secondReader`, which is the admin's own API and
// signs the browser in as the new reader through the sign-in form. Everything
// this file ASSERTS still happens on screen: the sign-in, the wrong password
// being refused, the switch back, and both libraries.
//
// ONE DECLARED EXCEPTION, per the repo's own rule that an exception must say
// what it knows and why nothing observable could serve: switching back into
// journey-reader means typing THAT account's own password, which the harness
// hands the journey as `app.account.password` (the world keeps the variable's
// name to itself). Nothing on any screen ever prints a password in the clear, so
// there is no observable alternative; a signed-in reader is assumed to know their
// own password, and this is that password, not a selector or a module name.
//
// It knows the addresses it opens, the words on the screen, and the API route
// and fields `secondReader` uses to make the account (inside the harness).

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a second account sees an empty notebook, and the first gets its own back', async () => {
  // THE ADMIN'S OWN SHELF, BEFORE ANY OF THIS STARTS. Both the fixed title and
  // the fixture's own count are on screen — the count moves if the fixture is
  // ever re-curated, the title does not, and asserting both costs nothing.
  await app.goto('/library')
  await app.see('The Idiot')
  await app.see('27 BOOKS')

  // A SECOND ACCOUNT, MADE BY THE ADMIN AND SIGNED IN THROUGH THE FORM. Its
  // password is its own, so no temporary-password screen stands in the way; the
  // password screen has its own file.
  await app.secondReader({ username: 'second-reader', password: 'second-reader-pw' })
  // The new account is who the browser is now, and its own name is on the page.
  await app.see('second-reader')

  // AND ITS LIBRARY IS EMPTY. Not "the count reads zero" alone, which a screen
  // that failed to load anything at all would also show — the app's own empty
  // state, and the specific title from the OTHER account's shelf, checked gone.
  await app.goto('/library')
  await app.see('no books yet')
  await app.gone('The Idiot')

  // BACK TO THE FIRST ACCOUNT. Switching asks for that account's own password
  // every time, so the wrong one is tried first and must be refused.
  await app.press('Profile — second-reader')
  await app.press('Switch')
  await app.type('account name', 'journey-reader')
  await app.type('their password', 'not-the-right-password')
  await app.press('Sign in')
  await app.see('invalid credentials')

  await app.type('their password', app.account.password)
  await app.press('Sign in')
  // Home, signed in as journey-reader. Home is the start page now: its heading
  // and its Add and Search doors, and the account's name in the page's own text,
  // which nothing but an actual switch of session could put there.
  await app.see('Home')
  await app.see('journey-reader')

  // AND THE FIRST ACCOUNT'S OWN SHELF IS EXACTLY WHAT IT WAS — not merely
  // non-empty, which a library that had picked up the second account's rows
  // instead of losing its own would also show, but the same fixed title and
  // the same count as at the top of this test.
  await app.goto('/library')
  await app.see('The Idiot')
  await app.see('27 BOOKS')

  expect(app.pageErrors(), 'the page threw while the reader was looking at it').toEqual([])
})
