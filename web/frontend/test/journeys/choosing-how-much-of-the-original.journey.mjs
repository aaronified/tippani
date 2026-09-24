// A reader wants English quotes shown with their translation first while every
// other language keeps the default.
//
// WHAT THIS GUARDS. Each language row draws the four choices as icons now — the
// owner: "The 4 repeated text buttons can be replaced with icons … So that each
// language can fit in one row." Icons that cannot be pressed by name, or a row
// that forgets its choice, would be the redesign losing the setting it exists for.
//
// THE MUTATION. Make a row's picker ignore the press and this goes red: "own
// setting" never appears, before or after the reload.
//
// It knows the words on the screen and the names the controls announce.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader sets one language to translation first and it stays that way', async () => {
  await app.goto('/metadata/languages')

  await app.press('English: translation first')
  expect(await app.chosen('English: translation first')).toBe(true)
  // THE ROW SAYS IT HAS A SETTING OF ITS OWN — a dot to an eye, and to a screen
  // reader the chooser's name, which is what this reads.
  await app.said('English, own setting')
  // The others follow the default and say nothing of their own.
  expect(await app.chosen('Hindi: quotation first')).toBe(true)

  await app.goto('/metadata/languages')
  await app.said('English, own setting')
  expect(await app.chosen('English: translation first')).toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
