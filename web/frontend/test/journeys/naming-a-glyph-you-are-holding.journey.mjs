// A reader who has turned button words off holds one of the remaining glyphs,
// and the app tells them what it is.
//
// THE OWNER'S ASK: "all glyph buttons longpress toast thing". And the app had
// already PROMISED it — the Button labels row's own help text says "Hidden words
// are still read aloud by screen readers, and every glyph names itself on hover
// or long-press." The first half was true. The second was true of controls built
// on Tooltip and false of every button built on GhostButton, which is most of the
// verbs in the app: their words are clipped by the label preference and nothing
// was listening for a hold. A phone has no hover, so on the surface the owner
// actually uses there was no way to learn a glyph at all.
//
// WHY THE LABELS GO OFF FIRST, AND IT IS THE WHOLE INTEGRITY OF THIS CASE. With
// words showing, "Back up now" is on the screen already — so a `see` after the
// hold would pass over an app that does nothing when held, which is exactly the
// state before this change. Turning them off is what makes the words ABSENT, so
// the only way they can appear is the hold.
//
// WHAT NO OTHER TIER CAN SEE. The words are clipped in CSS, not removed: they
// stay in the DOM and in the accessibility tree on purpose, so every tier that
// reads markup still finds them and reports the screen as fine. It takes a real
// browser applying a real stylesheet — where `innerText` returns what is PAINTED
// — to tell a clipped word from a drawn one, and a real touch to fire the hold.
//
// THE MUTATION: drop the `hold` spread from PlayfulButton — or change its gate
// from `icon && !keepLabel` to `keepLabel` — and this goes red at the `see`
// after the hold, because nothing answers the press.
//
// It puts the preference back at the end: this is a shared fixture, and a reader
// who did not ask for this journey should not find their buttons wordless.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a reader holds a glyph button with its words hidden, and it names itself', async () => {
  await app.goto('/settings')
  await app.press('Theme')

  // Words off, which is the state this whole case is about.
  await app.press('Hide')
  expect(await app.chosen('Hide'), 'the label preference did not change').toBe(true)

  // A COLLAPSIBLE VERB, WHICH IS NOT THE SAME AS ANY OLD BUTTON. The Server
  // section's Back up now was the first target here and it was the WRONG one:
  // that button carries `keepLabel`, so it keeps its words at every width on the
  // standing rule that a primary or destructive act does. It never collapses, so
  // it has nothing to name and correctly answers no hold. Checks' "Look again" is
  // an ordinary verb and does collapse, which is the case this is about.
  await app.goto('/cleanup')

  // THE WORDS ARE CLIPPED, NOT REMOVED, AND THAT IS WHY THIS COUNTS RATHER THAN
  // ASKING `gone`. The label preference squeezes the button to 44px and its words
  // overflow out of sight — deliberately, so they survive in the accessibility
  // tree — and `innerText` reports text that overflow has hidden. So `gone` is
  // false over a screen where the reader can see nothing, which is exactly the
  // confusion this whole case is about, and a first draft of this journey failed
  // on it.
  //
  // What a reader gets that they did not have is the name IN A SECOND PLACE: a
  // bubble under the thumb. So the assertion is that holding adds one.
  const times = async () => ((await app.onScreen()).match(/Look again/g) || []).length
  const before = await times()
  expect(before, 'the button should be on this screen exactly once').toBe(1)

  await app.hold('Look again')
  expect(await times(), 'holding the glyph did not put its name on the screen').toBe(before + 1)

  // Leave the world as it was found.
  await app.goto('/settings')
  await app.press('Theme')
  await app.press('Auto')
  expect(await app.chosen('Auto'), 'the label preference was not put back').toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
