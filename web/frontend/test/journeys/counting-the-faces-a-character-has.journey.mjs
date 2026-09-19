// A reader opens the characters console to see which of a character's appearances
// still has no face.
//
// WHAT THIS GUARDS. A character wears a different face in every work — the picture
// is stored against the cast row, not against the character — so the question the
// console exists to answer is per appearance: three works, one of them with a face.
// The row could not state it. It stated the character's name, the spelling it sorts
// under, and how many works it turned up in, and the face count was nowhere on the
// screen or on the wire: `GET /characters` sent the works and said nothing about
// their pictures.
//
// SO IT ASSERTS THE SENTENCE AND THE GAP TOGETHER. `see('Characters')` passes on
// the rail item that was pressed, and a name passes on the row that was already
// there. The sub-line's shape is what tells the new row from the old one, and the
// red number beside it is the finding a reader acts on — a count of appearances
// with nothing chosen, which is the pack's own (`metadata.dc.html:715-723`).
//
// THE MUTATIONS, each run against a rebuilt `web/dist/` because this tier runs the
// compiled binary:
//
//   (1) Delete `press('Characters')` — red. The metadata landing carries the
//       section counts and no character rows at all.
//   (2) Put `sub` back to the sort name — red on the regex, green on everything
//       else, which is the pair this file exists to tell apart.
//   (3) Draw no count beside the sentence — red on the last assertion, and only
//       because that assertion demands the number IMMEDIATELY after the line it is
//       derived from. A looser regex, which this file first shipped with, matched
//       the next row's sentence instead and passed with the count deleted.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader sees how many of a character’s appearances have a face', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Characters')

  const screen = await app.onScreen()

  // THE SENTENCE. NOT A PINNED NAME: the golden library's people are invented and
  // change whenever the curator is re-run, so a journey pinned to one would go red
  // on a fixture rebuild that changed nothing about the app. The SHAPE of the line
  // is the thing this change introduced, and it is unmistakable.
  const line = screen.match(/(\d+) works? · (\d+) of (\d+) with a face chosen/)
  expect(line, 'a character row should say how many of its works have a face').toBeTruthy()

  const [, works, faced, alsoWorks] = line.map(Number)
  // THE SAME NUMBER TWICE IN ONE SENTENCE has to be the same number, which is the
  // half a regex alone would let through.
  expect(alsoWorks, 'the sentence counts the same works twice').toBe(works)
  expect(faced, 'more faces than appearances').toBeLessThanOrEqual(works)

  // AND THE COUNT BESIDE IT IS THE GAP. The console's whole job is pointing at the
  // appearances with nothing chosen, and that number is derived from the same two
  // the sentence states — so a row computing them apart shows up here and nowhere
  // else. This fixture can fetch no artwork at all (every image request is
  // refused), so every appearance is bare and the gap is the whole count.
  expect(faced, 'the fixture library has no artwork, so no face can have been chosen').toBe(0)
  // ON THE SAME ROW, which is the whole of it. This first read `[\s\S]{0,400}?`
  // between the sentence and the number, and passed with the count deleted
  // outright — the NEXT character's sentence supplied a matching digit. Nothing
  // stands between a row's sub-line and its own count, so nothing may here.
  expect(await app.onScreen(), 'the row should point at the appearances with no face')
    .toMatch(new RegExp(`${works} works? · 0 of ${works} with a face chosen\\s*${works}\\s`))

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
