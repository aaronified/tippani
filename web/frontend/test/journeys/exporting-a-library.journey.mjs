// A reader takes their whole library out of the app, and separately takes one
// quote board out of it, because both are theirs and an app that only lets you
// look at your own words is not really letting you keep them. This journey
// presses Export on Library, confirms the dialog, and checks that the file
// Chrome actually received has a book they know by name and its author. Then it
// does the same thing one level down: open a fixed quote board, export it, and
// check the proverb they know by name is in that file too.
//
// WHAT IT WOULD CATCH THAT NOTHING CHEAPER WOULD. A jsdom render of the export
// dialog can assert the button is there and the confirm text is right, but the
// mock stands in for the network — there is no server on the other end to
// stream real Markdown back, so a jsdom test cannot show a "successful" export
// that actually hands the reader an empty or truncated file. A Go handler test
// on `internal/httpapi`'s export endpoint can assert the HTTP response carries
// the right bytes; it cannot show that pressing the button IN THE BROWSER ever
// reaches that endpoint, or that what Chrome's download manager wrote to disk is
// what the response body actually was. This journey is the only one of the three
// that presses the real Export button, waits for the real streamed download, and
// reads the real bytes that landed on the filesystem. It is also the only one
// that can catch the specific failure mode the download plumbing exists to
// avoid: `capture.mjs`'s `downloadPost` turns the response into a blob and
// revokes its object URL on a timer, so a screen that says "exported" while the
// blob was already GC'd or truncated reads, to everything except this tier, as a
// success — the file on disk is the only place that failure would show.
//
// WHY THE ASSERTIONS ARE ONLY TRUE AFTER THE PRESS. Before either Export button
// is pressed there is no file in the download directory at all — `downloaded`
// polls for one and throws, naming what actually landed, if none ever does. So
// `app.downloaded(...)` succeeding is already proof a file arrived; checking
// its title and author beyond that is proof the file has the reader's actual
// library in it rather than an empty shell with a header, which is exactly the
// shape of bug a screen that flips to "Exported" on the click handler alone,
// without waiting on the stream, would produce.
//
// 'The Idiot' / 'Fyodor Dostoyevsky' and the English Proverbs board's own
// 'Necessity is the mother of invention' are the fixed points named in this
// repo's journey-writing brief — they survive a fixture rebuild where every
// other title and quote here is generated fresh each run. Nothing else in this
// file names a title, an author, or a quote that could regenerate out from under
// it.
//
// NEVER THE '- date:' LINE. The export's date is stamped by the server's own
// clock at write time, which this harness does not freeze (only the page's
// clock is frozen) — asserting it would be asserting today's date against
// itself, not against the app.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader exports their whole library and the file holds their books', async () => {
  await app.goto('/library')

  await app.press('Export')
  await app.see('Export library')

  // The confirm dialog's own button carries the same name as the one that
  // opened it — the screen puts one "Export" in front of the reader at a time,
  // and the harness's own surface-scoping is what lets this second `press` find
  // the dialog's button rather than refusing as ambiguous.
  await app.press('Export')

  const file = await app.downloaded('tippani-books')

  expect(file.text.length, 'the exported library should be a real file, not an empty shell').toBeGreaterThan(1000)
  expect(file.text, 'a book the reader knows should be in the export by title').toContain('The Idiot')
  expect(file.text, "that book's author should be in the export too").toContain('Fyodor Dostoyevsky')

  expect(app.pageErrors()).toEqual([])
})

it('a reader exports one quote board and the file holds its quotes', async () => {
  await app.goto('/quotes')

  // The one board in the fixture with a fixed name and fixed quotes — every
  // other board here is generated prose that regenerates on a fixture rebuild.
  await app.press('English Proverbs')
  await app.see('Necessity is the mother of invention')

  await app.press('Export')
  await app.see('Export quotes')
  await app.press('Export')

  const file = await app.downloaded('tippani-quotes')

  expect(file.text.length, 'the exported board should be a real file, not an empty shell').toBeGreaterThan(100)
  expect(file.text, 'a quote the reader knows should be in the export by its own words')
    .toContain('Necessity is the mother of invention')

  expect(app.pageErrors()).toEqual([])
})
