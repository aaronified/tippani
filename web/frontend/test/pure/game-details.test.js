// A game is not a film, and its Details page had been telling it otherwise.
//
// 0040 stores games as `movies` rows — the right decision, and the one that let
// the Catalogue hold them at all. The cost is that every screen reading a movies
// row treats a game as a film unless it is told not to, and for two releases
// nothing told this one. Opening Mass Effect Legendary Edition showed:
//
//   TYPE       Film                       ← and no way to say otherwise
//   DIRECTOR   Electronic Arts            ← a studio, labelled as a person's job
//   TMDB ID    type an id, or fetch…      ← three film ids, none of them usable
//   THETVDB ID type an id, or fetch…
//   IMDB ID    not set
//                                         ← and no IGDB id, the one that works
//
// None of it errored. Every field was a real field of a real row; they were just
// the wrong ones, wearing the wrong words.
//
// These are pure because the defect is entirely in the two tables that decide
// what a medium shows and what it calls it — no rendering required to catch it,
// and a render test would have needed the whole panel to prove less.

import { describe, expect, it } from 'vitest'
import {  MOVIE_FIELDS,   specsFor } from '../../src/WorkDetails.jsx'

const keys = (mt) => specsFor(MOVIE_FIELDS, mt).map((s) => s.key)

describe('which fields a medium shows', () => {
  it('gives a game the IGDB id and none of the film ids', () => {
    expect(keys('game')).toContain('igdb_id')
    for (const film of ['tmdb_id', 'tvdb_id', 'imdb_id']) {
      expect(keys('game'), `a game has no ${film}`).not.toContain(film)
    }
  })
})

