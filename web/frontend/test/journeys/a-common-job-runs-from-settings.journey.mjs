// A reader opens Settings › Jobs, finds "Fill gaps in every work" among the common
// jobs, never run on this library, and presses its Run. With no internet the fill
// walks the whole library at once and ends; the row then says how its last run
// went, offers Run again, and opens that run's log right there — a log that
// begins by saying how many works the fill found when it started.
//
// WHY THIS EXISTS. The owner's ask, 28 September: "add a list of common jobs,
// that can be restarted from there itself, and as such will have a persistent
// place." Before it, a fill of the whole library meant Select all on the shelf
// and a bar's verb, and "when did I last do that, and how did it go?" meant
// scrolling Past jobs for it.
//
// WHAT NO OTHER TIER SEES. The Go tier proves GET /jobs/common answers a row's
// last and current job and that a fill of {all: true} resolves the library when
// it runs; the dom tier proves the card draws a row it is handed and sends the
// row's params. Neither can say that the press on a real screen makes the job a
// real queue runs over this library, and that the same row, read back from the
// server afterwards, is where that run's end and its log are found — the two
// halves of the contract meeting on one row.
//
// NO HOLD. The fill runs, which is the point: the row's last run is what is asked
// about. Offline, every lookup is refused at the gate and the fill ends in
// seconds.
//
// DECLARED EXCEPTION: THE CLIPBOARD IS READ BACK through Chrome's permission for
// this origin (`overridePermissions`), because what a copy button promises is what
// lands on the clipboard, and a toast is only the app saying so.
//
// THE MUTATIONS. Delete the Run press and this goes red at the last-run door: the
// row goes on saying it has not been run. Take out runFill's `p.All` branch (the
// fill of every work then walks nothing) and it goes red at the log's first line,
// because a fill that never read the library says nothing of it. Drop the job
// log's own copy name (`copyLabel` in jobsSection.jsx) and it goes red at "Copy
// the log of", the button answering to System logs' "Copy these lines".
//
// It knows the words on the screen and, past the clipboard above, nothing else: no
// setup, no address but the screen's own.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a common job runs from its row in Settings › Jobs, and the row then shows its last run and log', async () => {
  await app.goto('/settings/jobs')
  await app.see('Common jobs')
  await app.see('Fill gaps in every work')
  // Nothing has run on this library yet, so every row says so and offers Run.
  expect(await app.said('Run Fill gaps in every work')).toBeTruthy()
  await app.see('Not run in the last 30 days')

  await app.press('Run Fill gaps in every work')

  // It ends, and its row says how, with Run again where Run was.
  expect(await app.said(/^Last run of Fill gaps in every work: Succeeded, /, { timeout: 30000 })).toBeTruthy()
  expect(await app.said('Run again: Fill gaps in every work')).toBeTruthy()

  // The last run opens its own log, here: the fill read the library as it started.
  await app.press('Last run of Fill gaps in every work')
  await app.see('every work in the library as the fill starts')

  // AND THAT LOG COPIES FROM ITS OWN CORNER, under its own name: System logs is on
  // this screen with a copy of its own, and two buttons of one name are a press
  // nobody can aim.
  await app.page.browserContext().overridePermissions(app.baseUrl, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
  await app.press('Copy the log of')
  await app.see('copied')
  const copied = await app.page.evaluate(() => navigator.clipboard.readText())
  expect(copied, 'the clipboard does not hold the job\u2019s log').toMatch(/every work in the library as the fill starts/)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
