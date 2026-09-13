// THE FIRST JOURNEY, AND THE ONE THE REST STAND ON: a reader signs in and the app
// is there.
//
// It knows the address it opens and the words on the screen. It does not know a
// component, a class, a route module or a JSON field.
//
// WHAT IT WOULD CATCH that nothing in the old suite would: a login form whose
// submit no longer submits, a session cookie the server sets but the SPA drops, a
// shell that throws on mount, a web/dist that is stale against the source it
// claims to be built from, and a server that will not start at all. Every one is
// invisible to a mocked jsdom render and to a Go handler test, because each of
// those owns only one side of it.
//
// IT DOES NOT NAME A BOOK, AND THE FIRST DRAFT DID — which is worth recording,
// because it is the exact failure this whole tier exists to end. `toContain
// ('Moby-Dick')` passed, so it was committed as proven. Run four copies of the
// same file at once and three went red on identical code: Home SHUFFLES which of
// the library's works it shows, and the draw decided the result. A test that
// passes because the dice came up right is worse than no test — it is a green
// tick somebody will trust.
//
// Two things came out of it. The world now pins Math.random, so the draw is the
// same every run (see harness/world.mjs). And this file asserts what is on the
// screen no matter what the fixture holds; naming a work belongs on a screen that
// lists the whole library, which is the next journey and needs the locator
// vocabulary to reach.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader who signs in is inside the app, not still at the door', async () => {
  await app.goto('/')

  // NOT STILL AT THE DOOR, SAID THE WAY A READER WOULD SAY IT. This sentence sits
  // under the login form and nowhere else in the app: an admin can reset your
  // password is advice for somebody who cannot get in. If the sign-in had not
  // taken, it would be on the screen.
  //
  // IT USED TO BE A CSS SELECTOR HERE — `input[autocomplete="current-password"]`
  // through app.page.$ — which is precisely the knowledge this tier forbids, and
  // it was also the harness's OWN check said twice: ensureSession waits for
  // `[data-screen-label]` to stop naming an auth screen before it returns. A
  // journey that repeats the setup's private test adds nothing. What a journey
  // can add is the READER's version of the same question, asked of the words on
  // the screen rather than of an attribute nobody can see.
  await app.gone('locked out?')

  // AND THE APP DREW ITSELF. Named by the places a reader can go, because "the
  // page is not empty" is also true of an error screen.
  // BOTH OF THESE WERE READ OFF A REAL RENDER, not guessed. The first draft also
  // asserted 'Search' — reasonable, and wrong: that control carries a glyph and
  // no visible word on this screen, so six files went red at once. A journey may
  // only claim what somebody has actually seen on the screen.
  await app.see('Home')
  await app.see('Library')

  // A SCREEN THAT THREW ON MOUNT CAN STILL LOOK RIGHT, because React keeps the
  // last good render around it. The page's own errors are collected for exactly
  // this: a journey that passes over a thrown exception will pass over the next.
  expect(app.pageErrors(), 'the page threw while the reader was looking at it').toEqual([])
})
