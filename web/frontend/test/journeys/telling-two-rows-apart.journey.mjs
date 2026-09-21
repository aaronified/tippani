// A reader looks up the sources for one particular work, out of a console of
// forty-four rows that all offer the same three glyphs.
//
// WHAT WENT WRONG. Every row's tick box had no name at all, and its edit, look-up
// and open buttons were named "Edit", "Look up" and "Open" — one row's worth of
// words, repeated forty-four times, with nothing tying any of them to the title
// printed beside it. An eye reads the glyph's position; everything else got a list
// of identical controls. The tooltip said more, and a tooltip is not a name: it
// needs a pointer and a hover, so it does not exist for a keyboard, a screen
// reader, or anything that has to choose between two of these.
//
// HOW IT WAS FOUND, which is the argument for this tier. The capture probe presses
// by accessible name and refuses an ambiguous one — it could not photograph the
// works look-up at all, and said "44 controls match". A defect nothing on the
// screen shows, reported by something trying to use the screen.
//
// THE MUTATION. Take {name} back out of metadata.row.lookup.aria (and the rest of
// that block), `make frontend`, and this goes red on the press itself: forty-four
// controls are named "Look up" and the harness refuses to guess which row it is
// on. Note that `see` alone would NOT go red — the picker's own words appear
// whichever row was pressed, which is why the press is the assertion here and the
// `see` only proves it landed.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens the look-up on the row they meant, not on whichever one came first', async () => {
  await app.goto('/metadata')
  await app.press('Works')

  // A PUBLIC-DOMAIN TITLE KEPT VERBATIM IN THE FIXTURE, the same one the console's
  // other journey pins to: an invented title can change when the curator is re-run.
  await app.see("Grimm's Fairy Stories")

  // THE PRESS IS THE ASSERTION. Naming the row in the control is the only reason
  // this can be said at all — one work out of forty-four, chosen by its title.
  await app.press("Look up Grimm's Fairy Stories")
  await app.see('Matches')

  // AND THE TICK BOX BESIDE IT, which had no name whatever — not a repeated one, a
  // missing one, so the harness could not even report it as ambiguous. Ticking one
  // row by its title is the only way to say that from outside the code, and the bulk
  // bar counting one is the app agreeing that the press landed where it was aimed.
  await app.press("Select Grimm's Fairy Stories")
  await app.see('1 selected')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
