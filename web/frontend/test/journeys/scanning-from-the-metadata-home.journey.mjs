// A reader presses "Scan for duplicate works" on the phone's Metadata home, and
// the scan has already run by the time the Works console draws.
//
// WHY THIS EXISTS. The Metadata index was eight doors and nothing else, while the
// owner's standing rule says to use the space and put what is used most in front.
// Each door now carries its section's headline verb. Two of those verbs cannot
// finish on the index — a duplicate scan renders a list of groups to merge, a
// people fetch renders a progress bar over filtered rows — so pressing one walks
// into the section AND starts the act there, where the answer already has
// somewhere to appear.
//
// WHAT NO OTHER TIER CAN SEE, and it is the whole reason this is a journey.
//
// THE PRESS AND THE RESULT ARE IN DIFFERENT COMPONENTS, on different screens, with
// a render and a route between them. A dom test can assert that the index button
// sets a piece of state, and another can assert that the panel scans when handed
// that state, and both can pass while the two never meet — which is exactly the
// pair of green tests that let a feature ship 100% dead once already in this repo.
// Only walking through it asks whether the press reaches the scan.
//
// AND THE WIDTH. The verbs exist only under the phone breakpoint; every other tier
// runs at desktop width, where the index is not drawn at all.
//
// THE SECOND ASSERTION IS THE ONE THAT COST THOUGHT: WALKING BACK IN MUST NOT
// RESCAN. An intent held rather than consumed re-fires on every arrival, which is
// a control the reader cannot un-press — so this leaves the section, comes back
// through the plain door, and asks that the scan's answer is NOT on the screen.
//
// THE MUTATION, verified both ways: drop `arriveScanning` from what the page hands
// the panel and the first assertion goes red — the reader lands in Works with the
// scan never run, which is the extra press the verb exists to remove. Stop clearing
// the intent in `onArrived` and the second goes red, because the plain door scans
// too.
//
// THE SECOND ONE DID NOT FIRE ON THE FIRST TRY, and the reason is written into the
// step below rather than quietly fixed: the walk back out was a `goto`, which
// reloads the app and clears the intent by itself. The mutation was survivable and
// the assertion meant nothing. It walks back with the dock's Back key now.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// What a finished scan says. A library with no duplicates answers "no duplicate
// works found"; one with some answers with a count of groups. Either is a scan
// that ran; neither is on screen before one has.
//
// `onScreen()` IS THE WHOLE SCREEN AS TEXT — it takes no argument, so the pattern
// is tested against what it returns. A first cut passed the regex in and got a
// truthy string back every time, which would have made both assertions pass over
// a screen saying nothing of the kind.
const SCANNED = /no duplicate works found|\d+ groups?/i

it('a reader scans for duplicate works from the metadata home, in one press', async () => {
  await app.goto('/metadata')

  // The doors are all still there — the verb is a shortcut, not a replacement.
  await app.see('Works')
  await app.see('People')
  await app.see('Sources')

  // AND NOTHING HAS SCANNED YET. The index draws the verb, not its answer.
  expect(SCANNED.test(await app.onScreen()), 'the index is showing a scan nobody asked for').toBe(false)

  await app.press('Scan for duplicate works')

  // WE ARE IN WORKS AND THE SCAN HAS RUN. Both halves matter: the section's own
  // catalogue proves the door opened, and the scan's answer proves the press
  // carried through rather than merely navigating.
  await app.see('Duplicate works')
  await expect
    .poll(async () => SCANNED.test(await app.onScreen()), { timeout: 15000 })
    .toBe(true)

  // NOW THE PLAIN DOOR, AND IT MUST NOT SCAN. Out to the index and back in by
  // pressing the section's own name — an ordinary arrival, which is not a press of
  // the verb.
  //
  // BY THE DOCK'S BACK KEY AND NOT BY goto(), AND THE DIFFERENCE IS THE WHOLE
  // ASSERTION. A first cut walked out with `goto('/metadata')`, which is a real
  // navigation: the SPA reloads, the page's state goes with it, and the intent is
  // cleared by the reload whatever the code does about it. That version passed
  // with the clearing deleted — it was asserting that a page reload resets state,
  // which is true of every page ever written. Back keeps the app mounted, so the
  // intent is still there to be wrongly re-used.
  await app.press('Back')
  await app.see('Sources')
  await app.press('Works')
  await app.see('Duplicate works')
  expect(
    SCANNED.test(await app.onScreen()),
    'walking in through the plain door re-ran the scan — the intent was held rather than consumed',
  ).toBe(false)
})
