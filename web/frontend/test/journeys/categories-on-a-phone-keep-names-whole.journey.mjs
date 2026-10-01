// A reader opens Categories on a phone: every tag's name and every verb beside it
// is printed whole, and the new-tag form is not a card with its own heading.
//
// THE OWNER'S REPORT, 1 October, over a screenshot of Categories at a phone's
// width: "The "+new tag" wording not required, we already have the add tag button.
// The new tag section need not have a card boundary within the card … Tags on
// mobile: 1 per row. Stickers on mobile: 3 per row." At two tags to a row the
// screenshot broke a name ("Discriminatio / n") and the verbs under it ("practi /
// se", "edi / t", "delet / e").
//
// WHAT IS MEASURED, AND WHAT IS NOT. `splitWords` lists the words a line break cut
// in two, which is the owner's complaint as the screen draws it; a picture of the
// card at one per row would still read as fine if a name broke inside it. How many
// stickers sit on a row has no word on the screen to read, so the three per row is
// checked in the capture at 390, not here.
//
// The golden library already holds the tag from the owner's screenshot,
// "Discrimination", so the width it needs is on the screen with no setup.
//
// THE MUTATIONS, each built and run and put back:
//   - the tag grid back at two columns on a phone (TagsPage.jsx), run with the
//     old heading still in: red at the split words, [ 'practise', 'edit',
//     'delete' ] (the golden library's names fit; the verbs under them do not);
//   - the form's "New tag" heading put back alone: red, the screen says "New tag".

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('Categories on a phone prints every tag name and verb whole, with no heading over the form', async () => {
  await app.goto('/metadata')
  await app.press('Categories')
  await app.see('Discrimination')
  await app.see('Create tag')

  expect(await app.splitWords()).toEqual([])
  // The form's own button says what it does; nothing above it says it again.
  await app.gone('New tag')
  expect(await app.sideways(), 'Categories slides sideways on a phone').toBe(0)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
