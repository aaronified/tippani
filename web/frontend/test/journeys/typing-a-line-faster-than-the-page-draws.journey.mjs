// A viewer types a long line of dialogue into the capture form faster than the
// page can keep up, and every letter of it is in the box, saved, and still there
// after a reload.
//
// WHAT THIS GUARDS. CI run 36442773656 (3.1.0's main, attempt 1): the film-line
// journey typed "…the storm put half of them out." and the show's page listed
// "…the storm put hal of them out.", and the page had thrown React's error #185,
// "Maximum update depth exceeded". It passed on the re-run and six times out of
// six on a desk. The capture form re-published its Save to the surface's title
// bar on every letter, so every keystroke was two renders, the second queued for
// a turn of React's own. When the browser hands the page keystrokes faster than
// it gives React that turn, each keystroke's render ends with the second one
// still waiting, React counts them as one chain of nested updates, and past fifty
// it throws out of the next keystroke — which is lost. "hal" is the 52nd letter.
//
// WHY `type` CANNOT SHOW IT. `type` presses one key per round trip to the
// browser, and on a machine with time to spare the page gets its turn between
// any two of them. So a journey that only types passes on the broken form nearly
// every time, which is what happened.
//
// DECLARED EXCEPTION, THROUGH `app.page`: THE TYPING ITSELF. The line goes into
// the focused box inside the page, a letter at a time, by
// `document.execCommand('insertText')` — the browser's own way of putting typed
// text into a box, firing the `beforeinput` and `input` a keystroke fires — and
// between letters only the promise queue runs, never a task, so the page's own
// queued work waits exactly as it does on a busy machine. What it knows is the
// browser's event loop: no function, module, class or field of the app's. The
// first letter goes in through `type`, which is also what puts the caret there.
//
// THE LINE IS 150 LETTERS, three times what React counts to, so the form has to
// keep up for the whole of a real quote and not only for the first fifty letters.
//
// Mutations: with the draft put back in the dependencies of the effect that
// publishes the form's Save to the title bar, the box holds 148 of the 150
// letters — the 52nd is lost, and the 52nd after that — the page throws the
// maximum-update-depth error twice, and this fails at its first assertion. The
// form as 3.1.0 and 3.0.4 shipped it fails the same way, two letters short.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const LINE = 'Nobody on the ferry would say who lit the first lantern, or why the harbour kept every one of them burning through a winter with no ships to bring in.'

// Types into whatever has focus, and says what it typed into, so a caret that
// was not in a box fails here rather than as a missing line later.
async function typeFasterThanThePageDraws(text) {
  return app.page.evaluate(async (rest) => {
    const box = document.activeElement
    if (!box || !('value' in box)) return `the caret was not in a box (focus was on ${box?.tagName || 'nothing'})`
    for (const letter of rest) {
      document.execCommand('insertText', false, letter)
      await new Promise((settle) => queueMicrotask(settle))
    }
    return null
  }, text)
}

it('a viewer who types a long line faster than the page can draw keeps every letter of it', async () => {
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.press('Capture a line')

  await app.type('Quote', LINE[0])
  expect(await typeFasterThanThePageDraws(LINE.slice(1))).toBeNull()

  expect(await app.valueOf('Quote'), 'the box lost letters as they were typed').toBe(LINE)
  expect(app.pageErrors(), 'the page threw while the line was typed').toEqual([])

  await app.press('Save')

  // AND IT IS THE SERVER'S, after a fresh navigation: nothing the browser was
  // still holding can answer this.
  await app.goto('/catalogue')
  await app.press('A Serial In Several Parts')
  await app.see(LINE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
