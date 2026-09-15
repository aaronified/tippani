// A reader starts an anthology, and the form asks them two questions instead of
// twenty-five.
//
// WHAT WENT WRONG BEFORE. The new-anthology form drew Title, an introduction, and
// then twenty-three switches in three headed groups — everything a passage can
// show, everything its book can lend it, everything known about the person behind
// it. All of it is real and none of it is what you answer when you are making the
// thing: the owner's report is that "the anthology addition settings is too long".
// So the three groups are behind a door each, and the door says how many are on.
//
// WHY A JOURNEY AND NOT A RENDER TEST. The claim is about what a person meets on
// the screen — that Publisher is NOT in front of them when they open the form, and
// IS after one press — and then about what survives. A jsdom render proves the
// markup; it cannot tell you that confirming the popup leaves the form standing
// with the title still typed in it. It could not, in fact: the first version of
// this change closed the WHOLE FORM when a group's ✓ was pressed, discarding the
// title, and every jsdom test passed through it. FormModal takes a history marker
// per overlay and hands it back on close; the pop that came back was answered by
// the form underneath, because the popup had already taken itself off the stack.
// jsdom delivers that pop on a different turn, so only a real browser could see
// it. Hence the middle of this journey: press ✓, and the form must still be there.
//
// THE MUTATIONS: delete the `press('From the book or film')` and it fails on
// 'Publisher', which is nowhere until that door is opened. Delete the `press('Save')`
// and it fails on '11 of 11 shown', because the draft is discarded rather than
// committed. Revert the back-stack fix in `useBackToClose` and it fails on 'Title'
// right after the ✓, because the form has gone.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader sets one switch behind a door and the form is still there with it set', async () => {
  await app.goto('/anthologies')
  await app.press('New anthology')

  // The two questions that are actually on the form.
  await app.see('Title')
  await app.type('Title', 'Publishers and their sins')

  // AND THE TWENTY-THREE THAT ARE NOT. `Publisher` is one of the eleven a work
  // lends its passages; before this change it was one of eighteen switches a
  // reader scrolled past to reach the button that saves. `gone` is the assertion
  // that matters here — a door that opens is worth nothing if what is behind it
  // was never shut.
  await app.gone('Publisher')

  // The door states what is on behind it rather than restating its own heading.
  await app.see('0 of 11 shown')

  await app.press('From the book or film')
  await app.see('Publisher')
  // ALL ELEVEN, because `press` refuses an ambiguous name and every row in this
  // group draws the same Hide/Show pair — there is no way for a reader's
  // vocabulary to say "the Show belonging to Publisher", and inventing one would
  // mean this file knowing something about the markup. Turning the group on wholesale
  // is a thing a person does anyway, and it makes the count below exact.
  const shown = await app.pressAll('Show')
  expect(shown, 'the work group should carry eleven switches').toBe(11)

  // THE ✓ ON THE POPUP, and then the form has to still be standing. This is the
  // half that was broken and that nothing below the browser could see.
  await app.press('Save')
  await app.see('Title')
  await app.see('11 of 11 shown')

  // And what the popup set reaches the server, not just the screen.
  await app.press('Create')
  await app.see('Publishers and their sins')
  // Re-opened from the tile's own ⋯ on the list, which is where editing lives.
  // Only one anthology exists, so "More actions" names one control.
  await app.press('More actions')
  await app.press('Edit')
  await app.see('11 of 11 shown')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
