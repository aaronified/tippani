// A reader uploads a Bengali typeface, gives the interface to it, switches the
// app into Bengali — and the specimen under the row starts writing Bengali.
//
// WHY THIS NEEDS A BROWSER, AND WHY NOTHING SHORTER WILL DO. The rule is "set
// the specimen in the script being chosen for, but ONLY where the face can
// actually draw it" — and "can actually draw it" is a MEASUREMENT: the app sets
// a string of Bengali in the candidate face and in a control that certainly
// lacks it, and compares widths. Under jsdom there is no canvas and no text
// metrics, so the measurement answers "I could not tell" and every row falls
// back to its Latin line — which means a jsdom test passes identically whether
// the app consults the measurement or ignores it entirely. A rating found that
// gap: with `specimenSample(...)` replaced by `t(row.sample)`, all 3,819 tests
// stayed green.
//
// AND IT NEEDS AN UPLOAD, because the four faces this app bundles for the
// interface are Latin-only by design. A face that can write Bengali reaches an
// interface role exactly one way — a reader brings their own — so that is what
// this does, with the app's own picker.
//
// THE MUTATION: replace `specimenSample(row, row.chosen?.family, script)` with
// `t(row.sample)` in FontRow and the last assertion fails, because the row goes
// back to setting an English sentence in a Bengali face.
//
// It knows only the words on the screen and nothing else.

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

// A real Bengali face, from the same package the app bundles its own from. The
// journey hands over a FILE, exactly as a reader does; what is in it is the
// point — a face with no Bengali in it would prove the opposite thing.
const HERE = dirname(fileURLToPath(import.meta.url))
const BENGALI_FONT = join(
  HERE, '..', '..', 'node_modules', '@fontsource', 'noto-serif-bengali',
  'files', 'noto-serif-bengali-bengali-400-normal.woff2',
)

// The Bengali specimen the app sets when a face can write the script, and the
// English one it keeps when the face cannot. Both are on screen as words, which
// is the only reason a journey may name them.
const BENGALI_LINE = 'যে জীবন ফড়িঙের দোয়েলের'
const LATIN_LINE = 'Add to quiz'  // the Interface row's own sample, in every locale

it('a Bengali face given the interface makes its specimen Bengali', async () => {
  await app.goto('/settings')
  await app.press('Language and font')

  // BEFORE: the interface row is set in a Latin face, and says so in Latin.
  await app.see(LATIN_LINE)
  await app.gone(BENGALI_LINE)

  // BENGALI FIRST, AND THE ORDER IS THE POINT. The faces on these rows are the
  // faces of the language being read — so a choice made while the app is in
  // English is English's, and would not follow the reader into Bengali. Doing it
  // the other way round leaves the row on its inherited Latin face, which is
  // what this journey found the first time it was written.
  await app.press('Choose a language')
  await app.press('বাংলা')

  await app.upload('ফন্ট আপলোড করুন', BENGALI_FONT)

  // The upload is named for the file it came from, which is what the reader sees
  // in the list they are choosing from.
  await app.press('ইন্টারফেস লেখার ফন্ট')
  await app.press('noto serif bengali')

  // AND THE SPECIMEN FOLLOWS, because this face can carry it. The Latin sentence
  // is gone from that row: a face that can write Bengali is shown writing it.
  await app.see(BENGALI_LINE)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
