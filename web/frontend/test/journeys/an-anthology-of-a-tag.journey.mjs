// A reader makes an anthology of a tag by pointing at the tag, not by writing a
// query.
//
// WHAT THIS REPLACES. The form carried a door onto the search box — the same one the
// anthology's own ⋯ draws — and the owner's verdict was that it "feels bad". It is
// right, and the reason is a mismatch of posture: a search bar is where you ASK A
// QUESTION, and this form is where you DECLARE WHAT A THING IS. Nobody making an
// anthology of everything they tagged Hope wants to compose `tag=Hope`.
//
// SO THE SOURCES ARE NAMED — the whole library, a book, a film, a tag, an author, a
// colour, a shelf, favourites, a stretch of time — and each is a thing already in the
// reader's library rather than a clause they have to build. This presses the tag one.
//
// AND THE ROW SAYS IT BACK IN WORDS. `q=…&tag=Hope` is what goes on the wire and is
// deliberately readable, but it is not what a form should show somebody who just
// chose Hope from a list. The assertion on "A tag: Hope" is the assertion that the
// summary and the request are two views of one answer rather than two answers.
//
// THE MUTATIONS: drop the press of "A tag" and the combobox never appears; drop the
// typed value and the ✓ stays blocked, so the anthology comes out unfilled and the
// final `see` of a tagged quote fails.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader makes an anthology of a tag by choosing the tag', async () => {
  await app.goto('/anthologies')
  await app.press('New anthology')
  await app.type('Title', 'Everything hopeful')

  // The row sits under the introduction and above what each passage shows, which is
  // the order somebody decides in: what it is, what goes in it, how it is printed.
  await app.see('Nothing yet')
  await app.press('What goes in it')

  // A NAMED SOURCE, not a query. Pressing it reveals the list of what you have.
  await app.press('A tag')
  await app.type('A tag', 'Hope')

  // Keep taking them as more arrive — the owner's "all auto/search based anthologies
  // should allow auto-expand as new quotes/annotations come in".
  await app.press('On')
  await app.press('Save')

  // BACK ON THE FORM, WHICH IS THE OTHER HALF OF THE ASK: the sub-popup returns you
  // rather than closing the lot, so the title typed above is still there. Read off
  // the box itself — a value in an input is not in the page's text, which is what
  // `see` reads.
  expect(await app.valueOf('Title'), 'the form went with the popup').toBe('Everything hopeful')
  // And the row says the choice in words rather than in a query string.
  await app.see('A tag: Hope')

  await app.press('Create')
  await app.see('Everything hopeful')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
