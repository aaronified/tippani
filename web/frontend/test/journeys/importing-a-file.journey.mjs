// A reader who has highlights in a file brings them in, checks them, and approves
// them — and nothing reaches their library until they say so.
//
// AN IMPORT IN THIS APP NEVER WRITES STRAIGHT TO THE LIBRARY. It lands in a
// staging queue and is approved out of it, and that is an invariant the repo
// states in as many words. This journey is the only thing that checks it the way
// a reader would experience it: it looks at the book BETWEEN the upload and the
// approval and finds the new lines absent. A test that uploaded and then asserted
// the quotes had arrived would pass on an app that had thrown the queue away and
// written straight through, which is the one behaviour the invariant forbids.
//
// WHAT NOTHING CHEAPER CATCHES. A Go test of the importer can prove the parser
// reads this Markdown and the staging endpoint stores what it read — and it says
// nothing about whether a browser can hand the app a file at all. The picker is
// an `input[type=file]` the app keeps off screen behind a label, so a jsdom test
// with a mocked FileList never exercises the real upload, the real multipart body,
// or the real screen that has to draw a queue afterwards. Between "the parser
// works" and "a reader can import a file" there is a whole surface, and this is
// the tier that stands on it.
//
// THE FILE IS COMMITTED AND ITS FORMAT WAS NOT GUESSED. `fixture/imports/` holds
// a small Markdown file in the shape the app's OWN export writes — verified by
// pressing Export on the Library, reading the bytes back through
// `app.downloaded`, and building the fixture to match it. Its two lines are
// Seneca, public domain, and deliberately NOT among the five this fixture's copy
// of that book already holds, so "the quote arrived" is a fact about the import
// rather than about what was already there.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const HERE = dirname(fileURLToPath(import.meta.url))
const FILE = join(HERE, 'fixture', 'imports', 'seneca-two-more.md')

// One line out of the file, distinctive enough that nothing else in the library
// carries it and short enough to read in a failure message.
const ARRIVING = 'While we are postponing, life speeds by.'

it('a reader imports a file, and nothing lands in the library until they approve it', async () => {
  // NOT THERE BEFORE ANY OF THIS. Without this line the last assertion would be
  // true of a library that had always held the line.
  await app.goto('/library')
  await app.press('On the Shortness of Life')
  await app.gone(ARRIVING)

  await app.goto('/')
  await app.press('Add or import')
  await app.press('Files')
  await app.upload('Choose file', FILE)

  // The app's own count, and its own promise about where the rows are.
  await app.see('2 quotes staged')
  await app.see('nothing has entered your library yet')

  // THE INVARIANT, CHECKED WHERE A READER WOULD NOTICE IT BROKEN. The file has
  // been read and understood — the queue knows it is two quotes for a book this
  // library already has — and the book itself still does not carry them.
  await app.goto('/library')
  await app.press('On the Shortness of Life')
  await app.gone(ARRIVING)

  // Into the queue by the door the app puts in the sidebar, and the rows are
  // legible there: the reader sees what they are about to accept.
  await app.press('Checks')
  await app.see('Pending import')
  await app.see(ARRIVING)
  await app.see('joins your existing')

  await app.press('Approve all 2')

  // AND NOW IT IS IN THE LIBRARY, after a real navigation rather than against
  // the render the press produced.
  await app.goto('/library')
  await app.press('On the Shortness of Life')
  await app.see(ARRIVING)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
