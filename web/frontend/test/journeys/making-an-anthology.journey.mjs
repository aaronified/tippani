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
// IS after one press. A jsdom render of AnthologyForm proves the markup; it cannot
// tell you that the popup opens over the form, keeps the form's own answers, and
// hands them back. This presses the real door in a real browser and then saves,
// so the switch it set has to survive the popup, the form and the POST.
//
// THE MUTATION: delete the `press('From the book or film')` below and this fails
// on the line after it — 'Publisher' is nowhere on the screen until that door is
// opened, which is the whole point of the change.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens the new-anthology form and the switches are behind a door, not in front of them', async () => {
  await app.goto('/anthologies')
  await app.press('New anthology')

  // The two questions that are actually on the form.
  await app.see('Title')

  // AND THE TWENTY-THREE THAT ARE NOT. `Publisher` is one of the eleven a work
  // lends its passages; before this change it was the fifth switch of eighteen a
  // reader scrolled past to reach the button that saves. `gone` is the assertion
  // that matters here — a door that opens is worth nothing if what is behind it
  // was never shut.
  await app.gone('Publisher')

  // The door states what is on behind it rather than restating its own heading.
  await app.see('0 of 11 shown')

  await app.press('From the book or film')
  await app.see('Publisher')
})
