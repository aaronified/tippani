// The selection bar gathers, and still gathers after the request moved out from
// under it.
//
// WHY THIS EXISTS AT ALL. Gathering a selection is the OLDEST of the four doors
// into an anthology and was the only one for a long time; it was not part of what
// the owner asked for. It is here because the change went underneath it: the bar
// used to post `/anthologies/{id}/entries` itself against a number the picker
// handed back, and it now calls `gatherInto` with `{ id }` or `{ title }`, because
// four surfaces asking the same question through four copies of the request is the
// thing this repo's directive forbids. A refactor with no test over it is a
// regression waiting for somebody else to find.
//
// AND IT IS THE ONE ROUTE THAT CAN CREATE FROM A SELECTION. The old dialog's empty
// state sent a reader with no anthologies away to make one — losing the selection
// they had just built, which on a long shelf is the expensive thing to lose. The
// name typed below belongs to nothing, so this passes only if the create path runs
// with the selection still in hand.
//
// THE MUTATION: delete the `pressAll('Select this quote')` and the bar never
// appears, so 'More for the 2 selected' is not there to press.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const NAME = 'Gathered in a batch'

it('a reader selects two highlights and gathers them into an anthology they name', async () => {
  await app.goto('/library')
  // Seneca rather than Grimm: the fixture gives that one a single highlight, and a
  // selection of one cannot show that the bar gathers a SET. One of the curated
  // public-domain books, so the title survives a regeneration of the derived ones.
  await app.press('On the Shortness of Life')

  const ticked = await app.pressAll('Select this quote')
  expect(ticked, 'the book should carry several highlights to tick').toBeGreaterThan(1)

  await app.press(`More for the ${ticked} selected`)
  await app.press('Add to anthology')

  // The combobox, from the bar this time — the same dialog the card menu and the
  // search screen open, which is the point of it being one component.
  await app.type('Anthology', NAME)
  await app.press('Save')

  // WAIT FOR THE APP TO SAY IT LANDED, rather than navigating off the moment the
  // press is made. The dialog closes as soon as it is pressed and the request is
  // still in flight behind it, so a `goto` here is a race — and a race this journey
  // won often enough to look green. The toast is the app's own signal that the
  // server answered.
  await app.see('gathered')

  // What the server kept.
  await app.goto('/anthologies')
  await app.see(NAME)
  await app.press(NAME)
  await app.see('On the Shortness of Life')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
