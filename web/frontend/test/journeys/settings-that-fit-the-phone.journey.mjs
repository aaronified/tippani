// A reader opens Settings on their phone, and the screen stays where they put it.
//
// WHAT WENT WRONG, AND THE OWNER PHOTOGRAPHED IT. The Language and font card's
// typeface row could not fit a 390px screen, so the style gear was pushed outside
// the card and the whole page slid left and right under a thumb — the top bar, the
// dock, every card and every row together, with the left edge of every heading cut
// off. "No out of bounds elements, please." The typeface row was cut from the web
// app (ADR-0936), so the first two cases below that measured it are gone; the
// index case and the System logs case stay, because that card is kept.
//
// WHY THIS IS A JOURNEY AND NOT A SCANNER. Nothing in the source is wrong to look
// at: it is what the two rules do TOGETHER, in a browser, at a width, with a face
// name long enough to matter. A source scanner reads one rule at a time and a
// picture of a page wider than its phone still looks like a picture of a phone —
// the shot is taken at the viewport and everything in it is merely positioned
// wrong. That is why `sideways` is a number: there is nothing on screen to read.
//
// AND IT HAS TO BE BUILT. This tier runs the real binary with `web/dist/` embedded,
// so a stylesheet edit that has not been through `make frontend` is not in the
// thing being measured.
//
// THE TEXT SIZE IS SET THROUGH THE API, NOT THE DIAL. The Text size dial was cut
// from the web app, but the app still applies whatever size the server holds
// (`applyTypeScale` on load), so the cases that need a size arrange it with the
// preferences endpoint and then read the page. That is setup, and the header names
// it: `PUT /auth/me/preferences` with `sizeDisplay`, `sizeUi`, `sizeMono` and
// `sizeHand`, each a percentage on the dial (75, 100, 125, 150, 175). Each case
// that changes the size puts it back to 100 when it has finished.
//
// THE THIRD CASE IS THE SYSTEM LOGS CARD AT THE LARGEST TYPE (3.1.0's card), ON THE
// SMALLEST PHONE, 320 wide. Its export row once held "Everything kept (30 days)",
// which at 175% ran past the card and slid the page, and whose glyph sat between
// the two lines once the label wrapped. On 30 September the owner cut the row to
// "What is shown" and "All", and neither label wraps in its button at 175% any
// more — 234px at most, measured at 320 and 390 in English and Bengali — so the
// two mutations this case used to name (the `.logs-export > .tp-btn` wrap rule out;
// the glyph put back beside its label) now stay green, measured, and those rules
// stay only for a translation that is longer. What the case guards now is the ROW:
// at 175% the pair is wider than a small phone's card and must wrap onto two lines
// rather than slide. THE MUTATION, run: `.job-actions`' `flex-wrap: wrap` made
// `nowrap` and this case goes red, "expected 28 to be +0", with the others green.
// It no longer asks whether the export glyph sits on its label's line: a rating
// moved the glyph out of its label and the case stayed green, because with no
// label wrapping there is no second line for the glyph to fall between.
//
// THE RELEASE LOG'S TWO CASES (#51, its door "Read the whole log" at 175% and 75%)
// were cut with the release log itself: the web app's Server section draws the
// update card and the system logs, and nothing else about releases beyond the
// version line. They are gone rather than pointed at another button, because the
// chevron rule they guarded belonged to that door.
//
// It knows the words on the screen and nothing else, and one number: how far the
// page slides (`sideways`). The size setup above is the one thing it knows beyond that.

import { beforeEach, expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

// EVERY CASE STARTS ON THE 390 PHONE: the third moves to 320 to find a label's
// limit, and the ones after it were measured at 390.
beforeEach(async () => { await app.page.setViewport(PHONE) })

// THE TYPE DIAL, SET THROUGH THE API (see the header). All four roles at once, the
// way the cut dial used to write them.
async function setType(factor) {
  await app.setup('PUT', '/auth/me/preferences', {
    sizeDisplay: factor, sizeUi: factor, sizeMono: factor, sizeHand: factor,
  })
}

it('the settings index does not slide sideways on a phone', async () => {
  await app.goto('/settings')
  await app.see('Language and font')
  expect(await app.sideways()).toBe(0)
})

// AFTER THE FIRST CASE, because it leaves the reader's type at the top of the
// dial; the cases after it set the dial themselves. A fresh page after the choice,
// so the size is the one the server kept, not only the one the page was drawn at.
it('the System logs card keeps its export buttons inside it at the largest type', async () => {
  await setType(175)
  // THE SMALLEST PHONE, 320 wide, where the pair is wider than the card at 175% and
  // has to wrap onto two lines rather than slide.
  await app.page.setViewport({ width: 320, height: 720 })
  await app.goto('/settings/server')
  await app.see('System logs')
  await app.see('What is shown')
  expect(await app.sideways(), 'the Server section slides sideways at 175% type').toBe(0)
  await setType(100)
})
