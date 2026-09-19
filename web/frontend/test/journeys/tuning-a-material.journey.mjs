// A reader decides the page is too shiny and turns it down.
//
// WHAT THIS GUARDS. The dials are the one part of the theme work with a
// justification that rests on where the work happens: they were approved on the
// understanding that a number compiles to CSS once, at theme-apply time, and
// costs nothing at paint time. The pure tier proves the compilation; what it
// cannot prove is that a reader can reach the control at all — that the door is on
// the Theme section, that it names the materials the chosen set is actually
// wearing, and that a dial moved there is still moved when the panel is reopened.
//
// THE MUTATION. Delete the press on the door and it goes red: the dials are behind
// it, and the word this asserts is inside the panel rather than on the section.
//
// It knows the words on the screen and nothing else — no token, no tile name from
// the source, no preference key.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader opens the material dials and finds the set they are wearing', async () => {
  await app.goto('/')

  await app.press('Settings')
  await app.press('Theme')

  // Nothing about the materials' behaviour is on the section until the door opens
  // — which is the arrangement being asserted, not an incidental.
  await app.gone('Hardness')

  // The door's own words. The row is named for what is behind it — "What the
  // materials do with light" — and the button says what pressing it does, which is
  // the pair every door on this section now wears.
  await app.press('Open the dials')

  // The four dials, and the material they are about. Manuscript is the shipped
  // set and its page is paper, so that is the row a reader lands on.
  await app.see('Hardness')
  await app.see('Glow through')
  await app.see('Reflects the room')
  await app.see('Paper')

  // AND NOT A MATERIAL THE SET IS NOT WEARING. Offering all twenty-seven would be
  // a list mostly of things not on screen; the panel is about what you can see.
  await app.gone('Granite')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
