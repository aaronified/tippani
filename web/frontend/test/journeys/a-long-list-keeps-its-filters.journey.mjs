// A reader at the bottom of a long Works list can still reach its filters, and the
// list goes all the way down the screen.
//
// WHAT THIS GUARDS. The owner: "On desktop the works, characters, and people
// screen do not use the full height." Each list was a box capped at about 60% of
// the window with its own scroll bar; the page scrolls now, and the toolbar — the
// filters, the issue pills, select-all — sticks under the top bar so a reader 400
// rows down does not have to climb back up to narrow the list.
//
// TWO FACTS ABOUT WHERE THINGS ARE, so it reads them with `inReach` — can a thumb
// press this without scrolling. `press` cannot answer that: it scrolls its target
// into the open first, as a person does, so a press after scrolling away passes
// whether or not the toolbar followed.
//
// THE MUTATIONS, each run:
//   - drop `position: sticky` from `.console-toolbar` in index.css and the second
//     `inReach('flagged')` fails — the pills went up with the page;
//   - put the list back in its box (`maxHeight: 'min(28em, 60vh)'` with
//     `overflowY: 'auto'` on the works list wrapper in MetadataPage.jsx) and the
//     `inReach('Edit Almanac Ember')` after End stays true — the page has almost
//     nothing to scroll, so the first row never leaves.
//
// It knows the words on the screen, one key, and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('the filters stay in reach at the bottom of a long works list', async () => {
  await app.goto('/metadata/works')
  await app.see('flagged')
  expect(await app.inReach('Edit Almanac Ember'), 'the first work should be on screen to begin with').toBe(true)

  await app.pressKey('End')

  expect(await app.inReach('Edit Almanac Ember'), 'the page did not scroll the list — is it back in a box of its own?').toBe(false)
  expect(await app.inReach('flagged'), 'the filters scrolled away with the list').toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
