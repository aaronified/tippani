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
// THE MUTATION: drop `!s.admin || isAdmin` from `tourSteps` and the second
// account's button offers three steps instead of one, so the `see` of the
// one-step wording fails; walk past it and the tour stops on Metadata keys,
// which the `gone` refuses.

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
  await app.see('empty notebook, plain-reader')

  // A fresh account opens on the welcome tour, and it holds the route on Home
  // until it is dismissed — see `per-user-isolation`, which pays the same toll.
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
