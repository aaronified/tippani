// WHICH FILM A PROBE OPENS, ASKED WITHOUT A BROWSER.
//
// WHAT WENT WRONG, twice, and both times the cost of finding out was a build, a
// restore and a browser.
//
//   A HARD-CODED ID. `run-panel-depth.sh` passed `--movie-id 2`, which is a fact
//   about the SEEDED fixture — `seed-cast.mjs --movie-id 2` is what puts a cast on
//   it. Pointed at a restored archive the same flag asks for `/catalogue/2`, which
//   need not be a film: the probe sat on `waitForSelector('.tp-btn')` for thirty
//   seconds and died with a message about a button.
//
//   A FALLBACK THAT CONTRADICTED ITS OWN COMMENT. The replacement ended `return
//   String(list[0])` under a note promising `null`, so a library whose first
//   twelve films had no cast handed the caller a film with none — the same failure,
//   one step later. A rater found it by reading; nothing ran it.
//
// AND THE OTHER DIRECTION IS A DEFECT TOO. `sheet-drag.mjs` reaches its sheet
// through any film's Details and does not care about the cast, so demanding one
// would make it SKIP on a library it could measure perfectly well. One function,
// and the difference is passed in.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `pickFilm` takes its two lookups as functions
// so this file can drive it — `films()` yields ids, `castCount(id)` yields a
// number. Both are async in the real thing (`page.evaluate`) and may be sync here.
// Null is the answer for "this library has nothing to work on", and a caller that
// gets null is expected to SKIP.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const SHOTS = join(REPO, 'scripts', 'screenshots')

// By absolute URL — the probe lives outside the frontend's Vite root, and this is
// the same file the probe imports rather than a copy of its arithmetic.
const { pickFilm } = await import(pathToFileURL(join(SHOTS, 'pickfilm.mjs')).href)

// A library: ids in the API's order, and a cast count per id.
const library = (counts) => ({
  films: async () => Object.keys(counts).map(Number),
  castCount: async (id) => counts[id] ?? 0,
})

describe('choosing a film to probe', () => {
  it('takes the first film when the cast does not matter', async () => {
    expect(await pickFilm({ ...library({ 7: 0, 8: 3 }) })).toBe('7')
  })

  it('and skips past films with no cast when it does', async () => {
    // The archive's shape: plenty of films, a few with cast rows.
    expect(await pickFilm({ ...library({ 7: 0, 8: 0, 9: 4 }), wantCast: true })).toBe('9')
  })

  it('and answers null rather than handing back a film that does not fit', async () => {
    // THE DEFECT. `String(list[0])` here means the caller opens a film with no
    // cast and dies on a selector timeout thirty seconds later.
    expect(await pickFilm({ ...library({ 7: 0, 8: 0 }), wantCast: true }),
      'a library with no cast anywhere handed back a film anyway').toBeNull()
  })

  it('and null for an empty library, either way', async () => {
    expect(await pickFilm({ ...library({}) })).toBeNull()
    expect(await pickFilm({ ...library({}), wantCast: true })).toBeNull()
    expect(await pickFilm({ films: async () => null })).toBeNull()
  })

  it('and stops asking after the limit, because a big library is not a survey', async () => {
    // The one with a cast is beyond the limit, so it is not found — which is
    // deliberate: a probe may not spend a hundred round-trips choosing a subject.
    const counts = {}
    for (let i = 1; i <= 30; i++) counts[i] = i === 30 ? 5 : 0
    expect(await pickFilm({ ...library(counts), wantCast: true, limit: 12 })).toBeNull()
    expect(await pickFilm({ ...library(counts), wantCast: true, limit: 30 })).toBe('30')
  })

  it('and one failing lookup does not end the search', async () => {
    // A 404 or a dropped request on one film must not decide the answer for the
    // rest — the next film may be the one, and a probe that gives up on the first
    // error reports "nothing to measure" about a library full of subjects.
    const asked = []
    const out = await pickFilm({
      films: async () => [7, 8, 9],
      castCount: async (id) => { asked.push(id); if (id === 8) throw new Error('boom'); return id === 9 ? 2 : 0 },
      wantCast: true,
    })
    expect(out, 'a thrown lookup ended the search').toBe('9')
    expect(asked, 'the search stopped early').toEqual([7, 8, 9])
  })

  it('and answers a string, because a URL is built from it', async () => {
    // `/catalogue/${id}` with a number works and with `undefined` silently does
    // not, so the type is part of the contract.
    expect(typeof await pickFilm({ ...library({ 7: 1 }) })).toBe('string')
    expect(typeof await pickFilm({ ...library({ 7: 1 }), wantCast: true })).toBe('string')
  })
})
