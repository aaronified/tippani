// A reader changes the face their quotes are set in, on the screen that shows it
// — and then gives one language a face of its own, which is a different question.
//
// WHY THIS EXISTS. Every typeface in this app used to be behind a button called
// "Type": the section a reader opens to choose a face showed four specimens that
// picked nothing, and choosing cost four presses — the door, a role, a list, an
// option. Nothing failed while that was true. The suite asserted that the panel
// opened, and that the panel's own picker saved, and both were correct about
// their own half; no test ever asked whether a reader standing on Language and
// font could change a face. So this journey asks exactly that, in the number of
// presses a person would use: open the section, choose, done.
//
// AND THE SECOND HALF IS THE FEATURE THE FIRST ONE IS NOT. "I may want my german
// to have serifs, but not english" is a question about a LANGUAGE, and the app's
// answer used to be a face per SCRIPT — which cannot tell German from Swedish,
// both being Latin. The languages come from the library; the faces are chosen
// here; and a reader who wants a language that is not listed is sent to the table
// where a language is actually defined.
//
// THE RELOAD IS THE POINT. Before it, "the picker says Literata" is also true of
// a screen that only ever set a React state variable and told the server nothing.
// `app.goto` is a real navigation, so asking again after one is asking the server.
//
// THE MUTATION, ONE PER HALF, because a file with two tests needs two: delete the
// `json('PUT', …)` from FontSections' `save` and the first reload fails — the
// picker comes back on Newsreader. Delete the one in `QuoteFaces.saveFace` and the
// SECOND reload fails, which it did not before a rating pointed out that this half
// never reloaded at all.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader changes the face their quotes are set in, and it is still set after a reload', async () => {
  await app.goto('/settings')
  await app.press('Language and font')

  // The row names the job, and the control beside it names the face. Opening the
  // list and taking one is the whole gesture — nothing is opened before that.
  await app.see('Newsreader')
  await app.press('Typeface for Quotes')
  await app.press('Literata')
  await app.see('Literata')
  await app.gone('Newsreader')

  await app.goto('/settings')
  await app.press('Language and font')
  await app.see('Literata')
  await app.gone('Newsreader')

  // Leave the world as it was found: this is a shared fixture, and the next
  // journey did not ask for a library set in Literata.
  await app.press('Typeface for Quotes')
  await app.press('Newsreader')
  await app.see('Newsreader')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('and gives one language a face of its own, without touching the rest', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.press('Set fonts by language')

  await app.see('Quote fonts')
  // The languages are the library's own — this fixture holds quotes in English —
  // and each starts out following the face chosen above rather than having one.
  await app.press('Typeface for quotes in English')
  await app.press('Literata')
  await app.see('Literata')

  // AND THE ONE ABOVE IS UNTOUCHED, which is the half that makes this a different
  // setting rather than a second way to write the first.
  await app.press('Close')
  await app.see('Newsreader')

  // THE RELOAD, AND THIS HALF WAS MISSING IT. A rating found that: with the PUT
  // in the panel's own `saveFace` replaced by a bare `{ ok: true }`, both tests
  // in this file stayed green, because the only thing either of them asked after
  // choosing was the screen that had just changed its own mind. Per-language
  // faces had exactly the client-shape/server-shape split this directory's ruling
  // exists against — one mocked test asserting the patch, nothing asking the
  // server what it kept.
  await app.goto('/settings')
  await app.press('Language and font')
  await app.press('Set fonts by language')
  await app.see('Literata')

  // Back to following, so the fixture is as it was found. The panel is the one
  // the reload just opened, so there is nothing to open again.
  await app.press('Typeface for quotes in English')
  await app.press('Follows the Quotes face')
  await app.press('Close')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
