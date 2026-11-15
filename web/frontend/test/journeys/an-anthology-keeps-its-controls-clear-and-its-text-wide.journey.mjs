// A reader looks over their anthologies, opens one, switches what each passage shows and reads it.
// Three things the owner reported ("misaligned buttons, text boxes without wells") and no picture of
// a phone or a desk shows by itself:
//   - on the LIST the ⋮ sat over the corner of the tile's cover;
//   - the READER's text was a narrow column in the middle of a wide window;
//   - the chips under an anthology ("Who said it", "Where it is from"…) did not look pressed when pressed.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - SETUP is the UI itself: "New anthology", "What goes in it", "A tag" and "Hope", the same
//     way an-anthology-of-a-tag makes one.
//   - `app.page` MEASURES, because the questions are geometry and paint, which no word of the vocabulary
//     reads: (1) whether the tile's menu button (found by `aria-haspopup`, beside the tile's face) overlaps
//     the tile's first picture or its banner; (2) how wide the reader's passage is on screen (the blockquote
//     inside the dialog) and whether the dialog slides sideways (its own scrollWidth against its
//     clientWidth, because `sideways` reads the document and the reader is a fixed overlay with a scroll
//     of its own); (3) how wide the open anthology's section is (the section holding the title heading);
//     (4) the width of a quote on that page and the height of its banner (the element carrying the
//     title as `data-title`, drawn where there is no poster); (5) the pressed chip's computed colour and background against its own unpressed state, on a desk in
//     the light and on a phone in the dark. `chosen` says the chip is pressed; nothing observable says it
//     LOOKS pressed except what the browser painted.
//
// THE MUTATIONS, each run red and put back:
//   - `.anthology-tile .board-tile-tools` back to the shared absolute corner: the menu overlaps the cover
//     (both widths, both themes);
//   - `.anthology-reader-page` max-width back to 56rem: the passage is 819px, over the 760 ceiling;
//     back to 38rem it is under the 560 floor;
//   - `.anthology-read` max-width back to 62ch: the open page is 521px against the 700 floor;
//   - `.anthology-reader-page` given a min-width of 700px: on the phone the dialog slides 310px;
//   - `.anthology-read blockquote` cap removed: a quote runs the whole 896px of the open page;
//   - `.anthology-poster-fallback` max-width removed: the banner is 504px tall;
//   - the chip's `active` class dropped from the className: pressed and unpressed paint the same.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const TITLE = 'Everything hopeful'

async function makeOne(app) {
  await app.goto('/anthologies')
  await app.press('New anthology')
  await app.type('Title', TITLE)
  await app.press('What goes in it')
  await app.press('A tag')
  await app.type('A tag', 'Hope')
  await app.press('Save')
  await app.press('Create')
  await app.goto('/anthologies')
  await app.see(TITLE)
}

// How far, in pixels, the menu button on this anthology's tile reaches into the tile's banner. 0 = clear.
const menuOverCover = (app) => app.page.evaluate((title) => {
  const face = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(title))
  const tile = face?.parentElement
  const menu = tile && [...tile.querySelectorAll('button')].find((b) => b !== face && b.getAttribute('aria-haspopup'))
  const cover = tile?.querySelector('img, [aria-hidden="true"]')
  if (!menu || !cover) return { error: 'tile, menu or cover not found' }
  const m = menu.getBoundingClientRect()
  const c = cover.getBoundingClientRect()
  const w = Math.min(m.right, c.right) - Math.max(m.left, c.left)
  const h = Math.min(m.bottom, c.bottom) - Math.max(m.top, c.top)
  return { overlap: w > 0 && h > 0 ? w * h : 0, menu: m.toJSON(), cover: c.toJSON() }
}, TITLE)

