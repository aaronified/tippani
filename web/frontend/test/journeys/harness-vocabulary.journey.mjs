// THE VOCABULARY'S OWN GUARANTEES, CHECKED.
//
// DECLARED EXCEPTION: this file knows about the HARNESS — that `press` exists and
// what it promises. It knows nothing about the app that any other journey does not.
// It is here because the vocabulary's value is entirely in its guarantees, and a
// guarantee nothing checks is a comment. If `press` quietly started taking the
// first of several matches, every journey in this directory would still be green
// and several would have become coin tosses — which is the failure the whole tier
// exists to end, reappearing one level down.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const shortWait = { timeout: 2000 }

it('refuses to press when several things share the name, rather than guessing', async () => {
  await app.goto('/')

  // Every card on Home carries a Copy. Which one a journey meant is not knowable,
  // so the only honest answer is to refuse and say so.
  await expect(app.press('Copy', shortWait)).rejects.toThrow(/are named exactly "Copy"/)

  // AND THE ERROR NAMES THEM, because "ambiguous" without the list sends somebody
  // to read the markup, which is the thing a journey is not supposed to do.
  await expect(app.press('Copy', shortWait)).rejects.toThrow(/They are: /)
})

it('says what IS pressable when the name matches nothing', async () => {
  await app.goto('/')
  const err = await app.press('Absolutely Not A Control', shortWait).catch((e) => e)
  expect(err.message).toMatch(/nothing a person could press is named/)
  // The list is the useful half: it is how somebody finds the name they meant.
  expect(err.message).toMatch(/What is there: .*button/)
})

it('takes the whole name when a shorter one would be ambiguous', async () => {
  await app.goto('/')
  // "Library 22 | 13" and "Home" are both reachable; the prefix picks the one nav
  // item, and nothing else on the screen starts with "Library".
  await app.press('Library')
  await app.see('Middlemarch')
})

it('types the way a person types, so the app notices', async () => {
  await app.goto('/')

  // ASSIGNING .value WOULD PASS A WEAKER TEST AND CHANGE NOTHING. React keeps its
  // own state; a box set from script fires no events, so the DOM and the screen
  // disagree and the app never searches. Reading the value back is not enough to
  // catch that — what catches it is that the app ACTS on what was typed.
  await app.type('Search everything', 'Middlemarch')
  expect(await app.valueOf('Search everything')).toBe('Middlemarch')

  // AND THE SEARCH IS SUBMIT-ON-ENTER, which this test assumed away in its first
  // draft: it typed and then looked for results that never came, because nothing
  // had been asked yet. Pressing Enter is what a person does, and it is why the
  // vocabulary has a key verb at all.
  await app.pressKey('Enter')
  await app.see('Middlemarch')

  // And the box can be emptied again.
  await app.type('Search everything', '')
  expect(await app.valueOf('Search everything')).toBe('')
})
