// A reader changes how the schedule treats a line they have never been asked
// about — on the Review screen, without opening anything.
//
// WHY THIS EXISTS. Every schedule control lived behind a button called "Schedule
// maths…", on the reasoning that the schedule is one decision a reader makes once
// and then lives inside. That is true of the ten multipliers and false of the
// four switches in front of them: "start new lines at mastered" is a decision
// about a library you have already read, and the pack puts it on the section with
// only the numbers behind a door. Nothing failed while it was hidden — the panel
// had its own tests and they passed — because no test asked what a reader
// standing on Review could reach.
//
// THE RELOAD IS THE POINT. Before it, "the control says Mastered" is also true of
// a screen that only ever set its own state.
//
// THE MUTATION: delete the `json('PUT', …)` from SRSettings' `set` and the reload
// fails — the control comes back on Not seen.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader sets where a new line starts, with nothing opened first', async () => {
  await app.goto('/settings')
  await app.press('Review')

  // On the section, not behind the door: the row is readable before anything is
  // pressed, which is the whole of what changed here.
  await app.see('New lines start at')
  expect(await app.chosen('Not seen')).toBe(true)

  await app.press('Mastered')
  expect(await app.chosen('Mastered')).toBe(true)
  expect(await app.chosen('Not seen')).toBe(false)

  // Not the state the press left behind — a fresh navigation, asking the server
  // what it actually kept.
  await app.goto('/settings')
  await app.press('Review')
  expect(await app.chosen('Mastered'), 'the choice was not kept').toBe(true)

  // AND THE TEN NUMBERS ARE STILL BEHIND THEIR DOOR, which is the other half of
  // the split: what a reader comes back for is on the screen, what they set once
  // is not.
  //
  // THE LABEL IS ONE THE APP ACTUALLY HAS. This read `gone('Recall multiplier')`,
  // a string that appears in no locale file, no source file and no prototype — so
  // it could not fail, and a rating caught it being sold as coverage. "Correct
  // answer stretches by" is the first of the ten.
  await app.gone('Correct answer stretches by')

  // Leave the world as it was found: this is a shared fixture.
  await app.press('Not seen')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND THE TWO REPERTOIRES ARE TWO SETTINGS, NOT ONE WRITTEN TWICE.
//
// WHAT THIS GUARDS, AND IT IS A DEFECT THIS SESSION SHIPPED. The daily deck's
// questions and practice's are drawn by two instances of one component, in two
// columns. That component used to hold the whole map — BOTH decks — in state
// initialised once and never re-derived, and each instance wrote the whole blob.
// So a reader who turned one daily question off and then touched a practice chip
// had their first change silently restored by the second press, while the chip on
// screen went on claiming it had been made. One deck's worth of presses could
// never see it; this presses one in each.
//
// THE MUTATION: put `useState` back around the question map in QuestionKinds and
// this fails on the daily assertion after the reload.
it('turns a question off in each deck, and both are still off after a reload', async () => {
  await app.goto('/settings')
  await app.press('Review')

  // EACH CHIP NAMES ITS DECK, because the same six questions are offered to both
  // and "Who wrote this?" alone would be two controls with one name — which the
  // harness refuses to guess between, and which a screen reader could not tell
  // apart either.
  await app.press('Who wrote this? — Daily quiz')
  expect(await app.chosen('Who wrote this? — Daily quiz'), 'the daily question did not go off').toBe(false)

  await app.press('Who wrote this? — Practice')
  expect(await app.chosen('Who wrote this? — Practice')).toBe(false)

  await app.goto('/settings')
  await app.press('Review')
  expect(await app.chosen('Who wrote this? — Daily quiz'), 'the daily change was undone by the practice press').toBe(false)
  expect(await app.chosen('Who wrote this? — Practice'), 'the practice change was not kept').toBe(false)

  // Leave the world as it was found.
  await app.press('Who wrote this? — Daily quiz')
  await app.press('Who wrote this? — Practice')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND "RESET SECTION" PUTS THE SECTION BACK — on the server, not just on screen.
//
// WHAT THIS GUARDS. `resetSection` cleared the keys into App's local `setUser`
// and stopped there: no PUT. So the press emptied the screen, the reader saw
// every row return to its default, and the next load brought all of it back.
// A control whose whole promise is "put this back" that puts nothing back is
// worse than an absent one, because the reader believes the work is done and
// stops looking. It was pre-existing, and it became load-bearing the moment the
// in-depth panel's own broad reset was narrowed to the ten numbers on the
// reasoning that "the section has its own Reset" — which was true of the button
// and not of the write behind it.
//
// THE MUTATION: delete the `json('PUT', …)` from `resetSection` and this fails on
// the assertion after the reload — How hard comes back on Hard.
it('resets the section, and the defaults are still there after a reload', async () => {
  await app.goto('/settings')
  await app.press('Review')

  // Move something off its default, and confirm it moved. Reset has nothing to
  // do on an untouched section — the control is not even drawn — so the change
  // is what brings the button into existence.
  await app.press('Hard')
  expect(await app.chosen('Hard'), 'the difficulty did not change').toBe(true)

  await app.press('Reset section')
  await app.press('Reset it')

  // On screen first, which is the half that always worked.
  expect(await app.chosen('Hard'), 'the reset did not clear the screen').toBe(false)

  // Then what the server kept, which is the half that did not.
  await app.goto('/settings')
  await app.press('Review')
  expect(await app.chosen('Hard'), 'the reset was never written, so the old value came back').toBe(false)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
