// A reader gives a speaker a signature from their page and, without reloading anything, shares a
// quote by that speaker: the sheet offers the signature.
//
// WHAT THE REPORT WAS: after Tagore's signature was fetched and kept, the share sheet on his quote
// had no Signature option. a-person-signature already proves the option appears for a book's
// author — but it reloads the page before it opens the sheet, and a reader does not: they close
// the person's page and press Share on the quote they were looking at.
//
// SETUP KNOWS POST /quotes (`quote`, `speaker`) and the `id` it answers with: a standalone quote
// said by a person, listed on /quotes. The signature itself is made through the screen.
//
// THE MUTATIONS are named in the commit that made this pass.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()
const HERE = dirname(fileURLToPath(import.meta.url))
const SIGNATURE = join(HERE, 'fixture', 'assets', 'signature-photo.png')

it('a signature given to a speaker is on the share sheet of their quote at once', async () => {
  // On a board of its own, so the page holds this one quote and one Share to press.
  const board = await app.setup('POST', '/boards', { name: 'Menace' })
  await app.setup('POST', '/quotes', { quote: 'Nationalism is a great menace.', speaker: 'Rabindranath Tagore', board_id: board.id })

  await app.goto('/quotes')
  await app.press('Menace')
  await app.see('Nationalism is a great menace.')

  // BEFORE: nobody credited has a signature, so the sheet has none to offer.
  await app.press('Share')
  await app.see('Share')
  expect((await app.onScreen()).toLowerCase(), 'the sheet offers a signature nobody has').not.toContain('signature')
  await app.pressKey('Escape')

  // The speaker's page, from their name on the quote, as a reader reaches it. Keep a signature.
  await app.press('Rabindranath Tago…')
  await app.see('No signature yet')
  await app.upload('Upload signature', SIGNATURE)
  await app.see('Ink strength')
  // Save stays off until the cleaned picture is in (the sheet says loading… until then). Pressing it before
  // that does nothing, and on a slow runner the picture is not there yet: the failure CI kept showing.
  await app.gone('loading…')
  await app.press('Save')
  await app.see('Remove signature')
  await app.pressKey('Escape')

  // AFTER, with no reload: the same quote's sheet offers it.
  await app.press('Share')
  await app.see('Share')
  expect((await app.onScreen()).toLowerCase(), 'the sheet does not offer the signature just added').toContain('signature')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
