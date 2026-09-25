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
// A THIRD EXCEPTION, in the keyboard case: which control has focus is read off
// the page (its accessible name), because a keyboard reader knows where focus
// is and the vocabulary has no verb for it.
//
// It knows the words on the screen, one swipe, and where focus is.

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

  // AND A KEYBOARD READER WHO TABS INTO THE BAR GETS IT BACK. The fix's first cut
  // read focus at render time, and nothing re-rendered when focus arrived, so the
  // bar stayed away with focus on a key off-screen.
  // BACKWARDS FROM THE END, so focus reaches the bar without passing a control
  // on the page: tabbing forwards scrolls the page to each one, the scroll
  // re-renders the bar, and that hid the defect this line exists to catch.
  let onKey = false
  for (let i = 0; i < 30 && !onKey; i++) {
    await app.page.keyboard.down('Shift')
    await app.page.keyboard.press('Tab')
    await app.page.keyboard.up('Shift')
    onKey = await app.page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Back')
  }
  expect(onKey, 'Tab never reached the bar').toBe(true)
  await new Promise((r) => setTimeout(r, 400))
  // Where the focused key sits, not `inReach`: the key's own tooltip opens on
  // keyboard focus and covers the point `inReach` tests.
  const onScreen = await app.page.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect()
    return r.top >= 0 && r.bottom <= innerHeight
  })
  expect(onScreen, 'keyboard focus is on a key the bar left off-screen').toBe(true)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('after tapping Back on Metadata, scrolling a section still slides the bar away', async () => {
  await app.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await app.goto('/metadata/people')
  await app.press('Back')
  await app.see('Characters')
  await app.press('People — ')
  await app.page.mouse.wheel({ deltaY: 1500 })
  await new Promise((r) => setTimeout(r, 600))
  expect(await app.inReach('Back'), 'the bar stayed up while the reader scrolled down').toBe(false)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
