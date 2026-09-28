// An admin starts a factory reset while the server's queue is busy: the copy the
// reset asks for first waits its turn and says so, with a Stop beside it, and
// stopped, it leaves the reset where it was and is kept in Past jobs as stopped.
//
// WHY THIS EXISTS. The owner, on restore and reset: an admin "must take a backup
// and download it before this can be done"; and, of the queue, that "every
// backup" queues. So from 3.1.0 the copy is a job, and step one of the reset and
// of the restore follows it: the reader is told where it stands while it waits,
// can stop it there, and the prompt goes no further until a copy is down. The Go
// tier proves the job is queued, sealed outside the backups and handed over once;
// the dom tier proves the step draws a job it was handed by a fake. Neither can
// say that the job a real press made, on a real server with other work ahead of
// it, is the one the step shows waiting and the one its Stop ends, and that Past
// jobs then keeps it.
//
// DECLARED EXCEPTIONS, and what each knows:
// - TIPPANI_JOBS_HOLD=1, the server's test seam (internal/jobs/runner.go): the
//   worker claims nothing, so every job queued stays waiting. Offline — and every
//   journey server is offline — the copy is sealed in milliseconds and there
//   would be no waiting copy to see. The server honours the switch ONLY while
//   offline, so it cannot stall a real deployment. Nothing a reader could do
//   would hold a queue still.
// - the admin's password, from TIPPANI_JOURNEY_PASS, as the reset journey reads
//   it: no screen prints a password.
//
// THE MUTATIONS, each restored before the next:
//   - the step's streamed download put back (the file saved from the press's own
//     answer, as before the copy queued): red at "Waiting — next", since the press
//     is answered with a job and the step says "Backup failed".
//   - the step's Stop taken out: red at "Stop the copy", which nothing on the
//     screen is named.
//
// It otherwise knows the words on the screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({ env: { TIPPANI_JOBS_HOLD: '1' } })

it('the copy a reset asks for waits its turn with a Stop, and stopped, it is kept as stopped', async () => {
  await app.goto('/profile')
  await app.press('Reset all data…')
  await app.type('Your password, to seal the copy', app.account.password)
  await app.press('Download a backup first')

  // IT SAYS WHERE IT STANDS, and that it will download here.
  await app.see('Waiting — next')
  await app.see('downloads here when it is ready')
  await app.gone('Copy downloaded')

  // STOPPED WHILE IT WAITS: nothing was made, and the step is back where it began.
  await app.press('Stop the copy')
  await app.see('Stopped: no copy was made')
  await app.see('Download a backup first')
  await app.gone('Waiting — next')

  // AND PAST JOBS KEEPS IT, as the stopped job it is.
  await app.goto('/settings/jobs')
  await app.see('Past jobs')
  await app.press('Safety backup')
  await app.see('Stopped')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