// A person toggles a chip and the whole chip is painted differently. The pointer is parked off the chip first:
// a hovered chip is painted too, and would pass for pressed.
async function chipLooksPressed(app) {
  const look = async () => {
    await app.page.mouse.move(0, 0)
    return app.page.evaluate(() => {
      const b = [...document.querySelectorAll('button[aria-pressed]')].find((x) => /who said it/i.test(x.textContent))
      const s = getComputedStyle(b)
      return `${s.color}|${s.backgroundColor}|${s.backgroundImage}`
    })
  }
  const before = await app.chosen('Who said it')
  const lookBefore = await look()
  await app.press('Who said it')
  await expect.poll(() => app.chosen('Who said it'), { message: 'pressing it flips it' }).toBe(!before)
  expect(await look(), 'pressed and unpressed paint the same').not.toBe(lookBefore)
  await app.press('Who said it')
  await expect.poll(() => app.chosen('Who said it')).toBe(before)
  expect(await look(), 'pressing again puts the look back').toBe(lookBefore)
}

// The reader is a fixed overlay with a scroll of its own, so the document's `sideways` cannot see it slide.
const readerSlides = (app) => app.page.evaluate(() => {
  const r = document.querySelector('[role="dialog"]')
  return r ? r.scrollWidth - r.clientWidth : -1
})

const desk = openApp()

it('on a desk the tile menu clears the cover, the reader uses the width and a pressed chip looks pressed', async () => {
  await makeOne(desk)
  const m = await menuOverCover(desk)
  expect(m.error, 'the tile').toBeUndefined()
  expect(m.overlap, `the ⋮ sits over the cover ${JSON.stringify(m)}`).toBe(0)

  await desk.press(TITLE)

  await chipLooksPressed(desk)

  // THE OPEN PAGE uses the width a desk has: the column holding the title is wider than the old 62ch strip.
  const pageWidth = await desk.page.evaluate((title) => {
    const h = [...document.querySelectorAll('h1,h2')].find((x) => x.textContent.includes(title))
    return h?.closest('section')?.getBoundingClientRect().width ?? 0
  }, TITLE)
  expect(pageWidth, 'the open anthology leaves half the window empty').toBeGreaterThan(700)
  const shape = await desk.page.evaluate((title) => {
    const h = [...document.querySelectorAll('h1,h2')].find((x) => x.textContent.includes(title))
    const sec = h?.closest('section')
    const q = sec?.querySelector('blockquote')
    // the running title for print carries the title too but draws nothing: the banner is the one with a height
    const banner = [...(sec?.querySelectorAll('[data-title]') ?? [])].find((e) => e.getBoundingClientRect().height > 0)
    return { line: q?.getBoundingClientRect().width ?? 0, banner: banner?.getBoundingClientRect().height ?? 0 }
  }, TITLE)
  expect(shape.line, 'a quote on the open page runs the whole width of it').toBeLessThan(700)
  expect(shape.line, 'there is no quote on the open page to measure').toBeGreaterThan(0)
  expect(shape.banner, 'there is no banner on the open page to measure').toBeGreaterThan(0)
  expect(shape.banner, 'the no-poster banner fills the first screen').toBeLessThan(420)

  // READER: the passage's column at 1280.
  await desk.press('Read')
  await desk.see('Lantern sedge compass against harbour')
  const width = await desk.page.evaluate(() => {
    const q = document.querySelector('[role="dialog"] blockquote')
    return q.getBoundingClientRect().width
  })
  expect(width, 'the reader is a strip, not a column').toBeGreaterThan(560)
  expect(width, 'the reader\'s line is longer than a comfortable one').toBeLessThan(760)
  expect(await readerSlides(desk), 'the reader slid sideways').toBe(0)
  expect(desk.pageErrors(), 'the page threw on the way').toEqual([])
})

const phone = openApp({ viewport: PHONE, theme: 'dark' })

it('on a phone, in the dark, the tile menu clears the cover and the reader still fits', async () => {
  await makeOne(phone)
  const m = await menuOverCover(phone)
  expect(m.error, 'the tile').toBeUndefined()
  expect(m.overlap, `the ⋮ sits over the cover ${JSON.stringify(m)}`).toBe(0)
  expect(await phone.sideways(), 'the list slid sideways').toBe(0)

  await phone.press(TITLE)
  await chipLooksPressed(phone)
  await phone.press('Read')
  await phone.see('Lantern sedge compass against harbour')
  expect(await readerSlides(phone), 'the reader slid sideways').toBe(0)
  expect(phone.pageErrors(), 'the page threw on the way').toEqual([])
})
