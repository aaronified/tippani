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
// WHAT IT ASSERTS, AND WHY IT IS THE SLIDER RATHER THAN A COUNT AT REST. Two
// earlier cuts of this file keyed on how many covers stand there when the screen
// opens, and both were overtaken by a layout change: the phone's specimen column
// was 316px when subsections shared one card and is 328px now that each is a card
// of its own, which is the difference between two covers fitting and three. A
// test whose subject is "how many fit" has to be rewritten every time a padding
// moves, and rewriting it each time teaches nobody anything.
//
// The behaviour worth pinning is the one the owner reported: the sample is
// supposed to answer the slider. So this drags the slider to each end and asserts
// the sample changes — the covers are drawn at the size you chose, so at the
// largest only the first work fits a phone's column and at the smallest they all
// do. That is true whatever the column measures.
//
// THE MUTATION: put `works.slice(0, 3)` back — a fixed count, ignoring the room —
// and the assertion at the large end fails, because the second work is drawn on a
// phone that cannot hold it.
//
// THE ESCAPE HATCH IS USED ONCE, AND THIS IS THE DEBT IT COSTS. `app.page` sets
// the range, because dragging a slider is not in the harness's vocabulary and a
// press on a range lands wherever the pointer does. Everything asserted after it
// is read off the screen in the ordinary way.

import { expect, it } from 'vitest'

import { openApp, PHONE } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// The two newest books on the shelf, which are the first two the sample draws.
const FIRST = 'Almanac Ember'
const SECOND = 'Marram Ke'

// Drive the cover slider — the first range on the screen — to one end.
const dragCoverSlider = (to) =>
  app.page.evaluate((v) => {
    const r = document.querySelector('input[type=range]')
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(r), 'value').set
    set.call(r, String(v))
    r.dispatchEvent(new Event('input', { bubbles: true }))
    r.dispatchEvent(new Event('change', { bubbles: true }))
  }, to)

it('a reader on a phone gets a sample that fits the column, not one that wraps', async () => {
  await app.goto('/settings')
  await app.press('Sections')

  // The sample is there at all: the reader can see what the size they have chosen
  // actually looks like, which is the whole reason the slider has one.
  await app.see(FIRST)

  // AT THE LARGEST, one cover is all a phone's column holds — so the second is not
  // drawn, rather than drawn and wrapped onto a line of its own, which is what
  // made the sample's shape change as the reader dragged.
  await dragCoverSlider(240)
  await app.gone(SECOND)

  // AND AT THE SMALLEST THEY COME BACK, which is the other half: the count follows
  // the room rather than being spent once.
  await dragCoverSlider(95)
  await app.see(SECOND)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
