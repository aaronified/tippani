// THE PAIR OF NUMBERS IS ON EVERY SHEET THAT WAS NAMED, AND IT IS THE SAME PAIR.
//
// THE OWNER'S INSTRUCTION, verbatim: "the 3 quotes, 1 scene is not working. rather
// do 3 quotes, 1 favourited. for all. people, character, details, all pages those
// two boxes are." Restated when three of the four turned out not to have it: "i
// told you to standardise the quotes•favourited pair in all relevant popup cards
// (details, people, character (global and local)). why did you not?"
//
// SO THERE ARE FOUR SURFACES AND THEY ARE NAMED IN THE INSTRUCTION, not derived
// from what the code happened to draw. The first pass read "everywhere it exists"
// as a description of the source, found the one screen that already had a pair,
// changed it, and reported the scope as covered — which is how a four-screen
// instruction shipped as one screen.
//
// WHY THIS IS A SOURCE TEST AND NOT FOUR RENDERS. Rendering each sheet proves the
// numbers appear; it cannot prove they are the SAME pair, which is the whole of
// what "standardise" asks for. Four screens each rendering two plausible numbers
// is exactly the state this instruction was correcting. What has to hold is that
// no screen builds its own cells — every one of them calls the single builder —
// and a render cannot see the difference between calling it and copying it.
//
// The behaviour of the cells themselves (the captions, the doors, the arming) is
// covered where it belongs: panel-doors.test.jsx presses them.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const read = (f) => readFileSync(join(src, f), 'utf8')

// The four sheets the instruction names, and the file each is drawn in.
// `identityGlobal.jsx` holds two of them — a character seen across the library
// and a person — which is why that file has to show TWO pairs and not one.
const SHEETS = [
  { name: 'a work’s details', file: 'WorkDetails.jsx', pairs: 1 },
  { name: 'a person', file: 'identityGlobal.jsx', pairs: 2 },
  { name: 'a character in one work', file: 'identityLocal.jsx', pairs: 1 },
]

describe('the quotes · favourited pair', () => {
  it('is drawn on every sheet the instruction named', () => {
    const missing = SHEETS.filter((s) => !read(s.file).includes('<PairRow'))
    expect(missing.map((s) => `${s.name} (${s.file})`),
      'a named sheet draws no pair at all — three of the four did not').toEqual([])
  })

  it('and twice in the file that holds two of them', () => {
    // A character seen across the library and a person are two screens in one
    // file, and the first pass at this added the pair to one of them.
    for (const s of SHEETS) {
      const drawn = read(s.file).split('<PairRow').length - 1
      expect(drawn, `${s.file} draws ${drawn} pair(s), not ${s.pairs}`).toBe(s.pairs)
    }
  })

  it('and every one of them is built by the one builder, never written out again', () => {
    // THE POINT OF "STANDARDISE". A screen that assembles its own cells can drift
    // — a different caption, a different glyph, a second count that means
    // something else — and nothing would fail. The cells exist in one function;
    // what a screen passes in is its own scope and its own doors.
    const offenders = SHEETS.filter((s) => {
      const body = read(s.file)
      const calls = body.split('quotePairCells(').length - 1
      const pairs = body.split('<PairRow').length - 1
      return calls !== pairs
    })
    expect(offenders.map((s) => s.file),
      'a sheet builds its own pair cells instead of calling quotePairCells').toEqual([])
  })

  it('and the builder itself names the same two things for all of them', () => {
    // The captions are NOT per screen: "quotes" and "favourited" mean the same on
    // all four, which is what makes the numbers comparable. Only the tooltip's
    // scope is passed in — see quotePair.jsx.
    const b = read('quotePair.jsx')
    expect(b, 'the builder no longer names the quote count').toMatch(/identity\.count\.quotes/)
    expect(b, 'the builder no longer names the favourite count').toMatch(/identity\.count\.favourites/)
    // A caption keyed per scope would be the drift this file exists to stop.
    expect(b, 'a caption is being chosen per screen — only the scope tooltip may differ')
      .not.toMatch(/identity\.count\.(quotes|favourites)\.(?!tip|one|other)/)
  })
})
