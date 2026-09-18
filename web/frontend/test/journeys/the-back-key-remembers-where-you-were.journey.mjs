// Hold the phone's Back key and it offers the screens behind you — and picking one
// really is going back, so the phone's own Back carries on from there.
//
// THE ASK: "phone bottom bar: the back button long press should give the user the
// list of last 5 pages (not as a sliding popup, but as a popup anchored over the
// back button). choosing one there will overwrite the device back history as well."
//
// THE HALF THAT IS EASY TO FAKE is the last clause, and it is the only half a
// screenshot cannot show. A menu that NAVIGATES to the chosen screen looks
// identical: the right screen arrives, the row was pressed, the feature appears to
// work. What it leaves behind is a stack four entries deep with the screens you
// skipped still in it, so the next press of the phone's Back takes the reader
// forwards into what they just stepped over. The distinguishing act is therefore
// not the arrival — it is the press AFTER the arrival, and that is what this
// journey ends on.
//
// WHAT THIS FILE KNOWS BEYOND THE SCREEN: the address the app is showing. That is
// the first thing the directory's rule allows a journey to know, and it is how the
// two candidate outcomes of the last press are told apart without naming a screen
// by some word that happens to be on it.
//
// THE MUTATIONS, both run. Make the row NAVIGATE rather than rewind — the shell's
// own `go(row.tab)` — and the first case's arrival is still right while its last
// press lands on Settings instead of Library, which is the whole point of ending on
// that press. Drop the `rows.length` guard and the second case's menu opens with
// nothing in it.
//
// A THIRD CASE WAS WRITTEN AND DELETED, recorded because it looked like the
// obvious one: holding the Back key on a top-level screen reached cold, where the
// key is drawn disabled. It passes with the hold itself removed — a disabled
// button raises no pointer events, so there was never anything for the gesture to
// fail at. That is this directory's definition of a test proving nothing. The
// second case below is what it was trying to be, and it works because a work
// opened cold has a LIVE Back key with an empty trail behind it.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// The phone's nav lives behind the drawer, so this is what walking to a screen
// costs a thumb — and it is worth spelling out that the drawer is itself an
// overlay with a history entry of its own. Those entries are exactly what makes
// the distance between two screens bigger than the number of screens.
async function walkTo(name) {
  await app.press('Menu')
  await app.press(name)
}

it('a reader holds Back, picks a screen from earlier, and their phone carries on from there', async () => {
  await app.goto('/')

  await walkTo('Library')
  await walkTo('Quotes')
  await walkTo('Metadata')
  await walkTo('Settings')

  // HELD, NOT PRESSED. A press here would simply go back one.
  await app.hold('Back')
  await app.see('Go back to')

  // The screens behind, by name, offered over the key that was held.
  await app.press('Quotes')
  expect(app.page.url()).toMatch(/\/quotes$/)

  // AND NOW THE CLAUSE THE WHOLE THING IS FOR. Quotes was reached by stepping over
  // Metadata and Settings, so what is behind Quotes is the shelf — not the screens
  // that were skipped. One press of the key, unheld.
  await app.press('Back')
  expect(app.page.url(), 'the phone\'s Back went back into a screen the reader had just stepped over').toMatch(/\/library$/)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('offers nothing where Back is live but nothing of ours is behind', async () => {
  // THE CASE THE GUARD IS FOR, and it is not the one above. A work opened cold
  // has a live Back key — there is nowhere of ours to return to, so it falls back
  // to the shelf the work is on, which is what "back" means from a link somebody
  // sent you. The key is enabled, the hold reaches it, and the list is still
  // empty: a menu of screens the app cannot return to would be a row that does
  // nothing.
  //
  // The work's address is learned the way a reader gets one — by opening it.
  await app.goto('/')
  await walkTo('Library')
  await app.press('The Idiot')
  const work = new URL(app.page.url()).pathname

  // LEAVE FIRST, AND THIS LINE IS LOAD-BEARING. Navigating to the address already
  // showing is a RELOAD, and a reload keeps `history.state` — serial and all — so
  // the arrival would not be cold and the trail would still be offered. Without
  // this the case fails, and it reads as a bug in the trail rather than as the
  // journey walking the wrong way in.
  await app.goto('/settings')
  await app.goto(work)
  await app.hold('Back')
  await app.gone('Go back to')

  // AND THE KEY IS STILL A KEY. Pressed rather than held, it does the fallback —
  // which is the proof that the silence above was the empty list and not a dead
  // control.
  await app.press('Back')
  expect(app.page.url()).toMatch(/\/library$/)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
