// A reader imports a file while the server's queue is busy, finds it waiting its
// turn in Settings → Jobs under the file's own name, stops it, and runs it again
// from there — without sending the file a second time.
//
// WHY THIS EXISTS. Until 3.1.0 an import ran in the request that uploaded it,
// beside whatever the queue was running, and Settings → Jobs learned of it only
// once it had finished. The owner's ask of that screen: "If any eligible action is
// run, a job will be created and queued … No action should skip through." So the
// upload is a job now, and "it waits its turn, and I can see and stop it" is the
// whole of what the reader was promised. And the owner's rule for a Stop — "it
// still shall not break anything" — means a stopped import has lost nothing: the
// server kept the file, and Run again finishes it.
//
// WHAT NO OTHER TIER SEES. The Go tier proves the route queues a job and the job
// stages the file; the dom tier proves the Import screen draws a waiting job it
// was handed by a fake. Neither can say that the job a real upload made, through
// a real multipart body, is the one Settings → Jobs reads back after a page load,
// under the file's name, and that Run again on it works from what the server kept.
//
// DECLARED EXCEPTION, and what it knows: TIPPANI_JOBS_HOLD=1, the server's test
// seam (internal/jobs/runner.go): the worker claims nothing, so every job queued
// stays waiting. Offline — and every journey server is offline — an import stages
// in milliseconds and there would be no waiting job to see. The server honours
// the switch ONLY while offline, so it cannot stall a real deployment. Nothing a
// reader could do would hold a queue still.
//
// THE MUTATIONS, each restored before the next:
//   - queueImport staging the file in its request and answering with the
//     staging, as an import did before it queued: red at "Waiting — next", since
//     the row says "2 quotes staged" instead.
//   - the first cut's rule put back: handleStopJob sweeping the spool after a
//     Stop, with sweepSpool keeping only waiting, running and interrupted
//     imports' uploads, so a Stop on a waiting import takes its file: red at
//     "Run again", which a stopped import is not offered once its file is gone.
//
// It otherwise knows the words on the screen, and the committed fixture file
// importing-a-file.journey.mjs describes.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ env: { TIPPANI_JOBS_HOLD: '1' } })

const HERE = dirname(fileURLToPath(import.meta.url))
const NAME = 'seneca-two-more.md'
const FILE = join(HERE, 'fixture', 'imports', NAME)
const WAITING = `Stop Import · ${NAME} (next)`

it('a file I import waits its turn in Settings → Jobs, and stopped, it runs again from what the server kept', async () => {
  await app.goto('/')
  await app.press('Add or import')
  await app.press('Files')
  await app.upload('Choose file', FILE)

  // THE ROW SAYS WHERE IT STANDS, and it has staged nothing yet.
  await app.see('Waiting — next')
  await app.gone('2 quotes staged')

  // AND THE READER LEAVES. A fresh page, asking the server.
  await app.goto('/settings/jobs')
  await app.see('Current jobs')
  expect(await app.said(WAITING), 'the import is not waiting under its file').toBeTruthy()

  // STOPPED BEFORE IT STARTS, and kept with its name.
  await app.press(WAITING)
  await app.see('Nothing is running or waiting.')
  await app.see('Past jobs')
  await app.press(`Import ${NAME}`)
  await app.see('Stopped')

  // AND OFFERED AGAIN: the server kept the upload, so nothing is sent twice.
  await app.press('Run again')
  await app.see('Started again')
  expect(await app.said(WAITING), 'Run again did not queue the import').toBeTruthy()

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
