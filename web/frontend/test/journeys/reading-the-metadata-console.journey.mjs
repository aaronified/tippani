// A reader opens the metadata console to see what their works are missing.
//
// WHAT THIS IS ACTUALLY GUARDING. Every list in the app is being remade to draw
// its rows through one function, and the first thing that function decides is
// what goes on which line: the name alone on the first, the credit and the count
// on the second, and what is missing as chips under both. That arrangement is the
// whole point of the change — a name line that also carried " · Tagore · 12
// quotes" put its edge fade inside the punctuation, so reading the end of a long
// title meant dragging past the author — and nothing in the unit tiers can see
// it, because "which line is this on" is a fact about a rendered screen.
//
// SO IT ASSERTS THE LINES, NOT JUST THE WORDS. `see('Jacob Grimm')` passes just
// as well with the old single-line row, so three `see` calls would have been a
// file that could not tell the change from its absence. The regex below is what
// tells them apart, because it says the title ENDS a line and the credit begins
// the next one.
//
// THE MUTATIONS, and the third is the one that matters. (1) Delete
// `press('Works')` — red, because the metadata landing carries the section counts
// and no titles at all. (2) Delete the sub-line from RecordRow entirely — red, but
// on `see('Jacob Grimm and Wilhelm Grimm')`, which proves nothing about the
// arrangement: the credit is simply gone. (3) Put the name and the sub back on ONE
// line, which is the row this change replaced — the three `see` calls all stay
// GREEN and the regex is what fails. That is the pair this file exists to tell
// apart, and it is the only mutation that shows it.
//
// AND THE MUTATION HAS TO BE BUILT, which cost a wrong result before it cost a
// right one. This tier runs the real binary with `web/dist/` embedded in it, so
// editing `src/` and re-running the journey rates the PREVIOUS build: mutation (2)
// came back green the first time for exactly that reason. `make frontend` between
// the edit and the run is not optional here.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens the metadata console and reads what a work is missing', async () => {
  await app.goto('/')

  await app.press('Metadata')
  // NOT an assertion on the word "Metadata" — the rail item that was just pressed
  // carries it, so it was on the screen before the press and would survive the
  // press doing nothing. The console's own sections are what only arriving here
  // shows.
  await app.press('Works')

  // A PUBLIC-DOMAIN TITLE KEPT VERBATIM IN THE FIXTURE. Every invented title in
  // the golden library can change when the curator is re-run; the handful of real
  // ones cannot, so a journey pinned to one does not go red on a fixture rebuild
  // that changed nothing about the app.
  await app.see("Grimm's Fairy Stories")
  await app.see('Jacob Grimm and Wilhelm Grimm')
  // And what the console is FOR: the row says what this work is short of.
  await app.see('low-res cover')

  // THE ARRANGEMENT, which is the thing that changed. The title stands alone on
  // its line; the credit and the count share the one under it. A row that put all
  // three back on one line satisfies every `see` above and fails here.
  const screen = await app.onScreen()
  // THE COUNT IS A FIGURE AND A GLYPH SINCE THE SWEEP, so the sub-line ends at the
  // figure: "· 1" and a drawing that names itself "quote". What this assertion is
  // about is unchanged — which LINE each fact is on — and the noun's own presence
  // is asserted where it now lives, on the glyph.
  // AND THE MEDIUM'S WORD SITS ON THE TITLE'S OWN LINE ON A DESK — the owner:
  // "on desktop, these glyphs will also have the type name" — so the credit is
  // the line after "book", not the line after the title.
  expect(screen, 'the title and its credit should be on separate lines')
    .toMatch(/Grimm's Fairy Stories\s*\n\s*book\s*\n\s*Jacob Grimm and Wilhelm Grimm · 1\b/)
  expect(await app.said('quote'), 'the figure should say what it is counting').toBe('quote')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
