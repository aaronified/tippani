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

  const onScreen = await app.page.evaluate(() => document.body.innerText)

  // NOT STILL AT THE DOOR. A failed sign-in leaves the password box on screen,
  // and a journey that only checked for "some text" would pass on it.
  const stillAsking = await app.page.$(
    'input[autocomplete="current-password"], input[autocomplete="new-password"]')
  expect(stillAsking,
    `the sign-in form is still on screen, so the reader never got in:\n${onScreen.slice(0, 400)}`)
    .toBeNull()

  // AND THE APP DREW ITSELF. Named by the places a reader can go, because "the
  // page is not empty" is also true of an error screen.
  // BOTH OF THESE WERE READ OFF A REAL RENDER, not guessed. The first draft also
  // asserted 'Search' — reasonable, and wrong: that control carries a glyph and
  // no visible word on this screen, so six files went red at once. A journey may
  // only claim what somebody has actually seen on the screen.
  for (const place of ['Home', 'Library']) {
    expect(onScreen, `the app drew no way to reach ${place}`).toContain(place)
  }

  // A SCREEN THAT THREW ON MOUNT CAN STILL LOOK RIGHT, because React keeps the
  // last good render around it. The page's own errors are collected for exactly
  // this: a journey that passes over a thrown exception will pass over the next.
  expect(app.pageErrors(), 'the page threw while the reader was looking at it').toEqual([])
})
