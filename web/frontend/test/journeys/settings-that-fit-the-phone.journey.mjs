// A reader opens Settings on their phone, and the screen stays where they put it.
//
// WHAT WENT WRONG, AND THE OWNER PHOTOGRAPHED IT. The Language and font card's
// typeface row could not fit a 390px screen, so the style gear was pushed outside
// the card and the whole page slid left and right under a thumb — the top bar, the
// dock, every card and every row together, with the left edge of every heading cut
// off. "No out of bounds elements, please."
//
// THE CAUSE WAS A CASCADE TIE, which is why reading the rule did not show it. The
// face chooser is `.tp-select.font-row-face` and the stylesheet said two things
// about it at the same specificity: the face gives up width, and every Select in
// the row holds its size. The later one won, the chooser kept its 228px, and the
// row overflowed. Both rules looked right on their own.
//
// WHY THIS IS A JOURNEY AND NOT A SCANNER. Nothing in the source is wrong to look
// at: it is what the two rules do TOGETHER, in a browser, at a width, with a face
// name long enough to matter. A source scanner reads one rule at a time and a
// picture of a page wider than its phone still looks like a picture of a phone —
// the shot is taken at the viewport and everything in it is merely positioned
// wrong. That is why `sideways` is a number: there is nothing on screen to read.
//
// THE MUTATION. Take the `:not(.font-row-face)` back out of index.css, run
// `make frontend`, and BOTH cases go red with what the page slid past this
// fixture's 390: 23 pixels on the index, 35 inside the section.
//
// THE INDEX GOING RED IS THE POINT, and a first draft of this comment said it
// would stay green. It does not, and the reason is the whole of why the owner saw
// this at all: the phone's Settings index carries each section's controls under
// its door, so the typeface row is drawn TWICE — once on the index and once in the
// section — and the card version overflows first, which is exactly where the
// photograph was taken. A claim about which case a mutation kills is worth nothing
// unless the mutation was actually run.
//
// The two cases still earn their places separately: the index measures the compact
// card, the section measures the full row, and the press is what tells them apart.
//
// AND IT HAS TO BE BUILT. This tier runs the real binary with `web/dist/` embedded,
// so a stylesheet edit that has not been through `make frontend` is not in the
// thing being measured.
//
// THE THIRD CASE IS THE SYSTEM LOGS CARD AT THE LARGEST TYPE (3.1.0's card). Its
// export row holds "Everything kept (30 days)", and a button never wraps its
// label, so at 175% on a 390 screen that one button ended past the card's inset
// and past the screen, and the page slid under it. The reader turns the type up
// the way a reader does, with the Text size dial, and then opens Jobs. THE
// MUTATION, run: take the `.logs-export > .tp-btn` rule back out of index.css and
// this case goes red, "expected 6 to be +0", with the other two green.
//
// AND THE WRAPPED LABEL KEEPS ITS GLYPH ON A LINE OF IT. Once the label wrapped,
// the export glyph, a flex item beside it, was centred on both of its lines at
// once, which is on neither, and squeezed narrower by the words. It is drawn
// inside the label now, as the label's first word. THE MUTATION, run: the glyph
// put back beside its label (jobsSection.jsx, the export anchors) and this case
// goes red at the glyph, "19px below the middle of the line nearest it", with
// the page still not sliding and the other two cases green.
//
// THE FOURTH AND FIFTH CASES ARE THE RELEASE LOG ON SERVER (#51). Its door, "Read
// the whole log", is a sentence on a button that ran 61px past a 390 screen at 175%.
// THE MUTATIONS, run: the `wraps-to-fit` class off that button and the fourth goes red,
// "expected 61 to be +0"; the glyph's one-line box (`.btn-icon { height: 1lh }`)
// taken out and it goes red at the chevron, 11px above its line; the first repair's
// rule put back (the glyph pinned to the top of a flex row) and the fifth goes red at
// 75% type, 4px above a one-line label, which offTheLine's quarter-line slack let
// through and its `slack: 2` does not.
//
// It knows the words on the screen and nothing else, and two numbers: how far the
// page slides (`sideways`) and which glyphs beside a label are off its lines
// (`offTheLine`).

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('the settings index does not slide sideways on a phone', async () => {
  await app.goto('/settings')
  await app.see('Language and font')
  expect(await app.sideways()).toBe(0)
})

// THE SECTION IS OPEN, not the index: the typeface row is inside the section, so a
// measurement taken on the index alone would pass over the broken build. The word
// is one the section carries and the index does not — proof the press arrived.
it('the typeface row keeps its buttons inside the card on a phone', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.see('Interface')
  expect(await app.sideways()).toBe(0)
})

// AFTER THE FIRST TWO, because it leaves the reader's type at the top of the dial;
// the cases after it set the dial themselves. A fresh page after the choice, so the
// size is the one the server kept, not only the one the dial applied to the page it
// was on.
it('the System logs card keeps its export buttons inside it at the largest type', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.choose('Text size', '175%')
  await app.see('175%')
  await app.goto('/settings/jobs')
  await app.see('System logs')
  await app.see('Everything kept (30 days)')
  expect(await app.sideways(), 'the Jobs section slides sideways at 175% type').toBe(0)
  expect(await app.offTheLine('Everything kept (30 days)'), 'the export glyph beside a label that wrapped').toEqual([])
})

// THE RELEASE LOG ON SERVER, AT THE SAME TYPE (#51). Its door is a sentence on a
// button, "Read the whole log (104 more)", and at 175% on a 390 screen it ended 61px
// past the screen and the page slid under it. Its chevron is drawn beside the words,
// so once they wrap it has to stay on the first line of them rather than between
// the two. The reader turns the type up with the same dial, then opens Server.
it('the release log keeps its door inside the phone at the largest type', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.choose('Text size', '175%')
  await app.see('175%')
  await app.goto('/settings/server')
  await app.see('Read the whole log')
  expect(await app.sideways(), 'the Server section slides sideways at 175% type').toBe(0)
  expect(await app.offTheLine('Read the whole log'), 'the chevron beside a label that wrapped').toEqual([])
})

// AND AT THE SMALLEST TYPE THE CHEVRON STAYS ON ITS ONE LINE. The first repair
// pinned the glyph's box to the top of the button, which put it on the first line
// of a wrapped label and 3.6px above a one-line label at 75%, where the line is
// shorter than the room the button's 44px floor leaves. offTheLine's own slack, a
// quarter of a line, is 4.3px there, so this asks for 2.
it('the release log keeps its chevron on its line at the smallest type', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.choose('Text size', '75%')
  await app.see('75%')
  await app.goto('/settings/server')
  await app.see('Read the whole log')
  expect(await app.offTheLine('Read the whole log', { slack: 2 }), 'the chevron beside a one-line label').toEqual([])
})
