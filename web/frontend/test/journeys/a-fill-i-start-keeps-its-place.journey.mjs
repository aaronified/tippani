// A reader presses Fill gaps on a book, leaves the screen before it has run —
// a reload, which is what closing the tab, locking the phone or opening another
// screen all come to — and finds the fill in Settings › Jobs, still waiting its
// turn, under the book's own name.
//
// WHY THIS EXISTS. Until 3.1.0 Fill gaps was a loop in the browser: the screen
// sent the selection fifteen works at a time and the fill lived exactly as long
// as that screen did. Leaving it stopped the fill wherever it had got to, and
// nothing anywhere said where. The fill is a job on the server now, and "it keeps
// its place when I leave" is the whole of what the reader was promised.
//
// WHAT NO OTHER TIER SEES. The dom tier drives the press against a fake of the
// jobs routes, which proves the screen sends a job and draws the answer it was
// handed; the Go tier proves POST /jobs queues one. Neither can say that the job
// the press made is the job Settings › Jobs reads back after a real page load,
// from a real server, under the name the reader pressed it on — the two halves
// of the contract meeting, which is the thing this directory exists to watch.
//
// THE RELOAD IS THE POINT. `goto` is a browser navigation, so everything the
// Library screen held — the press, the toast, the follow loop — is gone, and a
// row still on screen afterwards came out of the server's answer to a fresh
// request.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - TIPPANI_JOBS_HOLD=1, the server's test seam (internal/jobs/runner.go): the
//     worker claims nothing, so every job queued stays waiting. Offline — and
//     every journey server is offline — a one-book fill finishes in
//     milliseconds, and there would be no waiting job to leave behind. The
//     server honours the switch ONLY while offline, so it cannot stall a real
//     deployment. Nothing a reader could do would hold a queue still.
//   - SETUP KNOWS `GET /api/books`, `GET` and `PUT /api/books/{id}`, and the
//     `books`, `id`, `title` and `isbn` fields, to give the book an ISBN. A book
//     with no identifier is one a fill has nothing to ask about (it counts it
//     "unpinned" and moves on), so the fill waiting here is one with a lookup in
//     it — the fill the feature is for. Typing an ISBN into the edit form is a
//     journey of its own and not this one's.
//
// THE MUTATION. Put back the old client loop in bulkOps.jsx's fillGaps — POST
// /metadata/fill, fifteen works a request, no job — and this goes red at
// "Waiting — next": the fill ran and ended inside the press, so nothing ever
// waited. With that line taken out as well it goes red at the stop control's
// name, because Current jobs has nothing running or waiting to name.
//
// It otherwise knows the words on the screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ env: { TIPPANI_JOBS_HOLD: '1' } })

// One of the real titles the curator keeps verbatim, so it survives a fixture
// rebuild; and the fixture's only book of philosophy, so the genre filter below
// leaves it alone on the shelf.
const TITLE = 'On the Shortness of Life'
const ISBN = '9780141018812'

it('a fill pressed on a book is still waiting in Settings › Jobs after the reader leaves', async () => {
  const { books } = await app.setup('GET', '/books')
  const { id } = books.find((b) => b.title === TITLE)
  const book = await app.setup('GET', `/books/${id}`)
  await app.setup('PUT', `/books/${id}`, { ...book, isbn: ISBN })

  // THE READER'S WAY TO ONE BOOK: narrow the shelf to it, tick it, and use the
  // bar's verb. Every tile's tick is named "Select this book", so the filter is
  // what makes the one press unambiguous.
  await app.goto('/library')
  await app.choose('Filter by genre', 'Philosophy')
  await app.see(TITLE)
  await app.press('Select this book')
  await app.press('Fill gaps')

  // THE PRESS SAYS WHERE IT STANDS. Behind nothing, it is next.
  await app.see('Waiting — next')

  // AND THE READER LEAVES.
  await app.goto('/settings/jobs')

  // THE FILL, BY THE BOOK'S NAME, WAITING. The stop control's name carries all
  // three facts at once — the job, what it is about, where it stands — and it is
  // the name a screen reader announces for the row.
  await app.see('Current jobs')
  expect(await app.said('Stop Fill gaps · On the Shortness of Life (next)')).toBeTruthy()
  await app.see('Waiting — next')
  await app.see('1 waiting')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
