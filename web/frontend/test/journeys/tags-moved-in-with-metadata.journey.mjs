// Tags is a section of the metadata console now, and the address it used to have
// still takes a reader there.
//
// THE ASK: "tags should be a section within metadata (give icons to all the sections,
// from the icon sources, do not make them up yourself)." Tags always answered the same
// question the rest of that console does — what is written across the library, and is
// it written consistently — while sitting in the nav beside Stats as if it were a place
// you go to read.
//
// THE HALF THAT IS EASY TO GET WRONG IS THE ADDRESS. Moving a screen into a section is
// a change of address, and /tags is one people have bookmarked and linked to. A nav row
// can be removed; a URL that stops resolving is worse than the row it replaced, because
// the reader's evidence is a broken link rather than a moved door. So the route stays
// and redirects, and that is what the second half of this checks.
//
// THE MUTATIONS: take the tags entry out of METADATA_SECTIONS and the door is not there
// to press; drop the `tags` branch that renders the screen and the section opens on
// whatever the final `else` draws, so 'Stickers' never appears; remove the redirect and
// /tags renders nothing at all.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader finds Tags inside Metadata', async () => {
  await app.goto('/metadata')

  // The door, in the console's own rail of sections.
  await app.press('Tags')

  // AND IT IS THE TAGS SCREEN, not a heading that says Tags. Stickers are the half
  // of that screen nothing else in the app draws, so naming one is the assertion
  // that the whole screen came along rather than a title.
  await app.see('Stickers')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('the address Tags used to have still goes there', async () => {
  // A BOOKMARK, TYPED THE WAY A BOOKMARK ARRIVES: straight at the old URL, with no
  // press beforehand to set anything up.
  await app.goto('/tags')

  // It lands in the console, open at the section that absorbed it.
  await app.see('Stickers')
  // And it really is the console rather than the old standalone screen — the
  // sections rail beside it is the thing only Metadata draws.
  await app.see('Characters')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
