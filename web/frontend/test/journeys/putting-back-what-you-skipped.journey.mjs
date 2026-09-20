// A reader tells the deck to stop asking about a line, then finds it again months
// later on the one screen that can say what they have quietly switched off — and
// puts it back.
//
// WHY THIS AND NOT A RENDER TEST. There is one, and it mocks the network: handed
// a list of groups it draws them, which proves the component can draw a list.
// What it cannot ask is whether the skip a reader actually performs — from a
// quote card's own menu, through `/annotations/bulk` — is the same fact this
// screen reads back. That split is exactly the shape this repo shipped a dead
// feature through: a client test right about its half, a server test right about
// its half, nothing comparing them.
//
// AND THE CARD IS A SHELF NOW, which is the second half of what this asserts. A
// column of titles asks a reader to recognise their own library from
// bibliographic data; the work's row carries its cover and the people behind it,
// with the quotes folded away until it is opened. So this journey looks for the
// AUTHOR on the settings screen, which is a fact no version of this card carried
// until the endpoint learned to send it.
//
// SETUP MAY USE THE API AND THIS ONE DOES NOT, on purpose: the skip is half of
// what is being asserted. A list that disagrees with the act it reports is the
// exact failure this screen exists to prevent.
//
// THE MUTATION: delete the `Art`/`People` fields from the group the server builds
// and `see('Jacob Grimm')` fails; make the work's row draw its quotes without
// being pressed and the `gone` before it fails; drop the `review: true` from the
// restore and the reload at the end fails, because the line is still skipped.
//
// "Grimm's Fairy Stories" FOR THE REASON EVERY JOURNEY HERE NAMES IT: it is one
// of the four public-domain titles the curator keeps verbatim through a fixture
// rebuild, and it carries exactly one quote — so a single "More actions" is
// unambiguous, which the harness requires rather than guessing between cards.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader skips a quote, finds the work on Settings, and puts it back', async () => {
  await app.goto('/library')
  await app.press("Grimm's Fairy Stories")
  // THE READER'S OWN PATH TO IT: put the book's quotes into selection, tick the
  // one, and use the bar's verb. It is the only place in the app that offers
  // "Skip in quiz" over a highlight, which is why the setup is three presses
  // rather than one — and setup through the API would not prove that the flag
  // this screen reads is the flag that press writes.
  await app.press('Everything this screen can do')
  await app.press('Select quotes')
  await app.press('Select this quote')
  await app.press('Skip in quiz')

  await app.goto('/settings/review')
  // THE WORK, WITH WHO WROTE IT. The title alone was the whole row until now, and
  // a title alone is what this change is about.
  await app.see("Grimm's Fairy Stories")
  await app.see('Jacob Grimm')
  await app.see('1 skipped')

  // AND THE QUOTE IS NOT ON SCREEN until the work is opened — six works' worth of
  // prose is not a list anybody reads their way down.
  await app.gone('must say B too')
  await app.press("Grimm's Fairy Stories")
  await app.see('must say B too')
  // Shut again, so the only "Put 1 back" on the screen is the selection's. The
  // work's own button says the same words inside the open card — deliberately,
  // because it is the same verb over the same quotes — and the harness refuses
  // an ambiguous name rather than guessing, which is what makes this closing
  // press part of the journey rather than a workaround.
  await app.press("Grimm's Fairy Stories")
  await app.gone('must say B too')

  // The tick box, then the one verb: this is the press a reader makes when a
  // whole run of lines was skipped by mistake, and it is what the card had no
  // way of offering before.
  await app.press('Choose everything skipped from ' + "Grimm's Fairy Stories")
  await app.press('Put 1 back')

  // AND IT IS THE SERVER THAT AGREES, not the page that just changed its own
  // mind. A reload is the only way to ask.
  await app.goto('/settings/review')
  await app.see('Nothing skipped')
  await app.gone("Grimm's Fairy Stories")

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
