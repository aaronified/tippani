// A reader narrows the works console to the works with no synopsis, then to the
// ones that are finished.
//
// WHAT THIS GUARDS. The console's whole design is "see the library through what is
// MISSING from it, pick an issue and the list becomes only the works that have it"
// (`metadata.dc.html:850`). Three of the pack's seven issues were not offered:
// No people, No synopsis, and Complete. The last is the one a reader reaches for
// when they have finished a pass and want to see what they finished, and it cannot
// be a hand-written test of completeness — it is "every other filter would reject
// this", or it goes stale the day a gap is added.
//
// AND THE ROWS HAD TO LEARN TO SAY WHY. A film filtered to "no year" drew no chip
// at all, so the row printed `chipsEmpty` — the word "Complete" — under a filter
// that had selected it for being incomplete. The assertion below is on the chip as
// much as on the filtering, because a list that answers a filter with its own
// contradiction is worse than one that answers nothing.
//
// THE MUTATIONS:
//
//   (1) Delete the press of "no people" — red. The list stays at its full length,
//       and the assertion that narrowing narrows is what catches it.
//   (2) Make `ok` a hand-written predicate that forgets one gap — red on the
//       Complete step, because a work missing that gap is then listed as finished.
//   (3) Drop `no_synopsis` from a row's chip list — red on the chip assertion,
//       green on everything else: the filtering still works and the row stops
//       saying why it is there.
//
// AND THE FILTER IS A ROW OF PILLS NOW, not a combo box. The owner: "Works: well
// covered already. But pills." That is not a re-skin as far as this file is
// concerned — a pill CARRIES ITS COUNT, so every step below can assert the
// stronger thing the dropdown could not be asked: not only that narrowing narrows,
// but that it narrows to exactly the number the control promised before it was
// pressed. A pill saying 40 that lands on 3 is worse than a dropdown saying
// nothing, and the two numbers are computed in different places.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// The console prints how many rows are shown; this is that number.
//
// IT READS "3 works" NOW AND NOT "3 SHOWN", because the count was redrawn. The
// owner on the old one: "It looks bad. Design it better then, so that it
// integrates with the visual style." It was a grey uppercase mono label — this
// app's drawing for a count before it had one — and every other count had since
// moved to a figure wearing the glyph of what it counts. So it says the noun now,
// which is also what tells this assertion it is reading the WORKS console's count
// rather than some other number that happens to be on the screen — the bare noun
// was not enough, and a first pass of this read landed on 127 where the filter had
// left 41, because "works" appears more than once on this page.
async function shownCount() {
  const m = (await app.onScreen()).match(/(\d+)\s+works?\s+shown/i)
  expect(m, 'the console should say how many works it is showing').toBeTruthy()
  return Number(m[1])
}

// A PILL IS ITS WORDS AND ITS NUMBER, so pressing one means reading the number
// first — which is what a reader does too: the count is why they press it. The
// count is read off the screen rather than pinned, because the golden library is
// rebuilt by a curator and every one of these moves when it is.
//
// `\n<label>\n<digits>` AND NOT A LOOSE MATCH, because these words are drawn
// twice on the works console: once on the pill and once as a chip on every row it
// selected. The pill row is above the list, so the FIRST match is the pill — and
// the anchors keep a chip's words from being read as a count that follows them.
// The return value is the promise the press is then held to.
async function pressPill(label) {
  const seen = await app.onScreen()
  const m = seen.match(new RegExp(`\\n${label}\\n(\\d+)`, 'i'))
  expect(m, `the "${label}" filter should be on screen with its count`).toBeTruthy()
  const promised = Number(m[1])
  await app.press(`${label} ${promised}`)
  expect(await shownCount(), `the "${label}" filter left a different number of rows than it promised`)
    .toBe(promised)
  return promised
}

it('a reader narrows the works to what is missing, and to what is done', async () => {
  await app.goto('/')
  await app.press('Metadata')
  await app.press('Works')

  const everything = await pressPill('all')
  expect(everything, 'the fixture library should have works in it').toBeGreaterThan(0)

  // EVERY ROW SAYS WHY IT IS HERE. The chip is the row's own answer to the filter,
  // and a row that cannot give one draws `chipsEmpty` — the word "Complete" —
  // under a filter that selected it for being incomplete.
  await pressPill('no synopsis')
  // COUNTED, NOT MERELY PRESENT. The filter that was just pressed prints its own
  // words — it is a pill and the pill stays on screen — so `toContain` passed
  // with every chip deleted, matching the control that had selected them. The
  // rows have to say it too, and there are more rows than there is one pill.
  const chipped = (await app.onScreen()).match(/no synopsis/gi) || []
  expect(chipped.length, 'the rows should say why they were selected, not only the filter')
    .toBeGreaterThan(1)

  // ONE ISSUE, AND ONLY THE WORKS THAT HAVE IT. Not the synopsis, which nothing in
  // this library has: a filter every row passes cannot show that it filtered.
  const nobody = await pressPill('no people')
  expect(nobody, 'narrowing to one issue cannot leave the list its full length')
    .toBeLessThan(everything)
  expect(nobody, 'the fixture library has a work credited to nobody').toBeGreaterThan(0)

  // THE OTHER END OF THE SAME QUESTION, and the one that cannot be hand-written.
  // "Complete" is the absence of EVERY issue, so a work this library is missing
  // something from can never appear here — and it is missing a synopsis from all
  // of them. A predicate that forgot one gap would start listing works as done.
  expect(await pressPill('complete'), 'nothing in this library has a synopsis, so nothing is complete')
    .toBe(0)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND THE FILTERED SET IS WHAT THE BULK ACT REACHES.
//
// The pack's words: "Pick an issue and the list becomes only the works that have
// it, so the bulk fetch below acts on exactly those." The repo's bulk acts on the
// rows a reader has TICKED, which is a different safety model and the better one —
// a press that writes to a hundred records should be a press on a number you can
// see. "Select all shown" is what joins the two: it ticks exactly the filtered set,
// so the pack's sentence is one press away and the count is on the screen first.
//
// THE MUTATION: hand the flow `fillsOnly={false}` and this goes red on the title.
// The surface then says "Re-verify metadata" after a press on "Fetch empty
// fields", which is the surface contradicting the button — and a reader cannot
// tell from that whether the overwrites are hidden or simply absent.
it('the bulk fetch reaches exactly the works the filter left on the screen', async () => {
  await app.goto('/')
  await app.press('Metadata')
  await app.press('Works')

  const nobody = await pressPill('no people')

  await app.press('select all shown')
  // The bulk bar counts what it is about to act on, and it is the filtered set.
  await app.see(String(nobody))

  await app.press('Fetch empty fields…')
  // THE SURFACE NAMES THE ACT, not the flow it shares. Both bulk acts open one
  // review — the empty fields are what it ticks by default — so the only thing
  // telling a reader which of the two they pressed is the heading.
  //
  // CASE-SENSITIVE, AND THAT IS THE WHOLE TRICK. `see` folds case because
  // `innerText` reports text as rendered, and the bulk bar's button is rendered
  // in capitals — so `see('Fetch empty fields')` matched the button that had just
  // been pressed and passed with the flow headed "Re-verify metadata" behind it.
  // The heading is the only place those words are drawn as written.
  expect(await app.onScreen(), 'the surface should be headed by the act, not by the flow it shares')
    .toContain('Fetch empty fields')
  // AND THE OTHER HEADING IS RULED OUT, because one assertion about what IS on a
  // screen cannot say which of two headings a surface took.
  await app.gone('Re-verify metadata')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
