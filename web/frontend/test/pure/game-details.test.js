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
import { MEDIA_TYPES, MOVIE_FIELDS, creditSpecsFor, labelFor, specsFor } from '../../src/WorkDetails.jsx'
import { hiResPoster, coverSourceLabel } from '../../src/CoverPicker.jsx'

const keys = (mt) => specsFor(MOVIE_FIELDS, mt).map((s) => s.key)
// BOTH LISTS. The credits moved behind the People door and stayed specs, so the
// per-medium label rule has to hold wherever a spec lives — a rule that applied
// only to the fields still drawn on the form would let a game's Studio go back to
// reading Director the moment it moved.
const ALL_MOVIE_SPECS = MOVIE_FIELDS.concat(creditSpecsFor('movie'))
const labelOf = (key, mt) => labelFor(ALL_MOVIE_SPECS.find((s) => s.key === key), mt)

describe('which fields a medium shows', () => {
  it('gives a game the IGDB id and none of the film ids', () => {
    expect(keys('game')).toContain('igdb_id')
    for (const film of ['tmdb_id', 'tvdb_id', 'imdb_id']) {
      expect(keys('game'), `a game has no ${film}`).not.toContain(film)
    }
  })

  it('and gives a film the three film ids and no IGDB id', () => {
    for (const film of ['tmdb_id', 'tvdb_id', 'imdb_id']) {
      expect(keys('movie')).toContain(film)
    }
    expect(keys('movie')).not.toContain('igdb_id')
    expect(keys('show')).not.toContain('igdb_id')
  })

  // Everything without a `media` list belongs to all three. Stated so that a
  // field added without one is understood to be universal rather than forgotten.
  it('shows every unrestricted field to all three media', () => {
    for (const spec of MOVIE_FIELDS.filter((s) => !s.media)) {
      for (const mt of ['movie', 'show', 'game']) {
        expect(keys(mt), `${spec.key} for ${mt}`).toContain(spec.key)
      }
    }
  })
})

describe('what a medium calls its credit', () => {
  it('names a game’s credit Studio, not Director', () => {
    expect(labelOf('director', 'game')).toBe('Studio')
    expect(labelOf('director', 'show')).toBe('Creator')
    expect(labelOf('director', 'movie')).toBe('Director')
  })

  // Collection is a film word. A game has a series.
  it('and its franchise a Series, not a Collection', () => {
    expect(labelOf('series', 'game')).toBe('Series')
    expect(labelOf('series_index', 'game')).toBe('Series #')
    expect(labelOf('series', 'movie')).toBe('Collection')
  })

  it('falling back to the spec’s own label for anything unmapped', () => {
    expect(labelOf('title', 'game')).toBe('Title')
    expect(labelOf('genres', 'show')).toBe('Genres')
  })
})

describe('the Type field', () => {
  // It read `value === 'show' ? 'Show' : 'Film'`, so a game reported itself as a
  // Film — and the picker offered two options, so there was no way back.
  it('offers all three media, so a game can say what it is', () => {
    expect(MEDIA_TYPES.map(([k]) => k)).toEqual(['movie', 'show', 'game'])
    expect(MEDIA_TYPES.find(([k]) => k === 'game')?.[1]).toBe('Game')
  })
})

describe('covers', () => {
  // IGDB serves sizes as path segments, and the picker asks for t_cover_small —
  // 90×128. The upgrade knew only TMDB's query-style path, so an IGDB URL fell
  // through unchanged and every cover chosen for a game was STORED at thumbnail
  // size. Nothing failed; the picture was just tiny.
  it('upgrades an IGDB thumbnail to the storage size', () => {
    expect(hiResPoster('https://images.igdb.com/igdb/image/upload/t_cover_small/co1x.jpg'))
      .toBe('https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1x.jpg')
  })

  it('and still upgrades a TMDB one', () => {
    expect(hiResPoster('https://image.tmdb.org/t/p/w342/abc.jpg'))
      .toBe('https://image.tmdb.org/t/p/original/abc.jpg')
  })

  it('leaving anything else alone', () => {
    expect(hiResPoster('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(hiResPoster('')).toBe('')
    expect(hiResPoster(null)).toBe('')
  })

  // The button named a supplier that is never asked for a game.
  it('names the supplier that actually answers', () => {
    expect(coverSourceLabel('game')).toMatch(/IGDB/)
    expect(coverSourceLabel('game')).not.toMatch(/TMDB/)
    expect(coverSourceLabel('movie')).toMatch(/TMDB/)
    expect(coverSourceLabel('show')).toMatch(/TheTVDB/)
  })
})
