// A reader on a phone answers a card, and Next, the verdict and "fix or tag this" stay
// in view at the foot of the screen, with the question above them the only thing that
// scrolls.
//
// THE OWNER, 17 October: "on mobile, the next, fix and result should always be in
// view, locked at the bottom after the option is chosen (the options can still be
// scrolled)". They were part of the one long scrolling body, so a long card carried
// them off the bottom and the reader scrolled to find the button that moves on.
//
// ITS OWN FILE, because the world is one server per file and a-round-takes-the-phone-
// screen leaves a round in progress ("Continue practice") that this one must start
// fresh. DECLARED EXCEPTION: `app.page.evaluate` measures where Next sits against the
// window, for the reason that journey gives; it knows `role="dialog"` and the word on
// the button.
//
// THE MUTATION, made and run and put back: the foot moved back inside the scrolling
// region leaves Next wherever the card ends, and reddens "at the foot of the screen".

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('once an answer is in, Next sits at the foot of the screen, in reach of the thumb', async () => {
  await app.goto('/')
  await app.press('Start practice')
  await app.see('skip')
  for (let tries = 0; tries < 40; tries++) {
    if ((await app.onScreen()).toLowerCase().includes('show me')) break
    await app.press('skip')
  }
  await app.press('Show me')
  await app.press('Got it')
  await app.see('Next')

  expect(await app.inReach('Next'), 'Next is not within reach of the thumb').toBe(true)
  const foot = await app.page.evaluate(() => {
    const next = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^next/i.test(b.textContent.trim()))
    const r = next?.getBoundingClientRect()
    return r && { bottom: Math.round(r.bottom), vh: innerHeight }
  })
  expect(foot, 'no Next button on the screen').toBeTruthy()
  expect(foot.bottom, 'Next is not at the foot of the screen').toBeGreaterThan(foot.vh - 120)
  expect(foot.bottom, 'Next runs past the screen').toBeLessThanOrEqual(foot.vh)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
