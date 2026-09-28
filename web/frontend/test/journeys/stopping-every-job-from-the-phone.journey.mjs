// On a phone, a reader opens Settings and the Jobs tile on the index says how
// many jobs are running and how many are waiting. They press its red Stop all,
// the app asks first, saying what becomes of the running one and of the waiting
// ones — they back out once, and nothing stops — then they press it again and
// confirm. Past jobs holds the three, stopped, and the tile reads nought running
// and nought waiting, with no Stop all left on it.
//
// WHY THIS EXISTS. The owner asked for exactly this on the phone's Settings
// index: "one red Stop all with a confirmation, and a count of what is queued",
// and on 28 September ruled that the tile counts what is running as well (F11).
// Stop all ends every job the reader has running or waiting — an admin's ends
// everybody's — so a press that did not ask first would be the most destructive
// single tap in the app, and counts that did not move would leave the reader
// guessing whether it had worked.
//
// WHAT NO OTHER TIER SEES. The compact tile exists only under the phone
// breakpoint, and every other tier runs at a desk's width. The dom tier draws the
// tile over a fake of the jobs routes; this is the one place a real Stop all
// reaches a real queue with a job really running, and the tile, the confirm and
// Past jobs are all read back off a real server afterwards. And "asks first" is
// asserted by backing out: a confirm that stopped the jobs whatever the answer
// would still show a dialog.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - TIPPANI_JOBS_HOLD=running, the server's test seam (internal/jobs/runner.go):
//     the worker claims the first job and holds it running before its first
//     step, until a Stop ends it, and the two behind it wait. Offline — and every
//     journey server is offline — each would otherwise finish in milliseconds,
//     before the tile could count it. The server honours the switch ONLY while
//     offline, so it cannot stall a real deployment. Nothing a reader could do
//     would hold a job running.
//   - SETUP KNOWS `GET /api/books` and its `books`, `id` and `title` fields, and
//     `POST /api/jobs` with `kind: 'fill'` and `book_ids`, to queue three fills.
//     Queueing is not what is under test — stopping is — and three presses of
//     Fill gaps on three books is a-fill-i-start-keeps-its-place's journey three
//     times over.
//
// THE MUTATIONS, each run and restored before the next:
//   - Stop all without the confirm (stopAll in jobsSection.jsx skipping its
//     `ask`): red at "Stop all jobs?", which never appears.
//   - The tile's running count dropped (the compact card drawing no running
//     tally, the card head keeping its own): red at "1 running".
//   - The tile's waiting count dropped: red at "2 waiting".
//
// It otherwise knows the words on the screen.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE, env: { TIPPANI_JOBS_HOLD: 'running' } })

// Three of the real titles the curator keeps verbatim, so they survive a fixture
// rebuild. Three books because the server refuses the same fill queued twice.
const TITLES = ['On the Shortness of Life', 'The Idiot', "Grimm's Fairy Stories"]

it('on a phone the Jobs tile counts what runs and what waits, and Stop all asks before it stops them', async () => {
  const { books } = await app.setup('GET', '/books')
  for (const title of TITLES) {
    const { id } = books.find((b) => b.title === title)
    await app.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: [id] } })
  }

  await app.goto('/settings')
  await app.see('1 running')
  await app.see('2 waiting')

  // IT ASKS, SAYING WHAT HAPPENS TO EACH, AND BACKING OUT STOPS NOTHING.
  await app.press('Stop all')
  await app.see('Stop all jobs?')
  await app.see('The running job stops at once, and the item it has in hand is left untouched.')
  await app.see('The 2 waiting are stopped before they start.')
  await app.press('Cancel')
  await app.gone('Stop all jobs?')
  await app.see('1 running')
  await app.see('2 waiting')

  // AND CONFIRMING STOPS ALL THREE, the running one with the two behind it.
  await app.press('Stop all')
  await app.see('Stop all jobs?')
  await app.press('Stop them')
  await app.see('0 running')
  await app.see('0 waiting')
  // ABSENT, NOT GREYED: with nothing running or waiting there is nothing to stop.
  await app.gone('Stop all')

  // KEPT, EACH WITH ITS NAME. The Stopped chip narrows Past jobs to the jobs
  // that were stopped, and all three books are in it.
  await app.press('Jobs')
  await app.see('Past jobs')
  await app.press('Stopped')
  for (const title of TITLES) await app.see(title)

  // Not the state the presses left behind: a fresh page, asking the server.
  await app.goto('/settings')
  await app.see('0 running')
  await app.see('0 waiting')
  await app.gone('Stop all')

  expect(await app.sideways(), 'the phone page slides sideways').toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
