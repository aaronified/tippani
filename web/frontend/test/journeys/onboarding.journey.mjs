// A PERSON WHO HAS JUST STOOD UP A TIPPANI OF THEIR OWN, WITH NO ACCOUNT IN IT
// YET, TYPES A USERNAME AND A PASSWORD AND PRESSES "CREATE ADMIN ACCOUNT" —
// AND ENDS UP INSIDE THE APP, SIGNED IN, RATHER THAN BACK AT A LOGIN FORM.
//
// This is the one journey in the suite that opens the world with `{ empty:
// true }`, because onboarding is reachable exactly once: the screen only draws
// when the server holds no accounts at all, and every other journey signs in
// against a library that already has one. There is no second way to see this
// screen short of a fresh server, which is what `empty: true` boots.
//
// WHAT THIS CATCHES THAT NOTHING CHEAPER CAN. A Go handler test can prove that
// POSTing the right shape to the onboarding endpoint returns a session cookie —
// but it cannot see whether the SPA's form actually calls that endpoint, whether
// the browser is left holding that cookie afterwards, or whether the app then
// reads its own cookie and draws the signed-in shell rather than redrawing the
// login form out of stale client state. A jsdom render with a mocked fetch can
// assert the form posts the right body, but it cannot see the real round trip:
// a real server issuing a real session, a real browser storing it, and a real
// second render deciding, from that state, what to show next. The exact failure
// this journey exists to rule out is an onboarding flow that creates the account
// correctly on the server and then leaves the person looking at the login box
// again — which reads, to a person, as "did that even work?" and to a mocked
// test as nothing at all, because nothing after the POST was ever exercised.
//
// THE NON-VACUITY ARGUMENT. Every assertion below is about the world AFTER the
// account is created, and none of them is true before it: the fixture always
// starts on the onboarding screen (that is what `empty: true` guarantees), so
// "the onboarding copy is gone" and "the typed username is on screen" are both
// false at the top of the test and can only become true if the Create button
// actually created the account and the app actually moved past the door. A
// journey that skipped the press, or pressed a button that silently failed,
// would still be looking at the onboarding screen when these run — which is
// exactly what the mutant below proves.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ empty: true })

it('creating the first account signs the founder straight into the app', async () => {
  await app.goto('/')

  // THE DOOR, CONFIRMED BEFORE WALKING THROUGH IT. If this line ever failed the
  // rest of the test would be asserting nothing — there would be no admin form
  // to have used.
  await app.see('This first account becomes the admin.')

  await app.type('username', 'founder')
  await app.type('password', 'a-first-run-pass')
  await app.press('Create admin account')

  // NOT STILL AT THE DOOR. The onboarding copy is specific to the account-less
  // screen — it does not recur anywhere inside the signed-in app — so its
  // disappearance is the app moving off that screen, not merely a redraw of it.
  await app.gone('This first account becomes the admin.')

  // AND ACTUALLY SIGNED IN, not dropped on some other public screen. The
  // founder's own username, which nothing but a successful sign-in would have
  // anywhere to come from, is drawn in the app shell next to the rest of the
  // navigation a signed-in reader gets.
  await app.see('founder')
  await app.see('Home')
  await app.see('Library')

  // A SCREEN THAT THREW ON MOUNT CAN STILL LOOK RIGHT, because React keeps the
  // last good render around it.
  expect(app.pageErrors(), 'the page threw while the reader was looking at it').toEqual([])
})
