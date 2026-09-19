// A reader goes to Settings to change something, and the thing they want is not
// the first thing on the screen.
//
// WHAT THIS GUARDS. Settings was one scrolling grid with every card on it, and it
// is now five named sections behind a rail. That is the whole change, and no unit
// tier can see it: the dom suites mount the screen and press a tab, which proves
// the tab calls the handler — not that a real reader, on a real server, can get
// from the screen opening to a control that is genuinely on another section.
//
// THE MUTATION. Delete `press('Server')` and it goes red: Settings opens on
// Theme, and nothing about backups is on that section. That is a real mutation
// rather than a decorative one, because the two words either side of the press —
// the screen's own name and the control's — are both real and neither is enough
// on its own.
//
// AND IT PRESSES TWO SECTIONS, NOT ONE, because a rail that can only reach the
// section it starts nearest is a rail that half works. Going to Server and then
// to Review is the shape of a reader actually using the thing.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no preference key.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens Settings and reaches a control on another section', async () => {
  await app.goto('/')

  await app.press('Settings')

  // NOT an assertion on the word "Settings" — the rail item just pressed carries
  // it, so it was on screen before the press. The theme control is what only
  // arriving here shows, and it is on the section this screen opens to.
  await app.see('Material')

  // The archive lives on Server, which is somewhere else entirely.
  await app.press('Server')
  await app.see('Back up now')
  // And the theme control is gone, because a section replaces a section rather
  // than adding to a scroll — which is the difference between this and the page
  // it replaced.
  await app.gone('Material')

  // A second hop, to prove the rail is a rail rather than one door.
  await app.press('Review')
  // "How hard the questions are" rather than the door that used to be here. The
  // door was called "In-depth controls" and held everything this section could be
  // told — because Settings was one long scroll and every extra row was something
  // to scroll past. Review is its own screen now, so what a reader comes here to
  // change is ON it; the door keeps the schedule's arithmetic and nothing else.
  await app.see('How hard the questions are')
  await app.gone('Back up now')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
