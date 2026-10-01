// A reader with a shelf of a hundred and more films opens Home on a phone, and the
// screen tile's counts all sit on the line of its total, so the tile keeps its
// size.
//
// THE OWNER'S ASK: "the total section in the homepage lists games and shows as
// films as well. That card show all three (without changing the card size)." The
// first build put each kind's count beside the total and let the row wrap; a
// rating measured that it fitted the owner's fourteen titles with 29px to spare
// and wrapped for any shelf with three-digit films, growing both tiles by a line.
//
// WHAT IS MEASURED. Not the two tiles' heights: they share a grid row and
// stretch to the taller one, so they are always equal and say nothing. What grew
// them was the kinds wrapping onto a line of their own, so that is what this
// reads: every figure in the screen tile before its caption, laid out where the
// reader sees it, must sit on the line of the total.
//
// DECLARED EXCEPTION: that measurement is made in the page, over the tile found
// by its accessible name (it ends "dialogues"), with a Range per number, because
// "on one line" has no word on the screen to read.
//
// SETUP KNOWS POST /movies and its fields `title` and `media_type`: a hundred and
// ten films, so the films count has three digits.
//
// THE MUTATION, built and run and put back: the kinds' row allowed to wrap
// (index.css's .home-tile-figures given `flex-wrap: wrap`) is red, a count under
// the total.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it("a hundred and more films keep the screen tile's counts on its total's line on a phone", async () => {
  for (let i = 1; i <= 110; i++) await app.setup('POST', '/movies', { title: `Reel ${i}`, media_type: 'movie' })

  await app.goto('/')
  await app.see('dialogues')
  // The total and its kinds are on the screen: the films count has three digits.
  expect(await app.onScreen()).toMatch(/\b1\d\d\b/)

  const lines = await app.page.evaluate(() => {
    const tile = [...document.querySelectorAll('[role="button"]')].find((b) => /dialogues\s*$/i.test(b.textContent.trim()))
    if (!tile) return null
    const figures = []
    const walk = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (const m of n.data.matchAll(/\d+/g)) {
        const r = document.createRange()
        r.setStart(n, m.index)
        r.setEnd(n, m.index + m[0].length)
        const box = r.getBoundingClientRect()
        figures.push({ n: m[0], top: box.top, bottom: box.bottom })
      }
    }
    // The last figure is the caption's dialogue count; the first is the total.
    const [total, ...kinds] = figures.slice(0, -1)
    return { total, kinds }
  })
  expect(lines, 'the screen tile was not found').not.toBeNull()
  expect(lines.kinds.length, 'no counts beside the total').toBeGreaterThan(1)
  for (const k of lines.kinds) {
    expect(k.top < lines.total.bottom && k.bottom > lines.total.top, `${k.n} is not on the total's line`).toBe(true)
  }
  expect(await app.sideways(), 'Home slides sideways on a phone').toBe(0)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
