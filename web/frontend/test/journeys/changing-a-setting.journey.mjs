// A reader opens Settings, switches the interface language from English to
// Bengali, and the app they are looking at actually changes — every label in
// the navigation and on the page they are standing on, not a toast saying it
// worked. Then they leave and come back, because a preference that only lives
// in the React tree that set it is a preference that was never really kept.
//
// THEME WAS THE FIRST SETTING TRIED HERE AND IT WAS THE WRONG ONE: `app.see`
// reads rendered text, and a theme swap changes colour and paper grain, neither
// of which is a word. Language is the setting whose effect IS words — this app
// ships English and Bengali, and switching rewrites every label the shell
// draws, from the nav ("Home" becomes "হোম") to the Settings header itself
// ("Settings" becomes "সেটিংস"). That is a visible, assertable, and total
// change, and nothing about it depends on knowing which component owns the
// label or which key the translation lives under.
//
// WHAT A MOCKED RENDER OR A GO HANDLER TEST CANNOT SEE: this app's translations
// are loaded as raw text bundles at build time (`src/i18n.js` importing
// `internal/i18n/en.txt` and `bn.txt` with Vite's `?raw`) and swapped into a
// context the whole shell reads from. A jsdom test that renders one component
// with a `lang="bn"` prop handed to it directly proves that component CAN
// render Bengali strings; it never presses the real "Choose a language"
// control, never learns whether the picker the app actually draws offers
// Bengali at all, and never learns whether picking it repaints the nav bar the
// component under test does not include. A Go test that PATCHes the user's
// language preference at the API proves the SERVER will store the field; it
// says nothing about whether a person who opens the real Settings screen, presses
// the real control, and picks the real option ever sees a single word change,
// and nothing about whether the change is still there after they navigate away
// — which is the part a database write can look right on and a frontend can
// still get wrong by only ever touching its own in-memory state.
//
// THE RELOAD IS THE POINT FOR THE SAME REASON IT IS IN THE EDITING-A-QUOTE
// JOURNEY: before it, "Bengali is on screen" is also true of an app that only
// ever set a React state variable and told the server nothing. `app.goto`
// issues a real `page.goto`, a fresh network navigation and a fresh mount, not
// a client-side route change — so asking again after one is asking the server,
// not the page that just changed its own mind.
//
// AND EVERY CHECK HERE IS A PAIR, ENGLISH GONE AND BENGALI PRESENT, for the
// same reason an edit's old wording has to be checked gone and not just the new
// wording checked present: a settings screen that let the language setting
// leak — Bengali nav drawn over an English page still fetching its old copy,
// say — would still make a lone `see('হোম')` true.
//
// It ends by switching the language back to English, so the world this journey
// leaves behind is the one it found — a shared fixture, and a reader who did
// not ask for this journey should not open the app next and find it in Bengali.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader switches the interface language and it survives a reload', async () => {
  await app.goto('/settings')
  await app.see('Settings')
  await app.see('Home')

  await app.press('Choose a language')
  await app.press('বাংলা')

  await app.see('সেটিংস')
  await app.see('হোম')
  await app.gone('Settings')
  await app.gone('Home')

  // Not the React state the press left behind — a fresh navigation, asking the
  // server what it actually kept.
  await app.goto('/settings')
  await app.see('সেটিংস')
  await app.see('হোম')
  await app.gone('Settings')
  await app.gone('Home')

  // Leave the world as it was found.
  await app.press('ভাষা বাছুন')
  await app.press('English')

  await app.see('Settings')
  await app.see('Home')
  await app.gone('সেটিংস')
  await app.gone('হোম')

  await app.goto('/settings')
  await app.see('Settings')
  await app.gone('সেটিংস')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
