// A reader looking for their tags finds the colours and the stickers beside them.
//
// WHAT THIS GUARDS. The owner: "merge the tags and the colours metadata pages into
// one". They are one section, Categories, and an old address for Tags — a bookmark,
// a link in a note — lands on it rather than on a section that no longer exists.
//
// THE MUTATION. Delete the `tags: 'categories'` alias in MetadataPage.jsx and
// /metadata/tags falls back to Works: none of the three is on screen.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('the tags, the colours and the stickers are one section, even from the old address', async () => {
  await app.goto('/metadata/tags')

  await app.see('Compassion')   // a tag
  await app.see('Default')      // the colours: their first row is drawn as a label,
                                // the rest are names in fields, which the screen's text does not hold
  await app.see('Stickers')     // and the stickers heading

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
