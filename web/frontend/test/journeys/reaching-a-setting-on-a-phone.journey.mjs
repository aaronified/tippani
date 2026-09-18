// A reader opens Settings on a phone, sees every section listed on the screen,
// presses one, and gets back.
//
// WHY THIS EXISTS, AND IT IS NOT "THE RAIL RENDERS". Settings on a phone showed a
// DROPDOWN: one word, and every other section behind a press that opened a menu.
// The owner's objection is the whole case for this file — "why should i suffer a
// dropdown when you were told to build a list of options in the screen as
// shortcuts?" A list of shortcuts IS the navigation; a field is a control you have
// to operate before navigation begins. So what is asserted here is not that a
// control exists but that the sections are ON THE SCREEN, readable without
// pressing anything, which is the difference between the two designs and the only
// thing a capture of either would show.
//
// WHAT NO OTHER TIER CAN SEE. The dom tier mounts Settings and presses whatever
// the helper knows how to press — it passed, unchanged, against BOTH designs,
// because a helper that opens a dropdown and a helper that presses a row both end
// up in the same section. It cannot tell you what a reader sees before they press.
// The width is the other half: the index only exists under the phone breakpoint,
// and the desktop tiers never go there.
//
// THE MUTATION. Delete the `see` on the second section name before anything is
// pressed and it goes green against the dropdown design too — which is exactly why
// that assertion is the first one and not an afterthought. Delete the `press` on
// 'Review' and the drill-down assertion goes red.
//
// It knows the words on the screen and nothing else — no route, no component, no
// preference key, no class.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a reader on a phone sees every settings section at once, opens one, and comes back', async () => {
  await app.goto('/settings')

  // THE POINT OF THE INDEX. Two sections a reader never pressed anything to
  // reveal. Under a dropdown only the current one is on screen, so this is the
  // assertion the old design cannot pass.
  await app.see('Theme')
  await app.see('Review')
  await app.see('Server')

  await app.press('Review')

  // Inside the section: its own name as the heading, and something only that
  // section draws — so this cannot pass by the index still being on screen.
  await app.see('Review')
  await app.gone('Server')

  // AND A WAY BACK, which is the half a drill-down gets wrong. Back to the index
  // means the sections a reader did not choose are visible again.
  await app.press('Back to')
  await app.see('Server')
  await app.see('Theme')
})
