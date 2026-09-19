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
  await app.gone('Recall multiplier')

  // Leave the world as it was found: this is a shared fixture.
  await app.press('Not seen')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
