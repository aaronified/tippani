// A reader whose interface face is set in capitals gives German its ß, and every
// mark still shows ß.
//
// WHAT THIS GUARDS. The owner, on their own library: "my German glyph is set at
// the beta looking thing, but the app draws 'ss' for German quotes." The mark
// inherited the interface face's case dials from the page, and case-mapping ß
// gives "SS" — so the one character a reader chose was replaced with two they did
// not, on every quote in that language. Nothing about the mark itself was wrong,
// which is why no test of the mark could see it: it takes the face's dial AND the
// mark together.
//
// HINDI STANDS IN FOR GERMAN because the fixture's proverbs are in Hindi and
// none is in German; the defect is in the character, not the language.
//
// THE QUOTE CARD IS THE ONE THIS CAN GUARD, and it is where the owner saw it.
// THE MUTATION: put `textTransform: 'var(--font-ui-case)'` back in LanguageMark
// and the quote's `see('ß')` fails — a folded "SS" is "ss", and "ss" is not "ß".
//
// THE LANGUAGE ROW'S TILE IS CHECKED HERE BUT NOT GUARDED, and saying so is the
// point of this paragraph. The first draft named a CSS rule as the row's
// mutation; deleting it left this green, because the tile is a <button> and the
// browser's own stylesheet already resets `text-transform` on buttons (measured:
// the tile reports `none` with the rule gone). What the rule still does is undo
// SMALL caps, and `innerText` reports small caps as the lower-case letters they
// are — so no sentence on the screen changes, and a journey cannot tell.

// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a mark keeps the character the reader chose when the interface is in capitals', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.press('Style modifiers for Interface')
  await app.press('All caps')

  await app.goto('/metadata/languages')
  await app.press('Edit Hindi: name, code and mark')
  await app.press('Add a mark of your own')
  await app.type('Add a mark of your own', 'ß')
  await app.pressKey('Enter')
  await app.press('Save')
  // THE EDITOR CLOSES WHEN THE SAVE HAS LANDED — it re-reads what is stored, then
  // writes — so wait for that, as a person does, before leaving the page: a
  // navigation straight after the press can abort the write in flight.
  await app.gone('Add a mark of your own')

  await app.goto('/metadata/languages')
  await app.see('ß')

  // AND ON THE QUOTE, which is where a reader meets it.
  await app.goto('/quotes/all')
  await app.see('जिसकी लाठी उसकी भैंस')
  await app.see('ß')

  // The account is shared with the rest of the worker's journeys; put the mark
  // and the face back.
  await app.goto('/metadata/languages')
  await app.press('Edit Hindi: name, code and mark')
  await app.press('Reset mark and name')
  await app.gone('ß')

  await app.goto('/settings')
  await app.press('Language and font')
  await app.press('Style modifiers for Interface')
  await app.press('All caps')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
