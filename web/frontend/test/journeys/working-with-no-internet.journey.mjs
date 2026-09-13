// A reader on a train with no signal adds a book by hand. There is no "you are
// offline" banner anywhere in this app, and this journey does not go looking for
// one and does not assert one — that message does not exist and inventing it
// here would be testing a screen that was never promised. What IS promised, by
// this being a self-hosted single-user tool rather than a service that leans on
// somebody else's API to function, is narrower and checkable: a reader can open
// the Add surface, type a title and an author themselves, save, and have the
// work sitting in their library afterwards, with no screen hanging on a lookup
// that has nowhere to go and no save silently refused because of it.
//
// EVERY JOURNEY SERVER RUNS WITH TIPPANI_OFFLINE=1 (see harness/server.mjs) —
// this journey arranges nothing extra to go offline, it is simply run the way
// every journey in this suite already is. What makes this one distinct is the
// PATH it walks: Add & capture's own "skip the lookup" branch, which exists
// precisely for the reader who cannot reach a provider and does not want to
// wait to find out.
//
// WHAT IT WOULD CATCH that nothing cheaper would. A jsdom render with a mocked
// network can assert the manual-entry form exists and can assert a submit
// handler fires — it cannot see whether the real chain of presses (Add or
// import → type a title → "skip the lookup" → pick Book → the actual TITLE and
// AUTHOR fields → Save) actually reaches that form in the running app, whether
// a real fetch to the (switched-off) metadata provider is on the critical path
// of that chain and therefore blocks or throws instead of being sidestepped, or
// whether an unhandled promise rejection from a lookup nobody asked for and
// nobody can reach surfaces as a thrown error on the page. A Go handler test can
// assert POST /api/works accepts a body with no external identifier — it cannot
// press a single button, so it cannot tell a form that never gets past its own
// search step from one that does. Only driving the real browser against the
// real (offline) server and then asking a fresh page load whether the work
// exists can catch that class of failure.
//
// THE RELOAD IS THE POINT, not politeness — see capturing-a-highlight.journey.mjs
// for the fuller argument. `app.goto` is a real browser navigation, not a
// client-side route change, so a title still on screen afterwards came out of
// the server's own answer to a fresh request, not out of React state that never
// forgot what was typed and never actually reached the database.
//
// THE TITLE AND AUTHOR ARE INVENTED FOR THIS RUN and match nothing the curator
// generates and nothing on the fixed list CLAUDE.md calls out — so
// `app.see(TITLE)` cannot be true before the manual form is ever opened, and its
// being true afterwards, on a freshly loaded Library, is only explicable by the
// entry having been typed, saved, and kept.
//
// Ending on `expect(app.pageErrors()).toEqual([])` is not a formality here: an
// unhandled rejection from a fetch this app refuses to make while offline is
// exactly the shape of bug a reader on a train would hit and a developer at their
// desk, with a real connection, never would.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const TITLE = 'The Lantern Diaries of a Reader Without Signal'
const AUTHOR = 'Mira Stanwick'

it('a reader with no internet adds a book by hand, and it is in the library after a reload', async () => {
  await app.goto('/library')

  // "Add or import" opens the same Add & capture chooser every screen carries.
  // It defaults straight to "A work" and asks WHICH WORK with a search box —
  // the one a reader with a connection would use to look a title up.
  await app.press('Add or import')
  await app.type('search your books, films & shows…', TITLE)

  // Nothing the (switched-off) provider would have answered comes back — no
  // suggestion tile appears bearing this invented title — and the app offers
  // exactly the way forward a reader with no signal needs: a button carrying
  // the words just typed, offering to add them as a new work without waiting
  // on a lookup that cannot resolve.
  await app.press(TITLE)

  // A kind is still asked (Book, Film, Show, Game), because nothing about an
  // offline add tells the app which of those this is — and the same "skip the
  // lookup" escape is offered here too, a second time, for the reader who did
  // not already know at the first screen.
  await app.press('Book')
  await app.press('Skip the lookup — add manually')

  // The actual manual-entry form: no ISBN, no provider match, just the two
  // fields a reader can supply from memory.
  await app.type('Title', TITLE)
  await app.type('Author', AUTHOR)
  await app.press('Save')

  // Save closes the manual form. Waiting for the form itself to be gone is the
  // honest signal that the save actually returned, rather than a fixed sleep
  // guessing how long a real (offline, so no external round trip) request takes.
  await app.gone('Add a book manually')

  // The library grid this reader was already looking at gained the new book —
  // still React state at this point, so this alone would not distinguish a real
  // save from an optimistic one.
  await app.see(TITLE)
  await app.see(AUTHOR)

  // AND IT IS THE SERVER'S NOW. A fresh navigation — a real browser reload, not
  // a client-side route change — is the only way the words below could still be
  // on screen if the save above had merely updated in-memory state and posted
  // nothing, or thrown and been swallowed.
  await app.goto('/library')
  await app.see(TITLE)
  await app.see(AUTHOR)

  // A refused fetch that is not on this critical path at all is exactly the kind
  // of thing that turns into an unhandled rejection rather than a screen that
  // hangs — this is the assertion that would catch it.
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
