// A reader opens each metadata console on their phone, and the screen stays where
// they put it.
//
// WHAT WENT WRONG, AND WHY NOTHING SAW IT. The three consoles laid themselves out
// at the width of their longest book title — 1235px inside a 390px screen — so the
// whole page slid left and right under a thumb: the top bar, the dock, every card
// and every row together, with a third of the screen empty at one end and the
// filter pills off the other. The cause was one missing line: the console's
// container could shrink and its children could not, so the app's own answer to a
// row that is too wide (a measured fade with a scroller inside it) never fired,
// because nothing above the row had been asked to narrow.
//
// IT SURVIVED A FULL CAPTURE RUN. A picture of a page three times too wide looks
// like a picture of a phone — the shot is taken at the viewport, and everything in
// it is simply positioned wrong — so forty screenshots were taken of this and read
// as fine. Only a measurement beside the picture caught it, which is why the
// harness's `sideways` verb is a number rather than a word: there is nothing on the
// screen to read.
//
// THE MUTATION. Take `.meta-body > * { min-width: 0 }` back out of index.css,
// `make frontend`, and all three cases go red with what the page actually slid:
// 638, 383 and 118 pixels past this fixture's 390 (the capture probe, against a
// larger library, measured 845). Delete any one `press` and that case
// goes green against the broken build too — the landing does not draw a console,
// so it does not overflow — which is why the press and the measurement are paired
// and neither is asserted alone.
//
// AND IT HAS TO BE BUILT. This tier runs the real binary with `web/dist/` embedded,
// so a stylesheet edit that has not been through `make frontend` is not in the
// thing being measured.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no preference key.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// THE CONSOLE IS OPEN, not the landing: the landing holds no rows, so it cannot
// overflow and a measurement taken there would pass on a broken build. The word
// beside each section is one of that console's own filter pills — proof the press
// arrived, and not a word the landing carries.
for (const [section, pill] of [['Works', 'no synopsis'], ['People', 'in no work'], ['Characters', 'no picture']]) {
  it(`the ${section} console does not slide sideways on a phone`, async () => {
    await app.goto('/metadata')
    // THE DOOR BY ITS WHOLE NAME: the index's issue pills start with the same
    // word now ("people with no portrait or link"), and `press` refuses to guess.
    await app.press(`${section} —`)
    await app.see(pill)
    expect(await app.sideways()).toBe(0)
  })
}
