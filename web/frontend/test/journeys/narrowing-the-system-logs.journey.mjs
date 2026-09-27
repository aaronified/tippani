// An admin opens Settings › Jobs, types a word into the top bar, and the System
// logs card narrows to the lines holding it. They export "What is shown" and the
// file holds the line they are looking at, and not a line the word hid.
//
// WHY THIS EXISTS. The system log is every line the server prints and one per
// request, so without a keyword it is a column of requests with the one line an
// admin opened it for somewhere in the middle. The owner's omnibar rule says the
// bar searches what you are looking at — on this section, for an admin, that is
// the log — and "what is shown" is a promise about a file: the lines on the
// screen, no more and no fewer.
//
// WHAT NO OTHER TIER SEES. The Go tier proves GET /admin/logs.md narrows by `q`,
// and the dom tier proves the card builds an address holding the keyword. Neither
// can say that the word typed into the SHELL's bar reaches the card on this
// section, that the list and the file are cut by the same window — the browser's
// sense of "now" on one side, the server's clock stamping every line on the other
// — or that the file Chrome saves holds what the reader was looking at.
//
// THE TWO LINES ARE THE SERVER'S OWN, printed as it starts: "tippani listening
// on …", which the word keeps, and "config: data=…", which it hides. Both are in
// every journey server's log before the reader has pressed anything, so neither
// depends on which requests the app happens to make. The hidden one is seen on
// screen first, so its absence from the file is the filter's doing and not a
// line that was never there.
//
// IT FOUND A BUG ON ITS FIRST RUN, and the bug is the clock sentence above. The
// harness holds the browser at 1 January while the server stamps the real date,
// and the file came back as an empty block under a screen full of lines: the
// export was closed at the moment the BROWSER read the list. It ends at the
// newest line shown now, by that line's own stamp (SystemLogsCard).
//
// THE MUTATIONS, each restored before the next. Drop the keyword from the
// export's address alone (systemLogsURL in jobs.js sending `q` empty) and this
// goes red at the file: it holds the hidden line. Stop the bar reaching the card
// (Settings publishing its own search context on the Jobs section) and it goes
// red at the typing: the bar is "Search settings", and nothing is named "Search
// system logs". Close the file at the browser's moment again and it goes red at
// the kept line, missing from an empty block.
//
// It knows the words on the screen, and what is in the file it is handed.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const KEPT = 'tippani listening on http://127.0.0.1'
const HIDDEN = 'config: data='

it('an admin narrows the system logs from the top bar and exports what is shown', async () => {
  await app.goto('/settings/jobs')
  await app.see('System logs')
  await app.see(KEPT)
  await app.see(HIDDEN)

  await app.type('Search system logs', 'listening')
  await app.gone(HIDDEN)
  await app.see(KEPT)

  await app.press('What is shown')
  const file = await app.downloaded('system-log')
  expect(file.text, 'the export does not hold the line on the screen').toContain(KEPT)
  expect(file.text, 'the export holds a line the keyword hid').not.toContain(HIDDEN)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
