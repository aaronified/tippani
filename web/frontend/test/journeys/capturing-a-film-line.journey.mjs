// A viewer is watching an episode, types out a line of dialogue, says which
// character speaks it, and finds both on that title's own page afterwards —
// still there after a reload.
//
// This is the film half of what capturing-a-highlight.journey.mjs already does
// for a book. A film's line is not a book's highlight with a different label: it
// carries a character, and that character is its own field — a token box, like
// the app's tag boxes, where what you type becomes a token when you confirm it.
//
// THIS FILE FOUND A REAL BUG AND NOW GUARDS THE FIX, which is why it has two
// cases rather than one. Typing a character and pressing Save WITHOUT confirming
// it with Enter used to lose the name silently: no error, no warning, and gone
// after a reload too. `TokenInput`'s own blur handler carries a comment promising
// that could not happen — it fired, and the value still did not arrive, because
// `save` is published upward to the host's title bar by an effect that runs after
// paint, and the blur that commits the token is the one caused by mousedown on
// Save. The closure the click ran was one render stale. `AddSurface.jsx` keeps a
// ref of the draft now, the way `usePanelStack` already did for the same reason.
//
// So the second case below is the quick path — type, press Save, never confirm —
// and it is the one that would go red if that ref were removed. The first is the
// careful path, and both have to work. The first pass writing this file also
// carried a quieter mistake worth naming: its character name
// ("The Harbourmaster") was a case-folded substring of its own quote text
// ("...the harbourmaster to agree"), so `see(CHARACTER)` passed whether or not
// the character was ever actually saved — the quote text alone satisfied it.
// The two strings below are deliberately unrelated words for exactly that
// reason.
//
// WHAT IT WOULD CATCH THAT NOTHING CHEAPER WOULD. A mocked jsdom render of the
// capture form can assert the fields it draws and the shape of the body it would
// post, but the mock is also the thing that would refuse a malformed post — it
// cannot show a Save that posts a line with the character silently dropped,
// because there is no real server on the other end to drop it. A Go handler test
// can assert the API accepts a { text, character } body; it cannot show that the
// screen's own Character control ever produces one, which is exactly the shape
// of bug bulk-season-and-episode.journey.mjs's header describes: a body a test
// asserts on both ends, with nothing pressing the button in between. And neither
// a mock nor a handler test can show a character surviving a full page reload,
// which is the only way to know the words came from the database and not from
// React still holding what was typed.
//
// THE RELOAD IS THE POINT. Without it, this passes on an app that renders the
// typed line and character straight back at you and posts nothing — the browser
// would still be holding both. After a fresh navigation the only place they can
// have come from is the server's own record of the line.
//
// IT USES "A Serial In Several Parts" BECAUSE THAT TITLE SURVIVES A FIXTURE
// REBUILD. Every other title in the Catalogue is invented by the curator and
// regenerates on a rebuild; this show and its six dialogue lines are the one
// stable title with a stable line count. The journey never names a generated
// title — it presses this fixed one and otherwise reads whatever the screen
// shows it.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// Distinctive enough that it cannot already be sitting in the fixture, and
// plain enough that a failure message reads clearly. No timestamp: each journey
// file gets its own copy of the fixture, so nothing here needs to be unique
// across runs.
// Deliberately unrelated to each other — see the header note on why a
// character name that happens to be a substring of its own quote text would
// make the character assertion pass even when the character was never saved.
const LINE = 'Nobody counted the lanterns until the storm put half of them out.'
const CHARACTER = 'Corvid Ashwright'

it('a viewer captures a line of dialogue with its character, and both are still there after a reload', async () => {
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.see('Capture a line')

  // The one ＋ on a title's own page already knows which title this is, so it
  // goes straight to the capture form rather than asking which title the line
  // belongs to.
  await app.press('Capture a line')

  await app.type('Quote', LINE)
  await app.type('Character', CHARACTER)

  // THE COMMIT, NOT JUST THE TYPING. The Character box is a token entry like
  // the app's tag boxes: what is typed into it only becomes part of the saved
  // line once Enter turns it into a token. Skipping this is exactly how the
  // first draft of this journey captured a line with no character attached.
  await app.pressKey('Enter')

  await app.press('Save')

  await app.see(LINE)
  await app.see(CHARACTER)

  // AND IT IS THE SERVER'S NOW. Everything above would pass on an app that
  // shows what was typed and posts nothing.
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.see(LINE)
  await app.see(CHARACTER)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// THE QUICK PATH, AND THE REGRESSION GUARD. A reader who types a character and
// goes straight for Save — never pressing Enter, never thinking about tokens —
// must keep the name. This is the case that was broken; delete the draft ref in
// AddSurface.jsx and this goes red while the careful path above stays green,
// which is exactly how the bug hid.
const QUICK_LINE = 'The lamps were lit early that winter, and nobody said why.'
const QUICK_CHARACTER = 'Perrin Vosschart'

it('a viewer who types a character and goes straight for Save keeps the name', async () => {
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.press('Capture a line')

  await app.type('Quote', QUICK_LINE)
  await app.type('Character', QUICK_CHARACTER)
  // No Enter. Straight to Save, which is what most people do.
  await app.press('Save')

  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.see(QUICK_LINE)
  await app.see(QUICK_CHARACTER)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
