// A reader with the largest type opens Profile on their phone and asks to reset
// everything, and the page stays where they put it.
//
// WHAT WENT WRONG (#46). At 390 wide with every size dial at 175%, the reset prompt's
// "Delete everything & restart" ran to about x=395, so the whole page slid 5px left
// and right under a thumb. The row it sits in wraps; the button's own words did not.
//
// THE MUTATIONS, measured on the seeded fixture. Take BOTH of the reset button's
// `whiteSpace: 'normal'` and `maxWidth: '100%'` out of Account.jsx and this goes red
// on the page's slide, 1px (the 3.1.1 screens pass measured 5px against another
// library). Take out either one alone and it stays green: the overage here is smaller
// than the button's side padding, so a capped button still holds its words, and a
// wrapping one shrinks with its row. Delete the press on "Reset all data…" and it goes
// red on `see`, because the button is not drawn until the prompt is open.
//
// ONE ESCAPE HATCH. The vocabulary has no word for a label clipped inside its own
// button, so `app.page` finds the button by its words and compares its laid-out
// width with its shown width.
//
// SETUP USES THE API: the type dials are set through the preferences route, as a
// reader's own Settings would leave them, and put back to 100 afterwards so the
// file's later tests start at the default. It knows that route and the four dial
// fields (`sizeDisplay`, `sizeUi`, `sizeMono`, `sizeHand`), and on screen only the
// words.

import { afterAll, expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

const dials = (n) => ({ sizeDisplay: n, sizeUi: n, sizeMono: n, sizeHand: n })

afterAll(async () => {
  await app.setup('PUT', '/auth/me/preferences', dials(100))
})

it('at the largest type, the reset prompt on Profile does not slide the page sideways', async () => {
  await app.setup('PUT', '/auth/me/preferences', dials(175))
  await app.goto('/profile')
  await app.press('Reset all data…')
  await app.see('Delete everything & restart')
  expect(await app.sideways()).toBe(0)
  // The button's own words fit inside it.
  const overflow = await app.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find((el) => el.textContent.trim() === 'Delete everything & restart')
    return b ? b.scrollWidth - b.clientWidth : null
  })
  expect(overflow).toBe(0)
})
