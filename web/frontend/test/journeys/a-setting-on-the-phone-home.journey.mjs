// A reader opens Settings on a phone and changes a setting WITHOUT opening a
// section — the theme, from the index itself — then walks into the section and
// finds the same choice waiting there.
//
// WHY THIS EXISTS. The phone's Settings home was five doors and then two-thirds of
// a screen's height of nothing beneath them, so the handful of controls a reader
// actually opens Settings for were always one press behind an empty surface. The
// owner's standing rule is what that breaks: "use the space available, think like
// the user, whatever will be used more needs to be up front." Each door now
// carries its section's main controls under it.
//
// WHAT NO OTHER TIER CAN SEE, and there are two things.
//
// FIRST, THE WIDTH. The cards exist only under the phone breakpoint — a desk has
// the tab row and the section side by side, where the same rows drawn twice would
// be the "a row says a thing once" rule broken by a shortcut to something already
// visible. Every other tier runs at desktop width and would pass over an index
// with nothing on it.
//
// SECOND, AND THIS IS THE ONE THAT COST A DEFECT: THE CONTROL IS INSIDE A ROW THAT
// IS ITSELF A BUTTON. A toggle nested in a <button> is a button inside a button —
// invalid markup, and in practice the outer one eats the press, so every control
// on this screen would have NAVIGATED instead of toggling. Nothing but a real
// press in a real browser can tell those apart: the control renders either way,
// the preference just never changes, and the reader lands in the section they were
// trying to avoid opening. That is why this journey presses and then asserts the
// VALUE, and why it checks it is still on the index afterwards.
//
// THE MUTATION. Put the controls back inside the row's <button> — or drop the
// `actions` from what Settings hands the rail — and this goes red at the first
// `chosen('Dark')`: with the nesting, the press navigates and the index is gone;
// with the actions dropped, there is no control to press at all.
//
// It ends by putting the theme back, so the shared fixture is left as it was
// found.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a reader changes the theme from the phone settings home, without opening a section', async () => {
  await app.goto('/settings')

  // The doors are all still there — the cards are a shortcut, not a replacement.
  await app.see('Theme')
  await app.see('Review')
  await app.see('Language and font')

  // AND THE CONTROL IS ON THE INDEX, with nothing pressed to reveal it. This is
  // the whole of what changed: before, reaching this toggle meant pressing Theme.
  expect(await app.chosen('Match system'), 'the shipped mode should be the chosen one').toBe(true)

  await app.press('Dark')
  expect(await app.chosen('Dark'), 'the press did not change the mode').toBe(true)

  // STILL ON THE INDEX. If the control were nested inside the row's button the
  // press would have walked into Theme instead, and the assertion above could
  // still have passed — the section draws the same toggle. The other four doors
  // being on screen is what says we did not go anywhere.
  await app.see('Review')
  await app.see('Server')

  // AND THE COLOURS OPEN, WHICH THEY DID NOT. The first cut of this card drew the
  // three colour doors and left the panel they open behind on the section page —
  // so pressing one set a state nothing rendered: "Clicking on those colours in
  // the theme area does nothing." A door is only a door if something is on the
  // other side, so this presses one and looks.
  await app.press('Accent')
  await app.see('Hide')
  await app.press('Hide')
  await app.gone('Hide')

  // THE SECTION AGREES. One preference, one writer: the card and the section page
  // draw the same control through the same save, so the section is where a reader
  // would notice if they had drifted apart.
  await app.press('Theme')
  expect(await app.chosen('Dark'), 'the section disagrees with the card that set it').toBe(true)

  // Not the state the presses left behind — a fresh navigation, asking the server.
  await app.goto('/settings')
  expect(await app.chosen('Dark'), 'the card wrote nothing the server kept').toBe(true)

  // Leave the world as it was found.
  await app.press('Match system')
  expect(await app.chosen('Match system')).toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
