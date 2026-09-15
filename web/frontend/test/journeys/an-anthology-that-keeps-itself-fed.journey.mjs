// A reader makes an anthology out of a search, says keep it fed, and what they
// write afterwards is waiting for them.
//
// THIS IS THE ASK, AND IT HAD NO TEST. The owner's words: "I need auto anthology
// support: like adding one from a search result. all future entries in the search
// will also flow there automatically." Two halves — the rule, and the *later* — and
// the full suite passed with both of them disabled: hard-coding the form's rule to
// `''`, or `auto` to `false`, changed nothing any test noticed. A guard that cannot
// fail is a guard the next person trusts, so this is the one that dies.
//
// IT ALSO COVERS THE DOOR THE OWNER SAID WAS MISSING. "a version of this already
// exists, but cannot be accessed from the anthology add menu" — the press of
// "Fill from a search" below is on the NEW-anthology form, which is where it was
// not. `gathering-a-search` covers the other route they named, the search screen's
// own menu.
//
// WHY A QUOTE IS WRITTEN FIRST AND THEN A SECOND ONE. "Keep it fed" cannot be seen
// on the fill itself: the fill takes everything matching, so nothing is waiting the
// moment it finishes, and an anthology with auto ON and auto OFF look identical
// until something NEW matches. So the second quote is the whole point — it arrives
// after the anthology was made, and only an anthology that was told to keep looking
// offers it.
//
// THE MUTATIONS, all three verified: force the rule to '' and the anthology comes
// out empty (the first `see` of the line fails); force `auto` to false and the
// "Add 1 waiting" offer never appears; skip the second quote and it never appears
// either.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// A word the fixture's generator cannot produce — its invented prose runs on
// alder, bramble, cobble, ember and the like — so a match is never a coincidence.
const FIRST = 'The narwhal keeps its own counsel.'
const SECOND = 'A second narwhal, arriving later than the first.'

async function writeAProverb(line) {
  await app.goto('/quotes')
  await app.press('Add or import')
  await app.press('A quote')
  await app.press('Proverb')
  await app.type('Quote', line)
  await app.press('Save')
  // The capture form is gone, which is the app's own signal that Save ran.
  await app.gone('Show every field')
}

it('an anthology told to keep itself fed offers the quote written after it was made', async () => {
  await writeAProverb(FIRST)

  // THE DOOR ON THE NEW-ANTHOLOGY FORM.
  await app.goto('/anthologies')
  await app.press('New anthology')
  await app.type('Title', 'Narwhals')
  await app.press('Fill from a search')

  // The rule is written in the search screen's own box — the same component, so a
  // rule cannot ask a different question from the bar showing the same words.
  await app.type('Search', 'narwhal')
  // KEEP IT FED. Without this press the anthology is a one-off gather.
  await app.press('On')
  await app.press('Save')
  await app.press('Create')

  // The fill took what already matched.
  await app.press('Narwhals')
  await app.see(FIRST)

  // NOW SOMETHING NEW MATCHES, written after the anthology existed.
  await writeAProverb(SECOND)

  // And the anthology is holding it out to be taken. It is an OFFER and not an
  // arrival: the count is a control the reader presses, because an anthology that
  // grew by itself is a change that happened while they were not looking.
  await app.goto('/anthologies')
  await app.press('Narwhals')
  await app.see('Add 1 waiting')

  // Pressing it is what actually adds, and then the line is in the reading order.
  await app.press('Add 1 waiting')
  await app.see(SECOND)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
