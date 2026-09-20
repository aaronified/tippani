// The owner of a server wants to know whether a metadata supplier is answering —
// and finds out by pressing Test, rather than by adding a book and seeing what
// comes back thin.
//
// WHY THIS SCREEN NEEDED A LIST OF SUPPLIERS AT ALL. It drew one row per
// CREDENTIAL FIELD — a TheTVDB key, a TheTVDB pin — so a supplier that needs no
// key had no row, and "nothing is stored because nothing is needed" looked exactly
// like "nothing is stored and nothing will answer". A Go test can assert the
// endpoint's shape; only a person pressing the button can say whether the screen
// asks anything and whether it reports what came back.
//
// THE SERVER IN THIS WORLD RUNS WITH TIPPANI_OFFLINE=1, which is what makes the
// failing case assertable at all: the supplier is genuinely unreachable, the app
// says so on the row, and nothing leaves this container. A journey that needed the
// real internet to pass would be a journey that fails on a train.
//
// THE MUTATION: have the Test button call nothing (drop the POST in SourceRows'
// `test`) and the last assertion fails — the row goes on saying it has not been
// asked.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('an owner asks a supplier whether it answers, and the row says what came back', async () => {
  await app.goto('/metadata/sources')

  // THE SUPPLIER, WHAT IT SUPPLIES, AND HOW MUCH OF THIS LIBRARY CAME FROM IT.
  // A name on its own is the thing this list replaced.
  await app.see('Who the app can ask')
  await app.see('Google Books')
  await app.see('records supplied')
  // A supplier that needs no key of its own is on the list too, which is the
  // half a list of credential fields could not show.
  await app.see('Open Library')

  // Nothing has been asked yet, so nothing claims to have answered.
  await app.gone('did not answer')

  await app.press('Ask Google Books a test question')

  // AND THE ROW SAYS WHAT HAPPENED. This server is offline by construction, so
  // the honest answer is that the supplier did not answer — and the row saying so
  // is the whole point of the button.
  await app.see('did not answer')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
