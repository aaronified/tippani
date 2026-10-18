// A reader uploads a wide logo as a person's picture and is shown it in the circle it will be
// drawn in, before anything is kept.
//
// WHAT THE REPORT WAS: "i am unable to properly centre a photo that i search or upload ... user
// should intuitively understand what exactly will be shown in the UI after upload." A wide logo
// (1600x701) is drawn in a circle, and the app cut it to fit without a word; its caption said
// "1600:701, cropped" after the fact.
//
// SETUP KNOWS POST /books (`title`, `author`) and the `id` it answers with: a book by the
// person, from which the person is reached by their name. The picture is made nowhere but through
// the screen.
//
// WHAT IS CHECKED IS WHAT A PERSON SEES: the frame offers to fill or show the whole picture and
// says the circle cuts the dimmed part; backing out leaves the person without a picture; keeping
// the whole picture gives a picture whose caption is the square it was framed to (1000x1000,
// where the unframed one read 1600x701 and "cropped"). The caption is read off the real file
// the browser then loads, so it is the stored picture and not a promise about it.
//
// THE MUTATIONS, built and run and put back: skipping the frame for an uploaded file (cast.jsx's
// frameFile answering 'fits' always) leaves the page on "1600×701px" with "cropped" and no
// frame; keeping the original instead of the framed canvas (the dialog's save uploading the file)
// does the same; backing out keeping the picture anyway leaves a picture where the journey expects none.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()
const HERE = dirname(fileURLToPath(import.meta.url))
const WIDE = join(HERE, 'fixture', 'assets', 'wide-logo.png')

it('a wide logo is shown in its circle first, backing out keeps nothing, and keeping stores the framed picture', async () => {
  const book = await app.setup('POST', '/books', { title: 'The Dispossessed', author: 'Ursula K. Le Guin' })

  await app.goto(`/books/${book.id}`)
  await app.press('Ursula K. Le Guin')

  // Upload: the circle's frame opens first, and says what it will cut away.
  await app.upload('Upload', WIDE)
  await app.see('Frame — Ursula K. Le Guin')
  await app.see('the dimmed part is cut off')
  await app.see('Fill the frame')
  await app.see('Show it all')

  // Backing out keeps nothing: the person still has no picture of their own.
  await app.pressKey('Escape')
  await app.gone('Frame — Ursula K. Le Guin')
  expect((await app.onScreen()), 'a picture the reader backed out of was kept').not.toMatch(/\d+×\d+px/)

  // Again, and this time the whole picture, kept.
  await app.upload('Upload', WIDE)
  await app.see('Frame — Ursula K. Le Guin')
  await app.press('Show it all')
  await app.press('Save')
  await app.gone('Frame — Ursula K. Le Guin')

  // The stored picture is the square the circle is cut from, not the 1600x701 that went in.
  await app.see('1000×1000px')
  expect((await app.onScreen()), 'the picture was kept unframed').not.toMatch(/1600×701px/)
  expect((await app.onScreen()), 'a framed square is still called cropped').not.toMatch(/cropped/)

  expect(await app.sideways(), 'the page slides sideways').toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
