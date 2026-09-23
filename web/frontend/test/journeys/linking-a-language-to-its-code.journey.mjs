// A reader adds Ancient Greek to their languages by finding it in ISO 639-3, and
// the row keeps the registry's code.
//
// WHAT THIS GUARDS. The owner: "these languages are supposed to be from the ISO
// languages list (the larger 3 digit list). I do not see that association
// anywhere." A language row was a free-text name and nothing else — Ancient Greek
// could not be told from Modern Greek, and a language with no two-letter code
// could not be named precisely at all. Adding one is now a search of the whole
// registry, and the code it carries is on the row.
//
// WHY ANCIENT GREEK. Its code, grc, is not a run of letters inside its name, so
// seeing "grc" is seeing the code and not the name again — "Bengali" would pass a
// search for "ben" by itself.
//
// THE MUTATION. Drop the code from what the add saves and this goes red: the row
// appears, but after the reload it reads "no ISO code" and "grc" is nowhere.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader adds a language from the ISO 639-3 list and it keeps its code', async () => {
  await app.goto('/metadata/languages')

  await app.press('Add a language')
  await app.type('Find a language', 'Ancient Greek')
  await app.press('Ancient Greek (to 1453) (grc)')
  await app.see('Ancient Greek')

  // A RELOAD, so the code is what was STORED and not what the screen remembered.
  await app.goto('/metadata/languages')
  await app.see('Ancient Greek')
  await app.see('grc')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
