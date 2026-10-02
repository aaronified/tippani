// A reader adds a link to a person's page and uploads their portrait, and the
// page says both are the reader's: the link wears "you", the portrait "You".
//
// THE OWNER'S CHOICE (30 Sep): "Links auto/you + portrait source", the pack's
// §1.3. The "auto" half needs a supplier to have answered, which the offline
// journey world cannot do; that half is person-page-sources.test.jsx and
// people_sources_test.go. These two halves need nothing but the reader, so they
// are pressed here.
//
// SETUP KNOWS POST /books and its fields `title` and `author`, and the `id` it
// answers with: a book whose author is the person, opened at /books/{id}.
//
// THE MUTATIONS, built and run and put back: the person save crediting a new
// link to nobody (identity_handlers.go's relinkSources given "" for the reader)
// reddens the link's "you"; the upload not recording its credit (covers_handler
// leaving people out of its image_source write) reddens the portrait's "You".

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()
const HERE = dirname(fileURLToPath(import.meta.url))
const PORTRAIT = join(HERE, 'fixture', 'assets', 'work-3.png')

it("a reader's own link and upload on a person's page say they are the reader's", async () => {
  const book = await app.setup('POST', '/books', { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin' })

  // The person's page, from their name on their book, as a reader reaches it.
  await app.goto(`/books/${book.id}`)
  await app.press('Ursula K. Le Guin')
  await app.see('Links')

  await app.press('Add link')
  await app.type('The address', 'https://ursulakleguin.com')
  await app.press('Save')
  await app.gone('Add a link')
  await app.see('ursulakleguin.com')
  expect(await app.onScreen(), "the reader's link does not say it is theirs").toMatch(/ursulakleguin\.com\s*you/)

  await app.upload('Upload', PORTRAIT)
  await app.see('remove the picture')
  // The portrait's own lines, between the person's name card and the picture verbs:
  // the link above already says "you", so a "you" anywhere on the page proves nothing.
  const portrait = (await app.onScreen()).split('author · 1 work')[1].split('Fetch')[0]
  expect(portrait, "the reader's own picture does not say it is theirs").toMatch(/\byou\b/i)

  expect(await app.sideways(), 'the page slides sideways').toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
