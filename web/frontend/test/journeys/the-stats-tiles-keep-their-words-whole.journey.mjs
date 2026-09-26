// A reader opens Stats on a desk and on a phone, and every word on it is printed
// whole.
//
// WHAT WENT WRONG, AND WHY NOTHING SAW IT. At 1280 the overview's tiles came out
// 126px wide, 92px inside their padding, and ANNOTATIONS in letter-spaced mono is
// 94px. A card lets a word break when it does not fit, so the tile printed
// "ANNOTATION" over a lone "S" (de692fb0). Every word was still in the page's text,
// so a journey asking to see "Annotations" passed. Only where the word's pieces are
// drawn shows the break, which is why `splitWords` is a list of words the screen
// cut, like `sideways` is a number.
//
// THE MUTATION. Put the overview's grid back to `minmax(118px, 1fr)` in
// StatsPage.jsx, `make frontend`, and the desk case goes red with the word it cut:
// "Annotations". The phone case was never broken (its tiles are wider there), and
// it stays so that a fix which only moves the break to the phone is caught too.
//
// AT THE DEFAULT TYPE SIZE ONLY. At 175% Stats still breaks section heads and chart
// figures outside the tiles, recorded in docs/plans/follow-ups.md. When that is
// fixed, this journey is where the larger size belongs.
//
// It knows the address it opens and the words it must not cut, and nothing else.

import { describe, expect, it } from 'vitest'

import { DESKTOP, PHONE, openApp } from './harness/world.mjs'

for (const [where, viewport] of [['a desk', DESKTOP], ['a phone', PHONE]]) {
  describe(`Stats on ${where}`, () => {
    const app = openApp({ viewport })

    it('cuts no word across two lines', async () => {
      await app.goto('/stats')
      // The overview has drawn: its word for the book highlights is on screen.
      await app.see('Annotations')
      expect(await app.splitWords()).toEqual([])
    })
  })
}
