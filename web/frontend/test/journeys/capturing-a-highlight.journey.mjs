// A reader is part-way through a book, types out a line worth keeping, and finds
// it on that book afterwards — and still there after a reload.
//
// WHAT IT WOULD CATCH that nothing in the old suite would. A capture form whose
// Save posts nothing. A Save that posts and whose response the screen ignores. A
// screen that shows the new highlight optimistically and never actually wrote it —
// which is the failure a mocked jsdom test is structurally incapable of seeing,
// because the mock is the thing that would have refused. And the bulk
// season/episode shape of bug: a body the server answers 400 to, with a client
// test asserting the body it sends and a Go test asserting the body it accepts,
// neither ever pressing the button.
//
// THE RELOAD IS THE POINT, not politeness. Without it this passes on an app that
// renders what you typed and posts nothing: React would still be holding the
// words. After a reload the only place they can have come from is the database.
//
// IT NAMES "The Idiot" BECAUSE THAT TITLE SURVIVES A FIXTURE REBUILD. Every other
// work in the library is invented by the curator and regenerates; the four
// public-domain books are kept verbatim. A journey pinned to a generated title
// goes red on a rebuild that changed nothing about the app.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// Distinctive enough that it cannot already be in the library, and plain enough
// that a failure message is readable. No timestamp: each journey file gets its
// own copy of the fixture, so nothing here has to be unique across runs — and a
// value that changes every run is a value you cannot grep for in a screenshot.
const LINE = 'The sky above the port was the colour of a page left open.'

it('a reader captures a line from the book they are reading, and it is still there after a reload', async () => {
  await app.goto('/library')
  await app.press('The Idiot')
  await app.see('Fyodor Dostoyevsky')

  // The one ＋ on a book's own page already knows which book it is standing on,
  // so it goes straight to the form rather than asking which work this belongs
  // to. There are two controls carrying these words — the header's and the one
  // in the quote list — and the exact-name tier picks the header's.
  await app.press('Capture a quote')

  // "QUOTE" in capitals is what the accessible name actually is: this app styles
  // its field labels in capitals and the capitals reach the name. The vocabulary
  // folds case, so this reads the way a person would say it.
  await app.type('Quote', LINE)
  await app.press('Save')

  await app.see(LINE)

  // AND IT IS THE SERVER'S NOW. Everything above would pass on an app that shows
  // what you typed and posts nothing.
  await app.goto('/library')
  await app.press('The Idiot')
  await app.see(LINE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
