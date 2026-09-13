// A reader starts Practice from Home, reveals a card meant to be recalled
// rather than picked from a list, and says for themselves whether they knew
// it.
//
// A MOCKED RENDER OF THE QUIZ CARD CANNOT CATCH WHAT THIS DOES. Handed a
// canned card and told to grade it, it never presses the real "Start
// practice" button, never calls the real /review/practice or /review/answer,
// and never finds out whether revealing the card actually unlocks "Got it" /
// "Forgot" on the real screen rather than only in the component's own state.
// A Go handler test proves the SERVER can grade an answer; it has no browser
// and cannot say whether a person who presses "Got it" ever sees the word
// "recalled" — the one thing on the whole screen that tells them the app
// heard them.
//
// PRACTICE DEALS A RANDOM QUESTION FOR EVERY CARD (review_handlers.go), and
// only some of them are the kind you recall rather than choose or type. A
// reader who wants that kind does exactly what this does: presses "skip" —
// Practice's own control for "not this one" — until it deals a card with
// "Show me" on it, the same way anyone flipping through the deck would.
//
// It knows only the words on the screen — no route, no component, no field
// name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader reveals a practice card and says whether they recalled it', async () => {
  await app.goto('/')

  await app.press('Start practice')
  // The round has dealt its first card once something is there to skip past —
  // true of every question type Practice can deal, so this is the one signal
  // that waits for the fetch behind "Start practice" without guessing at a
  // card's own kind.
  await app.see('skip')

  let revealed = false
  for (let tries = 0; tries < 40 && !revealed; tries++) {
    try {
      await app.press('Show me', { timeout: 400 })
      revealed = true
    } catch {
      await app.press('skip')
    }
  }
  expect(revealed, 'Practice never dealt a card meant to be recalled in 40 draws').toBe(true)

  // Revealed, not yet graded: the source is on screen and the reader has not
  // said anything about it yet, which is what makes grading it next an honest
  // self-report rather than a formality the screen performs on its own.
  await app.see('Where is this from?')
  await app.see('Got it')
  await app.see('Forgot')

  await app.press('Got it')

  // ONLY TRUE AFTER GRADING. Before this press the card sat revealed and
  // waiting — nothing on screen said the reader had recalled it, "Got it" or
  // not. Delete the press above and this word never arrives.
  await app.see('recalled')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
