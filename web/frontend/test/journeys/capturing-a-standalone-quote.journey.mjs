// Somebody hears a line worth keeping that came from no book and no film — a
// proverb, a speech, something a friend said — and files it on its own. The app's
// Add & capture surface asks first what KIND of thing is being added; picking "A
// quote" hands back a second question, "what kind of quote", because a standalone
// quote still needs a shape (speech, letter, essay, poem, song, proverb, other)
// even though it has no work to inherit one from. Only after both answers does
// the actual capture form — the words themselves, a board, a translation, a
// note, tags — appear. This journey walks that two-step gate the way a reader
// does: open Add, choose "A quote", choose a kind, type the line, Save, and then
// find the words again after a genuine page reload.
//
// WHAT IT WOULD CATCH that nothing cheaper would. A jsdom render with a mocked
// network can assert the kind-picker renders and the form renders after it, and
// a Go handler test can assert a POST body with no board id is accepted — neither
// can see whether pressing the buttons in order actually GETS to the form, or
// whether the app quietly defaults the quote onto a board when none was chosen.
// A capture whose "A quote" tile leads nowhere, or whose kind picker never hands
// off to the form, or whose Save fires with the wrong kind because the two-step
// selection was collapsed into one field somewhere upstream — all of these leave
// a mocked test green, because the mock is what would have answered the request
// instead of the real server. Only pressing the real buttons in the real browser
// and then asking the real database (via a reload) whether the words survived
// can catch that class of defect.
//
// THE RELOAD IS THE POINT, not politeness — see capturing-a-highlight.journey.mjs
// for the fuller argument. `app.goto` is a real browser navigation
// (`page.goto(..., { waitUntil: 'networkidle0' })`), not a soft client-side route
// change, so anything still visible afterwards came out of the server's answer to
// a fresh request, not out of React state that never forgot what was typed.
//
// THE LINE IS INVENTED FOR THIS RUN and is not proverb, speech, or line already in
// the library — so `app.see(LINE)` cannot be true before Save runs, and its being
// true afterwards is only explicable by the capture having worked. No timestamp
// is folded into it: each journey file gets its own copy of the fixture, so
// nothing here needs to be unique across runs, only distinctive enough that it
// cannot collide with anything the curator generated and plain enough that a
// failure message stays readable.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const LINE = 'A friend once told me: never trust a proverb you cannot repeat twice.'

it('a reader files a standalone quote through Add & capture, and it is still there after a reload', async () => {
  await app.goto('/quotes')

  // "Add or import" is the same header control every screen carries; on Quotes
  // it opens the same chooser the design pack calls Add & capture — "what are
  // you adding?" — with "A quote" as one of five tiles alongside a work, a
  // board, an anthology, and files.
  await app.press('Add or import')
  await app.press('A quote')

  // A standalone quote still needs a kind, because nothing upstream (no work,
  // no film) can supply one. This is the gate the mocked tests cannot see: the
  // real form only appears after this second choice lands.
  await app.press('Proverb')

  await app.type('Quote', LINE)
  await app.press('Save')

  // Save closes the form and drops the reader back on the Quotes board list.
  // "Show every field" only exists while the capture form is open, so waiting
  // for it to disappear is waiting for the modal itself to have gone — the
  // honest signal that Save actually ran, rather than a fixed sleep guessing
  // how long a real request takes.
  await app.gone('Show every field')

  // AND IT IS THE SERVER'S NOW. A fresh navigation back to Quotes — a real
  // browser reload, not a client-side route change — followed by opening "All
  // quotes", the one board every quote lands in regardless of which board it
  // was filed under: the only place the line can still be coming from is the
  // database, because nothing kept in memory survives `app.goto`.
  await app.goto('/quotes')
  await app.press('All quotes')
  await app.see(LINE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
