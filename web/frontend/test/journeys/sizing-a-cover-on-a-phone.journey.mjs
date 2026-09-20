// A reader on a phone opens Sections and sees a sample of their shelf at the size
// it is set to — as many covers as the column holds, not a row of them broken
// over two lines.
//
// WHY THIS EXISTS, AND WHY IT IS A JOURNEY AFTER ALL. The size sliders each draw a
// sample of the reader's own first works at the size the handle is on. The sample
// took `works.slice(0, 3)` — three, always, whatever the room — under a comment
// promising "as many as fit, never a scroll". The owner reported it from their own
// phone: "we have 3 posters for the poster size panel, when no mobile screen can
// hold three at the lowest size even."
//
// A PREVIOUS PASS CLAIMED THIS COULD NOT BE A JOURNEY, and that claim was wrong.
// The sample is `aria-hidden`, and the reasoning went: a journey reads the
// accessibility tree, so there is nothing there to assert. But `see` and `gone`
// poll `document.body.innerText` (harness/screen.mjs), and `aria-hidden` does not
// take text out of `innerText` — it hides it from assistive technology, not from
// the rendering. The sample prints each work's title, so the words are right there.
// The wrong claim had been written into the decision log as settled; it is
// corrected there now, and this file is the thing that should have existed.
//
// WHAT MAKES IT DISCRIMINATING, and the first draft of this file got it wrong in
// a way worth keeping. It asserted the SECOND book was absent on a phone, from a
// probe that had measured 165px cells at 390. That measurement was an artefact of
// the probe's own order: `useCoverSize` defaults to 100 on a narrow screen and 165
// otherwise, the probe ran the desk first, and the size it stored there came back
// on the phone pass. A reader arriving on a phone gets 100px cells, two of which
// fit. So the assertion is the THIRD book — three 100px cells need 328 and the
// column has 316 — and the number a phone actually shows is two, not one.
//
// THE MUTATION: put `works.slice(0, 3)` back and this fails — the second book
// arrives on a phone, which is the defect the owner reported.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp, PHONE } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// The two newest books on the shelf, which are the first two the sample draws.
const FIRST = 'Almanac Ember'
const SECOND = 'Marram Ke'
const THIRD = 'Reed Reed Reed'

it('a reader on a phone gets a sample that fits the column, not one that wraps', async () => {
  await app.goto('/settings')
  await app.press('Sections')

  // The sample is there at all: the reader can see what the size they have chosen
  // actually looks like, which is the whole reason the slider has one.
  await app.see(FIRST)

  await app.see(SECOND)

  // And it stops where the column does. A third cover needs room this phone has
  // not got, so it is not drawn — rather than drawn and wrapped onto a line of its
  // own, which is what made the sample's shape change as the reader dragged.
  await app.gone(THIRD)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
