// An admin opens Settings › Jobs, reads the server's own log on the System logs
// card, and takes away what the card shows, because a log is read by somebody
// else as often as by the person who found the problem: the file is what gets
// attached to the question.
//
// WHAT IT WOULD CATCH THAT NOTHING CHEAPER WOULD. "What is shown" is a window,
// and the screen and the server have to agree on where it is. They once did not:
// the screen set the window from the browser's clock, the server read it by its
// own, and a browser whose clock was behind the server's was handed a file that
// ended before the lines on the card, with none of them in it. A jsdom test sees
// the query the screen builds against a fake server's answer; a Go test sees the
// server answer a query somebody wrote by hand. Only a real browser against a
// real server shows the two clocks disagreeing, and this harness's browser
// disagrees on purpose: its clock is fixed at 2026-01-01 (harness/world.mjs), and
// the server's is the machine's.
//
// THE LINE IT LOOKS FOR IS THE READER'S OWN SIGN-IN. The harness signs in through
// the login form before the journey starts, and the server keeps every request
// as a line in its log, so "POST /api/auth/login" is on the card without this
// file arranging anything. It is looked for on the screen first: the file has to
// hold what the reader saw, and a line that is not on the card would prove
// nothing about the card.
//
// THE MUTATION. Put back the screen's old window, `from` and `to` from the
// browser's clock (jobs.js and jobsSection.jsx as they were), and this goes red:
// the server refuses a window that ends before it starts, and no file arrives.
// Against the server before its own half of the fix, the file arrived with no
// line in it.
//
// It knows the words on the screen, the names of the two presses, and that the
// file's name holds "tippani-system-log", which is what a reader is handed.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('an admin exports what the System logs card shows, and the file holds the lines on it', async () => {
  await app.goto('/')
  await app.press('Settings')
  await app.press('Jobs')

  await app.see('System logs')
  await app.see('POST /api/auth/login')

  await app.press('What is shown')
  const file = await app.downloaded('tippani-system-log')

  expect(file.text, 'the file should say it is the system log').toContain('# Tippani — system logs')
  expect(file.text, 'the sign-in on the card should be in the file of what the card shows').toContain('POST /api/auth/login')

  expect(app.pageErrors()).toEqual([])
})
