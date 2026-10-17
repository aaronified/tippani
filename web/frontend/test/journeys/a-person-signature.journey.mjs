// A reader gives a person a signature from a photo of it, sees it cleaned before it
// is kept, and then the share sheet offers it on that person's quotes.
//
// WHAT THE REPORT WAS: the owner asked for a person's signature to sit beside their
// quotes on a shared picture. The chain is long and every link is invisible from
// the next: the record's slot, the dialog that cleans, the list the share card reads
// the person's signature from, and the option the sheet then shows. Any one missing
// leaves the others looking fine.
//
// SETUP KNOWS POST /books (`title`, `author`) and POST /annotations (`book_id`,
// `quote`), and the `id` each answers with: a book by the person, with one highlight,
// opened at /books/{id}. Nothing about the signature itself is set up: it is made
// through the screen.
//
// THE MUTATIONS, built and run and put back: the dialog's ✓ sending the file to the
// preview route instead of the save (signature.jsx) leaves the slot empty and reddens
// "Remove signature"; the share builder never resolving a signature (share.jsx's
// resolveSignature answering null) leaves the sheet without the option and reddens the
// last assertion. Hiding signature_path from personRow's JSON reddens the slot first,
// because the record reads the same field, so it does not isolate the share half.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()
const HERE = dirname(fileURLToPath(import.meta.url))
const SIGNATURE = join(HERE, 'fixture', 'assets', 'signature-photo.png')

it('a person gets a signature from a photo, cleaned first, and the share sheet then offers it', async () => {
  const book = await app.setup('POST', '/books', { title: 'The Dispossessed', author: 'Ursula K. Le Guin' })
  await app.setup('POST', '/annotations', { book_id: book.id, quote: 'True journey is return.' })

  await app.goto(`/books/${book.id}`)

  // BEFORE: the share sheet has nothing to offer, because nobody credited has one.
  await app.press('Share')
  await app.see('Share')
  expect((await app.onScreen()).toLowerCase(), 'the sheet offers a signature nobody has').not.toContain('signature')
  await app.pressKey('Escape')

  // The person's page, from their name on their book, as a reader reaches it.
  await app.press('Ursula K. Le Guin')
  await app.see('No signature yet')

  // Upload: the dialog opens on the CLEANED signature and keeps nothing until ✓.
  await app.upload('Upload signature', SIGNATURE)
  await app.see('Ink strength')
  await app.see('Signature — Ursula K. Le Guin')
  await app.press('Save')
  await app.see('Remove signature')
  await app.gone('No signature yet')

  // AFTER: the same sheet now offers it.
  await app.goto(`/books/${book.id}`)
  await app.press('Share')
  await app.see('Share')
  expect((await app.onScreen()).toLowerCase(), 'the sheet does not offer the signature just added').toContain('signature')

  expect(await app.sideways(), 'the page slides sideways').toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
