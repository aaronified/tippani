// A reader is partway through a book and stops to jot down a line worth keeping
// — then, on a later visit to that same book, finds it exactly where they left
// it.
//
// WHAT THIS CATCHES that a mocked jsdom render and a Go handler test cannot: the
// two halves working TOGETHER. A jsdom render of the capture form can prove the
// box takes typed text and the save control becomes pressable; a Go handler test
// can prove a POST against a book writes a highlight row. Neither proves that the
// button a reader actually presses on a real book page sends what was actually
// typed, that the server's own answer is what closes the form, or that the book
// page then goes and asks the server again for its own list rather than trusting
// whatever it already had sitting in memory. Only a real save through a real
// server, read back on a fresh look at the page, checks that whole chain.
//
// THE CENTRAL ACTION IS THE TYPE-AND-SAVE, and the assertion that is only true
// after it: the exact words just written, rendered back as one of the book's own
// highlights. A textarea's value is never part of a page's own rendered text —
// it lives on the box itself, not as anything `document.body.innerText` can see
// — so typing the words and deleting the save press would leave them nowhere
// `app.see` could ever find them. The highlight is generated fresh each run, so
// this cannot be passing on something the fixture already happened to contain.
//
// AND THE SECOND LOOK IS NOT REDUNDANT. Closing the form and re-drawing the list
// the reader was already standing on could pass on nothing but client memory —
// the form remembers what it just sent and could paint that back whether or not
// it ever reached the server. Leaving the book and pressing back into it forces
// a fresh fetch, which is the only way to tell "the server has this" apart from
// "this browser tab still remembers typing it".
//
// It knows the address it opens, the words and controls on screen, and nothing
// about a component, a route module, or a JSON field.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader captures a highlight on a book and finds it there when they come back', async () => {
  await app.goto('/')
  await app.press('Library')

  // ONE OF THE FOUR BOOKS THAT SURVIVE A FIXTURE REGENERATION. Every other title
  // in the library is invented fresh each run, so pinning to one of those would
  // break the day the curator ran again with nothing about the app at fault.
  await app.press('The Idiot')

  // On this book's own page the shell's one ＋ already knows which book it is
  // standing on — here it reads "Capture a quote" rather than the "Add or
  // import" it reads everywhere else — so pressing it does not ask which work
  // the highlight belongs to. It goes straight to the form.
  await app.press('Capture a quote')

  const highlight = `A line worth keeping — captured ${Date.now()}`
  await app.type('Quote', highlight)
  await app.press('Save')

  // ONLY TRUE AFTER TYPING AND SAVING: these exact words, now one of the book's
  // own highlights. Delete the press('Save') above and the words stay inside
  // the box they were typed into, which the screen's own text never carries —
  // so this is where the central action either happened or the journey goes red.
  await app.see(highlight)

  // AND STILL THERE ON A FRESH LOOK. Leaving the book and coming back forces a
  // real fetch rather than reusing whatever the save left sitting in memory —
  // proof the highlight reached the server, not just this render of the page.
  await app.press('Library')
  await app.press('The Idiot')
  await app.see(highlight)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
