// THE VOCABULARY'S OWN GUARANTEES, CHECKED.
//
// DECLARED EXCEPTION: this file knows about the HARNESS — that `press` exists and
// what it promises. It knows nothing about the app that any other journey does not.
// It is here because the vocabulary's value is entirely in its guarantees, and a
// guarantee nothing checks is a comment. If `press` quietly started taking the
// first of several matches, every journey in this directory would still be green
// and several would have become coin tosses — which is the failure the whole tier
// exists to end, reappearing one level down.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const shortWait = { timeout: 2000 }

// EVERY BLOCK ENDS THE SAME WAY, and it did not until the critic said so. These
// four presses and types drive the real app, so a screen that throws on mount
// while still LOOKING right would pass all four — React keeps the last good
// render around the error. The vocabulary's guarantees are worth nothing over a
// page that is on fire.
const nothingThrew = () =>
  expect(app.pageErrors(), 'the page threw while the vocabulary was being checked').toEqual([])


it('refuses to press when several things share the name, rather than guessing', async () => {
  await app.goto('/')

  // Every card on Home carries a Copy. Which one a journey meant is not knowable,
  // so the only honest answer is to refuse and say so.
  await expect(app.press('Copy', shortWait)).rejects.toThrow(/are named exactly "Copy"/)

  // AND THE ERROR NAMES THEM, because "ambiguous" without the list sends somebody
  // to read the markup, which is the thing a journey is not supposed to do.
  await expect(app.press('Copy', shortWait)).rejects.toThrow(/They are: /)

  nothingThrew()
})

it('says what IS pressable when the name matches nothing', async () => {
  await app.goto('/')
  const err = await app.press('Absolutely Not A Control', shortWait).catch((e) => e)
  expect(err.message).toMatch(/nothing a person could press is named/)
  // The list is the useful half: it is how somebody finds the name they meant.
  expect(err.message).toMatch(/What is there: .*button/)

  nothingThrew()
})

it('takes the whole name when a shorter one would be ambiguous', async () => {
  await app.goto('/')
  // "Library 22 | 13" and "Home" are both reachable; the prefix picks the one nav
  // item, and nothing else on the screen starts with "Library".
  await app.press('Library')
  await app.see('The Idiot')

  nothingThrew()
})

it('types the way a person types, so the app notices', async () => {
  await app.goto('/')

  // ASSIGNING .value WOULD PASS A WEAKER TEST AND CHANGE NOTHING. React keeps its
  // own state; a box set from script fires no events, so the DOM and the screen
  // disagree and the app never searches. Reading the value back is not enough to
  // catch that — what catches it is that the app ACTS on what was typed.
  await app.type('Search everything', 'Dostoyevsky')
  expect(await app.valueOf('Search everything')).toBe('Dostoyevsky')

  // AND THE SEARCH IS SUBMIT-ON-ENTER, which this test assumed away in its first
  // draft: it typed and then looked for results that never came, because nothing
  // had been asked yet. Pressing Enter is what a person does, and it is why the
  // vocabulary has a key verb at all.
  await app.pressKey('Enter')
  await app.see('The Idiot')

  // And the box can be emptied again.
  await app.type('Search everything', '')
  expect(await app.valueOf('Search everything')).toBe('')

  nothingThrew()
})

// `chosen` REPORTS A STATE, AND ITS THIRD ANSWER IS THE ONE THAT MATTERS. A
// control that announces nothing about itself gets `null`, not `false` — "this is
// not a toggle" and "this toggle is off" are different facts, and collapsing them
// would let a journey assert `false` against a plain button and pass while proving
// nothing about a control that never had a state to report.
it('reports a control that says nothing about itself as null, not as off', async () => {
  await app.goto('/')
  await app.press('Settings')
  await app.press('Theme')
  // A swatch is a real toggle and answers true or false.
  expect(await app.chosen('Cream')).toBe(true)
  expect(await app.chosen('Sepia')).toBe(false)
  // The section rail's rows are tabs, and a tab announces itself the same way.
  expect(await app.chosen('Theme')).toBe(true)
  // A one-shot verb is not a toggle and must not pretend to be one. Type opens a
  // panel; it has no state to announce, and it lives on the next section along.
  await app.press('Language and font')
  expect(await app.chosen('Type')).toBe(null)
})

// `choose` REFUSES AN OPTION THAT IS NOT OFFERED, rather than leaving the list on
// whatever it was showing. A silent no-op here is the worst failure this verb can
// have: the journey goes on asserting against the unfiltered screen, and passes.
//
// AND IT NAMES WHAT IS THERE, for the reason `press` does — "no such option"
// without the list sends somebody to read the markup.
it('refuses an option a list does not offer, and says what it does offer', async () => {
  await app.goto('/')
  await app.press('Metadata')
  await app.press('Works')

  await expect(app.choose('Which gap', 'no publisher', shortWait))
    .rejects.toThrow(/offers no option named "no publisher"/)
  await expect(app.choose('Which gap', 'no publisher', shortWait))
    .rejects.toThrow(/What it offers: /)

  // AND IT IS A LIST OF OPTIONS OR IT IS NOTHING. A text box is fillable too, and
  // choosing from one is a request the harness cannot honour — so it says which
  // kind of control it found rather than quietly doing nothing to it.
  await expect(app.choose('search…', 'anything', shortWait))
    .rejects.toThrow(/is not a list of options/)

  nothingThrew()
})
