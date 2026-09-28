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
// invented prose written for this fixture and filed under On the Shortness of
// Life (until 3.1.0 they were two lines of Seneca of unrecorded source, and the
// owner's call was "Swap unverified lines for invented prose"), and they are
// deliberately NOT among the five this fixture's copy of that book already holds,
// so "the quote arrived" is a fact about the import rather than about what was
// already there.
//
// AND A WORK'S ROW IS ONE LINE: the work, an arrow, where it will land. The arrow
// is a drawing with no text in it, so what the screen says across it is the two
// halves with the space either side, on one line, which is what a reader reads
// and what a copy of the row holds. Until the arrow was put back in the sentence
// the screen said the work, then a line break, then the rest (the rows drew it as
// a block, on a line of its own). THE MUTATION, run: take the `.import-arrow >
// svg` rule out of index.css and this goes red at the work's row.
//
// AND THE FILE'S OWN ROW SAYS WHAT IT STAGED. The summary over the rows said "2
// quotes staged" while the file's row went on saying "…", because the server's
// answer carries its own `pending` (how many staged quotes wait in Pending
// import) and it overwrote the row's "still waiting for its answer"; the line
// above asserting "2 quotes staged" was finding the summary. THE MUTATION, run:
// the answer spread over the row last again, as it was, and this goes red at the
// file's row, which says "…".

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const HERE = dirname(fileURLToPath(import.meta.url))
const FILE = join(HERE, 'fixture', 'imports', 'seneca-two-more.md')

// One line out of the file, distinctive enough that nothing else in the library
// carries it and short enough to read in a failure message.
const ARRIVING = 'A borrowed book is always read fastest.'

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

  // THE FILE'S OWN ROW SAYS IT TOO, not only the summary over it, and the same
  // way: the file, its arrow, what became of it.
  await app.see('seneca-two-more.md  2 quotes staged')

  // ONE LINE A ROW: the work, its arrow and where it will land, with a space
  // either side of the arrow, which the screen reads as two.
  await app.see('On the Shortness of Life (2)  joins your existing')

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
  // THE APPROVAL IS A JOB ON THE SERVER'S QUEUE (3.1.0), and the screen that
  // pressed it follows it to its end and reads the queue again — empty now, which
  // is what a reader waits for before leaving.
  await app.see('nothing staged')

  // AND NOW IT IS IN THE LIBRARY, after a real navigation rather than against
  // the render the press produced.
  await app.goto('/library')
  await app.press('On the Shortness of Life')
  await app.see(ARRIVING)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
