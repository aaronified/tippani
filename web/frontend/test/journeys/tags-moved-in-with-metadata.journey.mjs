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
// AND IT IS PART OF CATEGORIES NOW, with the colours — the owner: "merge the tags and
// the colours metadata pages into one" — so the door is Categories.
//
// THE MUTATIONS: take the categories entry out of METADATA_SECTIONS and the door is not
// there to press; render the categories branch without TagsPage and 'Stickers' never
// appears; remove the redirect and /tags renders nothing at all.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader finds Tags inside Metadata', async () => {
  await app.goto('/metadata')

  // The door, in the console's own rail of sections.
  await app.press('Categories')

  // AND IT IS THE TAGS SCREEN, not a heading that says Tags. Stickers are the half
  // of that screen nothing else in the app draws, so naming one is the assertion
  // that the whole screen came along rather than a title.
  await app.see('Stickers')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('Back still works after following the old Tags address', async () => {
  // A REDIRECT REPLACES THE ENTRY IT LANDED ON; IT DOES NOT STACK ON TOP OF IT.
  //
  // The first cut of this pushed, so the history read library → tags → metadata with
  // /tags still in the middle answering with the console — and Back from there went
  // metadata, metadata, metadata for ever. The shelf was unreachable. A rating found
  // it by pressing Back in a browser, which is the only place that stack exists: the
  // route helpers can be read all day and the defect is in what they leave behind.
  //
  // THE MUTATION: swap `redirectTab` back for `selectTab` at the TagsRedirect call
  // site and this fails — Back lands on the console again rather than the shelf.
  await app.goto('/library')
  await app.see('On the Shortness of Life')

  await app.goto('/tags')
  await app.see('Stickers')

  // THE BROWSER'S OWN BACK, through the escape hatch the harness declares. There is
  // no verb for it in the vocabulary and there should not be: `see`, `press` and the
  // rest are things on a page, and Back is the CHROME around the page — a control
  // the app does not draw and a reader uses constantly. world.mjs says every use of
  // `page` is a small debt; this is the debt and this is the reason.
  await app.page.goBack()
  // Back from a redirect goes where the reader actually came from.
  await app.see('On the Shortness of Life')

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
