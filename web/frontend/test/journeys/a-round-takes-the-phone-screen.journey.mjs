// A reader on a phone starts Practice from Home and the round takes the whole
// screen. The phone's Back returns them to Home, where the round waits behind
// "Continue practice", and pressing it picks up at the card they had reached.
//
// THE OWNER, 9 October: "the review / quiz should happen in a popup (a dedicated
// screen in phone) so that the user doesnt need to scroll up and down too much."
// The round was drawn inside Home's card, so on a phone a reader scrolled between
// the question, the options and the Next button with Home's other cards above and
// below them. The phone's sheets are no answer either: they stop short of the top
// and drag.
//
// WHY A JOURNEY. Whether a surface covers the glass is layout, and only a browser
// lays out; the phone's Back is the browser's. What the Daily card does when a
// round is closed part-way is daily-quiz-in-its-own-screen.test.jsx.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - `app.page.evaluate` measures the round's box against the window. No word in
//     the vocabulary measures a surface (inReach measures a control's centre), and
//     "fills the screen" is a claim about geometry. It knows `role="dialog"`,
//     ARIA's own word, which the harness's modal scoping already relies on, and
//     nothing of the app's classes.
//   - `app.page.goBack` is the phone's Back, the chrome around the page, as
//     tags-moved-in-with-metadata.journey.mjs says.
//
// THE MUTATIONS, each made and run and put back:
//   - the round drawn as the phone's sheet (Home's Practice FormModal without
//     `screen`): red at the measurement, the box stopping short of the top;
//   - the screen not taking the phone's Back (FormModal's useBackToClose given
//     `open && !sheet && !page`): red, "Continue practice" never appears;
//   - the round reopened at its first card (`startIndex={0}`): red, "1 of" where
//     "2 of" was.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// The open dialog's box and the window's, in CSS pixels.
const boxes = () => app.page.evaluate(() => {
  const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
  return r && { top: r.top, left: r.left, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight }
})

it('a round on a phone fills the screen, and Back returns to Home with the round waiting', async () => {
  await app.goto('/')
  await app.press('Start practice')
  await app.see('skip')

  const b = await boxes()
  expect(b, 'no dialog opened for the round').toBeTruthy()
  expect([b.top, b.left], 'the round does not start at the top corner').toEqual([0, 0])
  expect([Math.round(b.width), Math.round(b.height)], 'the round does not cover the screen').toEqual([b.vw, b.vh])

  // To the second card, so where it reopens says something.
  await app.press('skip')
  await app.see('2 of')

  await app.page.goBack()
  await app.see('Continue practice')
  await app.gone('skip')

  await app.press('Continue practice')
  await app.see('2 of')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
