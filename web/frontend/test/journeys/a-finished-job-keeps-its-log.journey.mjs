// A reader with no internet presses Fill gaps on a book that has an ISBN. The
// fill runs and finishes; later they open it in Settings › Jobs, read in its log
// the lookup the app tried and could not make, and export the log as a file that
// says the same thing.
//
// WHY THIS EXISTS. "What did it do?" had no answer before 3.1.0: a fill said
// "none fetched" in a toast and that was the whole record. The owner asked for
// every job to keep "what was searched, where, and every outbound request", and
// for the lookups to be written by one hook in the outbound gate rather than by
// each caller remembering to. A refused lookup is the line a reader most needs,
// because it is the one that explains a fill that filled nothing.
//
// WHAT NO OTHER TIER SEES. The Go tier proves the hook writes a line into a
// job's log when a request is refused, and that GET /jobs/{id}/log.md is
// Markdown. It cannot say that the line reaches the job the READER'S press made,
// through the queue, the runner and the offline gate of a real server, that the
// Past jobs row opens onto it, and that the file Chrome saves holds it. The
// export is checked as a file on disk because what a reader gets is a file, and
// "exported" over an empty one is the failure this tier exists to catch.
//
// NO HOLD. The fill runs, which is the point: it is a finished job whose log is
// asked about.
//
// DECLARED EXCEPTION: SETUP KNOWS `GET /api/books`, `GET` and `PUT
// /api/books/{id}`, and the `books`, `id`, `title` and `isbn` fields, to give the
// book an ISBN. Without one the fill has nothing to ask a provider (it logs the
// book as "unpinned" and moves on), so there would be no lookup to refuse.
// Typing an ISBN into the edit form is a journey of its own and not this one's.
//
// THE MUTATION. Take the outbound hook out (Logbook.Outbound in
// internal/jobs/outbound.go returning before it records anything) and this goes
// red at the refused lookup line: the fill still runs and still fails, and its
// log says only that the book's lookup failed, not what was asked or why.
//
// It otherwise knows the words on the screen, and what is in the file it is
// handed.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// One of the real titles the curator keeps verbatim, and the fixture's only book
// of philosophy, so the genre filter leaves it alone on the shelf.
const TITLE = 'On the Shortness of Life'
const ISBN = '9780141018812'
// WHAT THE LOG SAYS OF THE LOOKUP, as the pane draws it: the address the fill
// asked, holding the reader's ISBN, and that the offline switch refused it.
const REFUSED = `isbn%3A${ISBN} → refused (offline)`

it('a fill that finished offline keeps the lookup it could not make, on screen and in its export', async () => {
  const { books } = await app.setup('GET', '/books')
  const { id } = books.find((b) => b.title === TITLE)
  const book = await app.setup('GET', `/books/${id}`)
  await app.setup('PUT', `/books/${id}`, { ...book, isbn: ISBN })

  await app.goto('/library')
  await app.choose('Filter by genre', 'Philosophy')
  await app.see(TITLE)
  await app.press('Select this book')
  await app.press('Fill gaps')
  // The press's own answer at the end: the lookup was refused, so nothing came.
  await app.see('nothing could be fetched')

  await app.goto('/settings/jobs')
  await app.see('Past jobs')
  // The row is named for the job and the book; opening it opens its log.
  await app.press(`Fill gaps ${TITLE}`)
  await app.see(REFUSED)

  await app.press('Export')
  const file = await app.downloaded('.md')
  expect(file.text, 'the export does not hold the refused lookup').toContain(REFUSED)
  expect(file.text, 'the export is not about this job').toContain(TITLE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
