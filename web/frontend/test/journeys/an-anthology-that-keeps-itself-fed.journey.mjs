// A reader makes an anthology out of a search, says keep it fed, and what they
// write afterwards is waiting for them.
//
// THIS IS THE ASK, AND IT HAD NO TEST. The owner's words: "I need auto anthology
// support: like adding one from a search result. all future entries in the search
// will also flow there automatically." Two halves — the rule, and the *later* — and
// the full suite passed with both of them disabled: hard-coding the form's rule to
// `''`, or `auto` to `false`, changed nothing any test noticed. A guard that cannot
// fail is a guard the next person trusts, so this is the one that dies.
//
// IT ALSO COVERS THE DOOR THE OWNER SAID WAS MISSING. "a version of this already
// exists, but cannot be accessed from the anthology add menu" — the press of
// "Fill from a search" below is on the NEW-anthology form, which is where it was
// not. `gathering-a-search` covers the other route they named, the search screen's
// own menu.
//
// WHY A HIGHLIGHT IS WRITTEN AFTERWARDS. "Keep it fed" cannot be seen on the fill
// itself: the fill takes everything matching, so nothing is waiting the moment it
// finishes, and an anthology with auto ON and auto OFF look identical until
// something NEW matches. So the highlight written at the end is the whole point — it
// arrives after the anthology was made, and only an anthology that was told to keep
// looking offers it.
//
// A BOOK IS THE SOURCE because a book is a thing you can add to afterwards. "My
// favourites" would need the fixture's quotes favouriting first, and "everything in
// the library" fills past the 200-a-time cap, which leaves a waiting count that is
// about the cap rather than about the new line.
//
// THE MUTATIONS: force `auto` to false and the "Add 1 waiting" offer never appears;
// skip the source and the ✓ is blocked, so the anthology comes out empty.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// A word the fixture's generator cannot produce — its invented prose runs on
// alder, bramble, cobble, ember and the like — so a match is never a coincidence.
// One of the four public-domain books the fixture keeps verbatim, so naming it
// survives a regeneration of the derived ones. It carries five highlights.
const BOOK = 'On the Shortness of Life'
const LATER = 'A line written after the anthology already existed.'

it('an anthology told to keep itself fed offers the quote written after it was made', async () => {
  // THE DOOR ON THE NEW-ANTHOLOGY FORM.
  await app.goto('/anthologies')
  await app.press('New anthology')
  await app.type('Title', 'Seneca, kept')
  await app.press('What goes in it')

  // A NAMED SOURCE. The search box is gone from this form — the owner's "the fill
  // from a search in the add anthology popup feels bad, drop it" — so the anthology
  // is pointed at a thing you already have rather than composed out of a query.
  await app.press('A book')
  // KEEP IT FED, pressed before the title is typed. Not an accident of ordering: the
  // combobox opens its list of every book over the rest of the sheet, and the switch
  // is under it until the list closes.
  await app.press('On')
  await app.type('A book', BOOK)
  await app.press('Save')
  await app.press('Create')

  // The fill took what the book already held.
  await app.press('Seneca, kept')
  await app.see(BOOK)

  // NOW SOMETHING NEW MATCHES, written after the anthology existed.
  await app.goto('/library')
  await app.press(BOOK)
  await app.press('Capture a quote')
  await app.type('Quote', LATER)
  await app.press('Save')

  // And the anthology is holding it out to be taken. It is an OFFER and not an
  // arrival: the count is a control the reader presses, because an anthology that
  // grew by itself is a change that happened while they were not looking.
  await app.goto('/anthologies')
  await app.press('Seneca, kept')
  await app.see('Add 1 waiting')

  // Pressing it is what actually adds, and then the line is in the reading order.
  await app.press('Add 1 waiting')
  await app.see(LATER)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
