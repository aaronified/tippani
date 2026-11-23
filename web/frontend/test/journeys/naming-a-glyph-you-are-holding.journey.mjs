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
// WHY THE LABELS ARE OFF, AND IT IS THE WHOLE INTEGRITY OF THIS CASE. With words
// showing, a button's name is already on the screen, so a count taken after the
// hold would pass over an app that does nothing when held. The Button labels
// choice was cut from the web app (ADR-0936), but its default on a phone is
// already "off": `labelsPref()` is 'auto' and auto clips the words under the
// 768px breakpoint. So the phone this journey runs on has no words to show, and
// the only way the name can appear is the hold. The journey does not touch the
// preference at all, because there is no control left to touch it with.
//
// WHAT NO OTHER TIER CAN SEE. The words are clipped in CSS, not removed: they
// stay in the DOM and in the accessibility tree on purpose, so every tier that
// reads markup still finds them and reports the screen as fine. It takes a real
// browser applying a real stylesheet — where `innerText` returns what is PAINTED
// — to tell a clipped word from a drawn one, and a real touch to fire the hold.
//
// THE MUTATION: drop the `hold` spread from PlayfulButton — or change its gate
// from `icon && !keepLabel` to `keepLabel` — and this goes red at the count after
// the hold, because nothing answers the press.
//
// It knows only the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a reader holds a glyph button with its words hidden, and it names itself', async () => {
  // A COLLAPSIBLE VERB, WHICH IS NOT THE SAME AS ANY OLD BUTTON. A button that
  // carries `keepLabel` keeps its words at every width on the standing rule that
  // a primary or destructive act does, so it has nothing to name and correctly
  // answers no hold. Checks' "Look again" is an ordinary verb and does collapse,
  // which is the case this is about.
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

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
