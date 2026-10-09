// A reader on a desk, in a short window, starts Practice: the round's popup stops
// at the window, and scrolling down to the round's own controls leaves the ✕ in
// reach at the top.
//
// Found by the rating pass over 1e935d00: on a desk the popup had no ceiling, so
// a card taller than the window scrolled the whole scrim and carried the ✕ off
// the top with it, which is the scrolling up and down the owner asked to be rid
// of ("so that the user doesnt need to scroll up and down too much").
//
// A SHORT WINDOW so that every card is taller than it: the capture run measured
// the round at 290 to 350 pixels unanswered and up to 892 answered at 1280, and a
// window of 900 holds most of them, which would let the defect pass unseen.
//
// DECLARED EXCEPTION: `app.page.evaluate` measures the round's box against the
// window, as a-round-takes-the-phone-screen.journey.mjs does and for its reason;
// it knows `role="dialog"` and nothing of the app's classes.
//
// THE MUTATION: the desk card's ceiling removed (`.tp-screen-card`'s max-height):
// red at the measurement, the box running past the window's foot.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ viewport: { width: 1280, height: 300 } })

it('a round on a desk stops at the window and keeps its close in reach', async () => {
  await app.goto('/')
  await app.press('Start practice')
  await app.see('skip')

  const b = await app.page.evaluate(() => {
    const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
    return r && { top: r.top, bottom: r.bottom, vh: innerHeight }
  })
  expect(b, 'no dialog opened for the round').toBeTruthy()
  expect(b.top, 'the round starts above the window').toBeGreaterThanOrEqual(0)
  expect(b.bottom, 'the round runs past the foot of the window').toBeLessThanOrEqual(b.vh)

  // Down to the round's own controls, and the way out is still there.
  await app.press('skip')
  await app.see('2 of')
  expect(await app.inReach('Close'), 'the ✕ went off the top with the card').toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
