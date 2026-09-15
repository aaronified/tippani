// A reader searches for something, likes what comes back, and keeps it — naming
// an anthology that does not exist yet, from the box that offers the ones that do.
//
// TWO REPORTS, ONE JOURNEY, because they are one act from the reader's side.
// Filling an anthology from a search has existed since 0075 and could be reached
// from exactly one place: an anthology you had already made, through its ⋯. So the
// answer to "keep everything about this" was to leave the results, go to
// Anthologies, make an empty one, open it, find the menu, and retype the search.
// The owner's words: it "cannot be accessed from the anthology add menu and also
// not visible in the search menu (both routes should be there)". This is the
// search route; `making-an-anthology` covers the form's own door.
//
// AND THE PICKER HAD TO CHANGE FOR IT TO BE WORTH ANYTHING. A `Select` over
// existing anthologies would have sent a reader with none straight back out again,
// which is the dead end the old dialog actually drew. The name typed below belongs
// to no anthology, so this passes only if the combobox's create path works.
//
// THE MUTATION: delete the `press('Gather into an anthology')` and this fails on
// the combobox that never opens. Delete the `type(...)` of the new name instead
// and it fails at the end, on an anthology that was never made.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader gathers a search into an anthology they name on the spot', async () => {
  await app.goto('/')

  // A word the fixture's own generator puts in a good many quotes, so the search
  // finds several and the gather has something to take.
  await app.type('Search everything', 'thistle')
  await app.pressKey('Enter')
  await app.see('Search')

  // THE DOOR THIS JOURNEY EXISTS FOR. Before the change the screen's ⋯ held one
  // row — Clear — and there was no way from a result to an anthology.
  await app.press('Everything this screen can do')
  await app.press('Gather into an anthology')

  // The box finds one or makes one, and this name belongs to none: typing it IS
  // the create path, which is what the old closed list could not do.
  await app.type('Anthology', 'Thistles and other small things')
  await app.press('Save')

  // WAIT FOR THE APP TO SAY IT LANDED, rather than navigating off the moment the
  // press is made. The dialog closes as soon as it is pressed and the request is
  // still in flight behind it, so a `goto` here is a race — and a race this journey
  // won often enough to look green. The toast is the app's own signal that the
  // server answered.
  await app.see('gathered')

  // THE ANTHOLOGY IS REAL AND IT HAS THE PASSAGES IN IT. Read off the anthologies
  // screen rather than from the toast, because a toast is what the client decided
  // to say and this is what the server kept.
  //
  // OPENED RATHER THAN COUNTED, because the tile would say "3 entries" for an
  // anthology that was made and filled with the wrong thing just as readily as for
  // one filled with the right thing. The word searched for has to be inside it.
  await app.goto('/anthologies')
  await app.see('Thistles and other small things')
  await app.press('Thistles and other small things')
  await app.see('thistle')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
