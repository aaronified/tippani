// A reader with the largest type opens Profile on their phone and asks to reset
// everything, and the page stays where they put it.
//
// WHAT WENT WRONG (#46). At 390 wide with every size dial at 175%, the reset prompt's
// "Delete everything & restart" ran to about x=395, so the whole page slid 5px left
// and right under a thumb. The row it sits in wraps; the button's own words did not.
//
// THE MUTATION. Take the reset button's `whiteSpace: 'normal'` back out of Account.jsx
// and this goes red with the page's slide: 1px on the seeded fixture (the 3.1.1 screens
// pass measured 5px against another library). Delete the press on "Reset all data…" and
// it goes green against the broken build too, measured, since the button is not drawn
// until the prompt is open, which is why the press and the measurement are paired.
//
// SETUP USES THE API: the type dials are set through the preferences route, as a
// reader's own Settings would leave them, and put back to 100 afterwards because the
// fixture is shared. It knows that route and the four dial fields
// (`sizeDisplay`, `sizeUi`, `sizeMono`, `sizeHand`), and on screen only the words.

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
})
