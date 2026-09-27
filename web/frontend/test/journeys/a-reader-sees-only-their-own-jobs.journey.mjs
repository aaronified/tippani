// Two people share one Tippani and each has run a fill. The admin's Settings ›
// Jobs shows the admin's fill and the System logs card. The second reader's shows
// their own fill — and neither the admin's nor the System logs.
//
// WHY THIS EXISTS. Per-user isolation is the app's loudest promise: every query
// is scoped by the reader it is for. Jobs added a table every reader writes to and
// an admin reads all of, with a log per job that can name what somebody searched
// for — a title, an ISBN, a file's name. A reader's Jobs section that showed
// another reader's fill would leak exactly that, and it would not look like an
// error: it would look like a longer list.
//
// WHAT NO OTHER TIER SEES. The Go tier proves GET /jobs answers a reader with
// their own rows and GET /admin/logs refuses them; the dom tier proves Settings
// draws no System logs card for a user object with no admin flag. Neither holds
// two real sessions against one running server and reads the screen each one
// gets — which is where a scope dropped on either side, or a card drawn from the
// wrong flag, would show.
//
// THE NEGATIVE IS EARNED FIRST. The admin's fill and the System logs card are
// seen on the admin's own screen before the second reader signs in, so their
// absence afterwards is the scope's doing and not a screen that drew nothing.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - THE SECOND READER is made by the harness's `secondReader` (world.mjs), which
//     knows `POST /api/admin/users`, `POST /api/auth/login` and `POST
//     /api/auth/password` and their fields, and signs them in through the form.
//     Adding an account on Profile and choosing a first password are
//     per-user-isolation's and a-password-the-admin-chose-is-temporary's
//     journeys; this one is about what the account sees once it is in.
//   - SETUP KNOWS `GET /api/books` and its `books`, `id` and `title` fields,
//     `POST /api/books` with `title` and `author`, and `POST /api/jobs` with
//     `kind: 'fill'` and `book_ids`, to give each reader a fill of their own.
//     Who started a job is not under test; who can see it is.
//
// THE MUTATIONS, each restored before the next. Answer GET /jobs unscoped for
// every reader (visibleTo in jobs_handlers.go returning the admin's "1 = 1") and
// this goes red at the admin's book, still on the second reader's screen. Draw
// the System logs card for every reader (Settings.jsx building `logs` outside its
// admin branch) and it goes red at "System logs".
//
// It otherwise knows the words on the screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// A real title the curator keeps verbatim, so it survives a fixture rebuild.
const ADMINS_BOOK = 'The Idiot'
// The second reader's own book, invented for this run: nothing in the fixture
// is called this, so seeing it can only mean their own job.
const THEIR_BOOK = 'A Commonplace Book Kept Apart'

it('a second reader sees their own jobs, not the admin’s, and no system logs', async () => {
  const { books } = await app.setup('GET', '/books')
  const { id } = books.find((b) => b.title === ADMINS_BOOK)
  await app.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: [id] } })

  // THE ADMIN'S OWN SCREEN, FIRST: their fill, and the card only they get.
  await app.goto('/settings/jobs')
  await app.see('Past jobs')
  await app.see(ADMINS_BOOK)
  await app.see('System logs')

  const second = await app.secondReader({ username: 'second-reader', password: 'second-own-pw' })
  const mine = await second.setup('POST', '/books', { title: THEIR_BOOK, author: 'Second Reader' })
  await second.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: [mine.id] } })

  await app.goto('/settings/jobs')
  await app.see('second-reader')
  await app.see('Past jobs')
  await app.see(THEIR_BOOK)
  await app.gone(ADMINS_BOOK)
  await app.gone('System logs')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
