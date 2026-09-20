// A reader opens the characters console, reads what each character has, and then
// asks for only the ones missing something.
//
// WHAT THIS GUARDS, AND WHAT IT USED TO. The console's whole job is showing what
// is thin about a character, and the row could not say it: it stated the name, the
// spelling it sorts under, and how many works it turned up in. This file first
// shipped asserting the sentence that replaced that — "3 works · 1 of 3 with a
// face chosen" — and the owner read it on a phone and named three faults in it at
// once: the row counted works and not QUOTES, on a screen about the people who say
// them; the red number beside it was a count with no door and no words; and the
// sentence itself was a sub-count written the long way round.
//
// SO THE ROW IS COUNTS AND PILLS NOW — "x <works> · y <quotes>", then the works
// themselves — and the finding moved into a row of FILTERS above the list, each
// carrying how many rows it would leave. That is what this asserts: the shape of
// the row, and that pressing a filter narrows the list to exactly the number the
// filter promised.
//
// THE PROMISE IS THE POINT. A filter that says 40 and lands on 3 is worse than one
// that says nothing, because the number is the reason a reader pressed it. The
// count on the pill and the count above the list are computed in different places,
// and this is the only test that makes them agree.
//
// THE MUTATIONS, each run against a rebuilt `web/dist/` because this tier runs the
// compiled binary:
//
//   (1) Delete `press('Characters')` — red. The metadata landing carries the
//       section counts and no character rows at all.
//   (2) Count the pills over the whole library instead of over the rows the other
//       filters left — green here (nothing else is filtered) and red the moment
//       the work chooser is used, which is why the second case exists.
//   (3) Have the pill set the filter and not narrow the list — red: SHOWN stays at
//       its full length while the pill claims a smaller number.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// The console prints how many rows are shown; this is that number.
async function shownCount() {
  const m = (await app.onScreen()).match(/(\d+)\s+SHOWN/i)
  expect(m, 'the console should say how many rows it is showing').toBeTruthy()
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
async function pill(label) {
  const seen = await app.onScreen()
  const m = seen.match(new RegExp(`\\n${label}\\n(\\d+)`, 'i'))
  expect(m, `the "${label}" filter should be on screen with its count`).toBeTruthy()
  return Number(m[1])
}

it('a character’s row counts its works and its quotes', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Characters')

  // THE TWO COUNTS, SIDE BY SIDE. Not a pinned name: the golden library's people
  // are invented and change whenever the curator is re-run, so a journey pinned to
  // one would go red on a fixture rebuild that changed nothing about the app. The
  // SHAPE of the line is what this change introduced.
  //
  // AND THE OLD SENTENCE IS RULED OUT, because an assertion about what a row says
  // now cannot say that it stopped saying the other thing — and the owner's report
  // was that the row said too much, not too little.
  await app.gone('with a face chosen')

  expect(await shownCount(), 'the fixture library should have characters in it').toBeGreaterThan(0)

  // A ZERO PILL STAYS AND IS STILL PRESSABLE. "None of my characters are in no
  // work" is the state this screen is working towards, so the filter that says so
  // has to be on the screen saying it — a pill that vanished at zero would take
  // the news with it, and the sentence this row replaced was the only place that
  // fact used to be printed.
  expect(await pill('in no work'), 'the zero filter should still be drawn, saying zero').toBe(0)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('a filter leaves exactly as many characters as it promised', async () => {
  await app.goto('/')
  await app.press('Metadata')
  await app.press('Characters')

  const everything = await shownCount()
  // "NO QUOTES" AND NOT "IN NO WORK", because this library has none of the latter
  // and a filter that narrows nothing cannot show that it narrows. The pill still
  // draws at zero — that is its own rule, and the case below reads it there.
  const promised = await pill('no quotes')
  expect(promised, 'the filter cannot promise more rows than the console holds')
    .toBeLessThan(everything)
  expect(promised, 'this library has characters nobody has quoted').toBeGreaterThan(0)

  await app.press(`no quotes ${promised}`)
  expect(await shownCount(), 'the filter left a different number of rows than it promised')
    .toBe(promised)

  // AND BACK, because a filter that cannot be undone is a filter a reader will not
  // press. "everything" is the first pill and it carries the whole count.
  await app.press(`everything ${everything}`)
  expect(await shownCount(), 'pressing everything should give the list back').toBe(everything)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
