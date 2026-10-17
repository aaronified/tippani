// A reader on a desk runs a round, and the popup is the same size on every card, with
// Next, the verdict and "fix or tag this" held at its foot once an answer is in.
//
// THE OWNER, 17 October: "the screen should be of fixed size for the length of the
// quiz", and "on desktop, the quiz bottom is always edgemasked without scroll". The
// popup had a ceiling and no height, so it was 342px on one question and 448px on
// the next and the controls moved under the reader's eyes; and the question's body
// wore its bottom fade over content that fitted, because the card rises 6px as it
// enters, the scroller measured it mid-rise, and nothing resized when it landed.
//
// DECLARED EXCEPTION: `app.page.evaluate` measures boxes, as the two other round
// journeys do and for the reason a-round-takes-the-phone-screen gives: no word in the
// vocabulary measures a surface. It knows `role="dialog"`, and nothing of the app's
// classes. The harness holds animations still (assertNoMotion), so the mid-rise
// measurement is held by edge-scroll-animation.test.jsx.
//
// A FLIP CARD IS ANSWERED, because it is the one kind a journey can answer without
// knowing the card's words ("Show me", "Got it"); the deck deals a random kind per
// card, so the round skips to one, reading the screen as a-quiz-answer-that-cannot-be-
// sent-is-kept does.
//
// THE MUTATIONS, each made and run and put back: the card's height given back as a
// ceiling (`.tp-screen-card`'s `height` as `max-height`) reddens the equal heights; the
// foot moved back inside the scrolling region reddens "Next in reach" on this short
// window, where a long card pushes it off the bottom.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ viewport: { width: 1280, height: 640 } })

const dialogBox = () => app.page.evaluate(() => {
  const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
  return r && { height: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight }
})

async function skipToAFlipCard() {
  for (let tries = 0; tries < 40; tries++) {
    if ((await app.onScreen()).toLowerCase().includes('show me')) return
    await app.press('skip')
  }
  throw new Error('Practice never dealt a card meant to be recalled in 40 draws')
}

it('the popup is one size from the first card to the last, and Next is always at its foot', async () => {
  await app.goto('/')
  await app.press('Start practice')
  await app.see('skip')

  const sizes = [await dialogBox()]
  for (let card = 0; card < 3; card++) {
    await skipToAFlipCard()
    sizes.push(await dialogBox())
    await app.press('Show me')
    await app.press('Got it')
    await app.see('Next')
    sizes.push(await dialogBox())
    expect(await app.inReach('Next'), `Next is out of reach on card ${card + 1}`).toBe(true)
    await app.press('Next')
  }

  expect(new Set(sizes.map((s) => s.height)).size, `the popup changed size: ${sizes.map((s) => s.height)}`).toBe(1)
  expect(sizes[0].bottom, 'the popup runs past the window').toBeLessThanOrEqual(sizes[0].vh)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
