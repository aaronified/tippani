// On a phone, a reader opens Settings and the Jobs tile on the index says how
// many jobs are waiting. They press its red Stop all, the app asks first — they
// back out once, and nothing stops — then they press it again and confirm. Past
// jobs holds the three, stopped, and the tile reads nought with no Stop all left
// on it.
//
// WHY THIS EXISTS. The owner asked for exactly this on the phone's Settings
// index: "one red Stop all with a confirmation, and a count of what is queued".
// Stop all ends every job the reader has waiting — an admin's ends everybody's —
// so a press that did not ask first would be the most destructive single tap in
// the app, and a count that did not move would leave the reader guessing whether
// it had worked.
//
// WHAT NO OTHER TIER SEES. The compact tile exists only under the phone
// breakpoint, and every other tier runs at a desk's width. The dom tier draws the
// tile over a fake of the jobs routes; this is the one place a real Stop all
// reaches a real queue, and the tile, the confirm and Past jobs are all read back
// off a real server afterwards. And "asks first" is asserted by backing out: a
// confirm that stopped the jobs whatever the answer would still show a dialog.
//
// DECLARED EXCEPTIONS, and what each knows:
//   - TIPPANI_JOBS_HOLD=1, the server's test seam (internal/jobs/runner.go): the
//     worker claims nothing, so the three jobs stay waiting until they are
//     stopped. Offline — and every journey server is offline — each would
//     otherwise finish in milliseconds, before the tile could count it. The
//     server honours the switch ONLY while offline, so it cannot stall a real
//     deployment. Nothing a reader could do would hold a queue still.
//   - SETUP KNOWS `GET /api/books` and its `books`, `id` and `title` fields, and
//     `POST /api/jobs` with `kind: 'fill'` and `book_ids`, to queue three fills.
//     Queueing is not what is under test — stopping is — and three presses of
//     Fill gaps on three books is a-fill-i-start-keeps-its-place's journey three
//     times over.
//
// THE MUTATIONS, each restored before the next:
//   - Stop all without the confirm (stopAll in jobsSection.jsx skipping its
//     `ask`): red at "Stop all jobs?", which never appears.
//   - The tile's count dropped (the compact card drawing no waiting tally): red
//     at "3 waiting".
//
// It otherwise knows the words on the screen.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE, env: { TIPPANI_JOBS_HOLD: '1' } })

// Three of the real titles the curator keeps verbatim, so they survive a fixture
// rebuild. Three books because the server refuses the same fill queued twice.
const TITLES = ['On the Shortness of Life', 'The Idiot', "Grimm's Fairy Stories"]

it('on a phone the Jobs tile counts what waits, and Stop all asks before it stops them', async () => {
  const { books } = await app.setup('GET', '/books')
  for (const title of TITLES) {
    const { id } = books.find((b) => b.title === title)
    await app.setup('POST', '/jobs', { kind: 'fill', params: { book_ids: [id] } })
  }

  await app.goto('/settings')
  await app.see('3 waiting')

  // IT ASKS, AND BACKING OUT STOPS NOTHING.
  await app.press('Stop all')
  await app.see('Stop all jobs?')
  await app.see('The 3 waiting are stopped before they start.')
  await app.press('Cancel')
  await app.gone('Stop all jobs?')
  await app.see('3 waiting')

  // AND CONFIRMING STOPS ALL THREE.
  await app.press('Stop all')
  await app.see('Stop all jobs?')
  await app.press('Stop them')
  await app.see('0 waiting')
  // ABSENT, NOT GREYED: with nothing waiting there is nothing to stop.
  await app.gone('Stop all')

  // KEPT, EACH WITH ITS NAME. The Stopped chip narrows Past jobs to the jobs
  // that were stopped, and all three books are in it.
  await app.press('Jobs')
  await app.see('Past jobs')
  await app.press('Stopped')
  for (const title of TITLES) await app.see(title)

  // Not the state the presses left behind: a fresh page, asking the server.
  await app.goto('/settings')
  await app.see('0 waiting')
  await app.gone('Stop all')

  expect(await app.sideways(), 'the phone page slides sideways').toBe(0)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
