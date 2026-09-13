// A reader notices a typo in a line they saved and fixes it through the app's own
// editor — and afterwards the old wording is gone, not merely hidden behind the
// new one.
//
// A MOCKED RENDER OF THE EDIT FORM CANNOT CATCH WHAT THIS DOES. Handed a quote
// object and told to render its editor, it never presses the real "More
// actions" menu a card actually offers, never finds the real "Edit" item inside
// it, and never learns whether the tick that is supposed to write the change —
// this app calls it "Save" — actually reaches PATCH/PUT on the quote or only
// updates whatever local state the mock started from. And a Go handler test
// that PUTs a new quote body straight at the API proves the SERVER can accept
// an edit; it says nothing about whether a person who opens the real menu, the
// real form, and presses the real Save ever gets there, or whether the screen
// behind the dialog is left holding the pre-edit words the whole time the form
// is deciding what to do. Both are exactly the "asserts its own half, presses
// nothing" shape this repo has already shipped a dead feature through once.
//
// THE RELOAD IS THE POINT, not politeness, and for a stronger reason here than
// in a capture journey: an editor that swaps the words on screen without
// writing them anywhere is invisible until you leave and come back. Before the
// reload, "the new wording is there" is also true of an app that only ever
// updated its own React state and posted nothing — so the second half of this
// journey re-fetches the book from scratch and asks again.
//
// AND ASSERTING ONLY THE NEW WORDING WOULD PASS ON AN APP THAT KEPT BOTH. A
// Save that appended a second copy of the quote, or that wrote the new text to
// a new row and left the old one sitting under it, would still make `see(new)`
// true. So every check here is a pair: the new sentence is there, AND the
// sentence it replaced is gone — read off the box itself before editing it, not
// retyped from a screenshot, so a fixture rebuild that changed the invented
// text underneath changes what this journey compares without ever breaking it.
//
// IT NAMES "Grimm's Fairy Stories" BECAUSE IT SURVIVES A FIXTURE REBUILD, the
// same reason every other journey in this directory pins to one of the four
// public-domain titles rather than an invented one. It carries exactly one
// quote, and that is what lets a single, unambiguous "More actions" reach it:
// every quote card in this app wears an identically named "More actions"
// button, so on a book with more than one the harness's own ambiguity rule (a
// name matching more than one control is a refusal, never a guess) would stop
// this journey from saying which quote it meant. A book with one quote is the
// only way to say that honestly with nothing but the words on screen — no
// class, no list index, no field name.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const CORRECTED = 'Whoever agrees to the letter A has already promised the letter B as well.'

it('a reader edits a quote and the old wording is gone after a reload', async () => {
  await app.goto('/library')
  await app.press("Grimm's Fairy Stories")
  await app.see('Jacob Grimm')

  // The card's own overflow menu, then the verb inside it — the same two
  // presses a reader makes, not a shortcut to a form the app would otherwise
  // reach some other way.
  await app.press('More actions')
  await app.press('Edit')

  // Read off the box itself, so the "gone" half of this journey compares
  // against whatever the fixture actually put there today rather than a string
  // typed into this file that a rebuild could quietly leave behind.
  const original = await app.valueOf('Quote')
  expect(original.length, 'the quote box came up empty, so there is nothing to edit').toBeGreaterThan(0)

  await app.type('Quote', CORRECTED)
  // "Save" is this editor's tick — the one that only lights once the box
  // actually disagrees with what is stored, which typing a different sentence
  // just made true.
  await app.press('Save')

  await app.see(CORRECTED)
  await app.gone(original)

  // AND STILL TRUE OF A FRESH FETCH, not the React state the button press left
  // behind. Leaving the book and coming back is the only way to ask the server
  // rather than the page.
  await app.goto('/library')
  await app.press("Grimm's Fairy Stories")
  await app.see(CORRECTED)
  await app.gone(original)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
