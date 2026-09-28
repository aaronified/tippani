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
// It knows the words on the screen and nothing else.

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

// LAST, because it leaves the reader's type at the top of the dial. A fresh page
// after the choice, so the size is the one the server kept, not only the one the
// dial applied to the page it was on.
it('the System logs card keeps its export buttons inside it at the largest type', async () => {
  await app.goto('/settings')
  await app.press('Language and font')
  await app.choose('Text size', '175%')
  await app.see('175%')
  await app.goto('/settings/jobs')
  await app.see('System logs')
  await app.see('Everything kept (30 days)')
  expect(await app.sideways(), 'the Jobs section slides sideways at 175% type').toBe(0)
})
