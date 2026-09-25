// The admin's walk through Settings has three stops. A second reader's has one,
// and the two it drops are the two only an admin can act on.
//
// THIS IS THE GUARD THAT WENT MISSING, and it went missing in the commit that
// added the per-screen tour. `tour-sections.test.js` held the admin rule — steps
// marked `admin` drop out for everyone else — and it was deleted along with the
// Settings picker it had grown up beside. Nothing replaced it. The rating that
// found this put it plainly: strike the admin filter out of `tourSteps` and the
// whole suite stays green, including the per-screen tour's own journey, because
// the harness signs in as an admin and an admin is exactly who cannot see the
// difference.
//
// AND IT IS A REAL WALK, NOT AN ARGUMENT ABOUT A LIST. What a reader would meet
// is a tour that stops on the API-keys card and the Backup card — two panels
// their account does not draw — and talks them through pasting keys they cannot
// save and restoring an archive they cannot upload. The button's own words are
// the first half of the claim and stepping through it is the second: a count is
// cheap to keep right while the steps behind it drift.
//
// A SECOND ACCOUNT IS MADE HERE RATHER THAN ASSUMED, the same way
// `per-user-isolation` makes one: a reader added from the Profile screen is an
// ordinary account, and ordinary is the case with no coverage.
//
// THERE ARE TWO ADMIN FILTERS AND THIS FILE USED TO GUARD ONE OF THEM.
//
// `tourSteps` builds the WELCOME tour and `tourStepsForTab` builds a screen's own
// walk, and each applies `!s.admin || isAdmin` separately. The header here named the
// first and the test exercised only the second: strike the filter out of `tourSteps`
// and every one of the 4,425 vitest tests and all the journeys stayed green,
// including this one — while a reader who is not an admin was walked through the
// API-keys card and the Backup card on their very first launch, which is the precise
// harm the paragraphs above describe. A second rating found it by mutating the line
// this file had named. A header that claims a stronger test than the file contains is
// worse than no header, and this is the second time that has been true in this
// directory; so the welcome tour is now checked HERE, in the same file, rather than
// left to the reader of a comment.
//
// THE COUNT IS THE CLAIM, AND IT IS EXACT ON PURPOSE. A fresh account's welcome tour
// says "1 of 19" — nineteen being what is left after the two admin steps drop and the
// sections a new reader has switched off drop with them. Remove either filter and the
// number moves, which is a thing a journey can see without pressing Next nineteen
// times. It also means adding a tour step updates this number, and that is the right
// cost: the number IS what the reader is promised at the top of the tour.
//
// THE MUTATIONS: drop `!s.admin || isAdmin` from `tourSteps` and the welcome tour
// below offers 21 steps rather than 19; drop it from `tourStepsForTab` and the
// per-screen button offers three steps instead of one; walk past that and the tour
// stops on Metadata keys, which the `gone` refuses.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// The two steps an admin gets on this screen and nobody else does, by the words
// the tour puts on them.
const ADMIN_ONLY = 'Metadata keys & the Amazon cookie'

it('a reader who is not an admin is walked past the cards only an admin has', async () => {
  // THE ADMIN'S OWN SETTINGS TOUR FIRST, because "one step" means nothing without
  // the number it is smaller than. This is the same button, on the same screen,
  // for an account that can act on all three.
  await app.goto('/settings')
  await app.press('Help for Settings')
  await app.see('Show me around this screen (3 steps)')
  await app.pressKey('Escape')

  // A SECOND, ORDINARY ACCOUNT.
  await app.press('Profile — journey-reader')
  await app.type('username', 'plain-reader')
  await app.type('password for the new account', 'plain-reader-pw')
  await app.press('Add user')
  await app.see('plain-reader')

  await app.press('Switch')
  await app.type('account name', 'plain-reader')
  await app.type('their password', 'plain-reader-pw')
  await app.press('Sign in')
  // The admin's password is temporary; the reader picks their own first. The
  // switch reloads the page, so the screen is waited for before anything is typed.
  await app.see('Choose your own password')
  await app.type('current password', 'plain-reader-pw')
  await app.type('new password (8–20)', 'plain-own-pw')
  await app.type('repeat new password', 'plain-own-pw')
  await app.press('Update password')
  // Home, signed in as plain-reader. Not the greeting: on 1 January (the harness's
  // clock) it is one of several holiday lines, and which one varies by run.
  await app.see('Daily quiz')
  await app.see('plain-reader')

  // THE WELCOME TOUR, WHICH THIS ACCOUNT MEETS BEFORE ANYTHING ELSE. It opens by
  // itself on a first launch, and what it promises is a length.
  await app.see('1 of 19')
  // And the first of the two steps it must not contain is not in it — read here
  // rather than nineteen presses later, because the count above is what proves the
  // whole list and this proves the count is about the right thing.
  await app.gone(ADMIN_ONLY)

  await app.press('skip tour')

  // THE SAME BUTTON, ON THE SAME SCREEN, FOR SOMEBODY WHO IS NOT AN ADMIN.
  await app.goto('/settings')
  await app.press('Help for Settings')
  await app.see('Show me around this screen (1 step)')

  // AND WALKING IT NEVER REACHES THEM. The one step it does have is the one this
  // account can act on, and the tour ends rather than going on to the two it
  // cannot: `Next` is not there to press.
  await app.press('Show me around this screen (1 step)')
  await app.see('Make it yours')
  await app.gone(ADMIN_ONLY)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
