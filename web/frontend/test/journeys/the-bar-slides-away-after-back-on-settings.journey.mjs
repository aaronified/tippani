// A reader on a phone goes into a Settings section, taps Back to its index, goes
// into another and scrolls down to read it. The bottom bar slides away, as it
// does on every other screen.
//
// WHAT THIS GUARDS. The owner: "the bottom bar is not auto hiding on settings and
// metadata. this is sorted in all other screens". The dock kept itself up while a
// key inside it held focus, and a tapped Back key that became disabled on the
// index never lost that focus, so the dock stayed up for the rest of the visit.
//
// DECLARED EXCEPTIONS, BOTH THROUGH `app.page`. First, motion: the harness
// launches with reduced motion asked for, and a reader who asks for that gets no
// sliding bar at all, by design. This reader has the phone's default, so the page
// is told so. Second, ONE SWIPE. The harness has no verb for
// scrolling by finger, and the vocabulary's scrolls do not serve: `press` scrolls
// its target into view and then presses it, and `pressKey('End')` is a keyboard
// press, after which the dock is RIGHT to stay up for the keyboard user. A mouse
// wheel is the nearest thing to a thumb that moves the page without touching a
// control.
//
// Mutation: with `press('Back')` deleted the dock hides and this passes, which is
// why the press is the decisive step; with the fix reverted (focus flag set on
// any focus, cleared only on blur) `inReach('Back')` stays true.
//
// It knows the words on the screen, and one swipe.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('after tapping Back on Settings, scrolling a section still slides the bar away', async () => {
  await app.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await app.goto('/settings/theme')
  await app.press('Back')
  await app.see('Language and font')
  await app.press('Theme')

  await app.page.mouse.wheel({ deltaY: 1200 })
  await new Promise((r) => setTimeout(r, 600))

  expect(await app.inReach('Back'), 'the bar stayed up while the reader scrolled down').toBe(false)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
