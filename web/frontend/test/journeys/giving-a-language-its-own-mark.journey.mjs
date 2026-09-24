// A reader gives Hindi a mark of their own from the one editor every language
// shares.
//
// WHAT THIS GUARDS. The mark picker used to open inline under a row, in whatever
// shape that language's letters made it; the owner: "each option opens up things
// in different shapes and sizes." It is one editor now — name, ISO code, one grid
// of marks — and a mark made there has to reach the row.
//
// THE MUTATION. Make the editor's save leave the mark out and this goes red: the
// row goes on drawing its script letter, and "✦" is nowhere after the reload.
//
// It knows the words on the screen and the names the controls announce.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader gives a language a mark of their own and the row wears it', async () => {
  await app.goto('/metadata/languages')
  await app.gone('✦')

  await app.press('Edit Hindi: name, code and mark')
  await app.press('Add a mark of your own')
  await app.type('Add a mark of your own', '✦')
  await app.pressKey('Enter')
  await app.press('Save')
  // THE EDITOR CLOSES WHEN THE SAVE HAS LANDED — it re-reads what is stored, then
  // writes — so wait for that, as a person does, before leaving the page: a
  // navigation straight after the press can abort the write in flight.
  await app.gone('Add a mark of your own')

  await app.goto('/metadata/languages')
  await app.see('✦')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
