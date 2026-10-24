import { describe, expect, it } from 'vitest'
import { groupWorks, pinInProgress } from '../../src/works.jsx'
import { showsField } from '../../src/addFields.js'
import { bulkFieldsFor, overwriteWarning } from '../../src/bulkOps.jsx'
import { duplicateSeed } from '../../src/Library.jsx'
import { MOVIE_FIELDS, specsFor } from '../../src/WorkDetails.jsx'

// works.jsx — the shelf and grouping logic shared by Library and the Catalogue.
//
// groupWorks is the largest pure function in the frontend and it is used by two
// screens (the Library/Catalogue group-by and Search's grouped results), so one
// regression here shows up in two places that look unrelated. Its ordering rules
// are all different from each other on purpose — series and credit
// alphabetical, decade newest first, genre by size — and the residual bucket
// always sinks, which is the part most likely to get lost in a refactor.
describe('works', () => {
  const labels = (groups) => groups.map((g) => g.label)
  const titles = (group) => group.items.map((i) => i.title)

  describe('groupWorks — series', () => {
    const list = [
      { title: 'A', series: 'Earthsea' },
      { title: 'B', series: null },
      { title: 'C', series: 'Dune' },
      { title: 'D', series: 'Earthsea' },
    ]

    it('groups alphabetically with the no-series bucket last', () => {
      expect(labels(groupWorks(list, 'series'))).toEqual(['Dune', 'Earthsea', 'No series'])
    })
  })

  describe('groupWorks — genre', () => {
    const genres = (it) => it.genres || []
    const list = [
      { title: 'A', genres: ['SF'] },
      { title: 'B', genres: [] },
      { title: 'C', genres: ['SF', 'Fantasy'] },
      { title: 'D', genres: ['SF'] },
      { title: 'E', genres: ['Fantasy'] },
    ]

    // The documented rule is "a work with several credits or genres appears in
    // each". The author side asserted it; the genre side only asserted LABELS,
    // and the labels come out identical whether or not the multi-genre work is
    // filed under every genre — dropping C from Fantasy changes the sizes from
    // 3/2/1 to 3/1/1, but SF still leads and the residual still sinks. So the
    // membership has to be asserted directly.
    it('files a multi-genre work under every one of its genres', () => {
      const groups = groupWorks(list, 'genre', { genres })
      expect(titles(groups.find((g) => g.label === 'SF'))).toEqual(['A', 'C', 'D'])
      expect(titles(groups.find((g) => g.label === 'Fantasy'))).toEqual(['C', 'E'])
      expect(titles(groups.find((g) => g.label === 'No genre'))).toEqual(['B'])
    })
  })

  describe('pinInProgress', () => {
    it('floats the active work to the front, keeping both blocks in order', () => {
      const list = [{ id: 1 }, { id: 2, status: 'reading' }, { id: 3 }, { id: 4, status: 'reading' }]
      expect(pinInProgress(list, 'book').map((x) => x.id)).toEqual([2, 4, 1, 3])
    })
  })
})

// The per-kind field spec, checked against what the owner actually signed off.
//
// THESE ARE NOT WORDING TESTS. Each case below is a rule the owner stated in their
// own words, and the assertion is on the FIELD KEYS a door offers — the thing that
// decides what a reader is asked for. A test that checked labels would pass while
// a proverb form asked who said it.
describe('add fields', () => {
  describe('what each kind refuses to ask', () => {
    // The case the owner named first and the one that proves the exercise: "Hard
    // drop anything that is not relevant (writer of a movie, timestamp of a book,
    // speaker of a proverb, etc)."
    it('never asks a proverb who said it, when, or where', () => {
      for (const f of ['speaker', 'occasion', 'when', 'place', 'recipient', 'source_author']) {
        expect(showsField('proverb', f), f).toBe(false)
      }
    })

    it('never asks a book highlight for a timestamp, and never asks a film line for a chapter', () => {
      for (const f of ['timestamp', 'timestamp_end', 'season', 'episode', 'act', 'quest', 'dlc', 'speaker', 'occasion']) {
        expect(showsField('annotation', f), f).toBe(false)
      }
      for (const f of ['chapter', 'chapter_no', 'location', 'speaker', 'work_title']) {
        expect(showsField('dialogue', f, { mediaType: 'movie' }), f).toBe(false)
      }
    })
  })
})

// Editing a whole selection, and the warning that says what it will cost.
//
// THE OWNER'S RULE, in three parts:
//   "any change will overwrite only with warnings per field"
//   "fields that are empty across the full selection do not need warnings"
//   "only things offlimits for multi-edit will be the work names & annotations
//    themselves"
//
// The second is the one that makes the first usable. A warning on every field
// is a warning on nothing — a reader who sees eight of them stops reading them,
// and the one that mattered goes past with the rest. Filling a blank cannot lose
// anything, so it says nothing.
describe('bulk fields', () => {
  const keys = (kind) => bulkFieldsFor(kind).map((f) => f.key)

  describe('what may be set over a selection', () => {
    // THE RULE THIS FILE EXISTS FOR. A title is what tells five rows apart;
    // setting it across them destroys four records and leaves five nothing can
    // distinguish afterwards.
    it('never the name of a work', () => {
      for (const kind of ['book', 'movie']) {
        expect(keys(kind), `${kind} must not offer its title`).not.toContain('title')
      }
    })

    it('never the words of a quote', () => {
      for (const kind of ['annotation', 'dialogue', 'quote']) {
        expect(keys(kind), `${kind} must not offer its own text`).not.toContain('quote')
      }
    })
  })

  describe('the per-field warning', () => {
    it('counts only the rows that would actually lose something', () => {
      const rows = [{ series: 'Hainish' }, { series: '' }, { series: 'Earthsea' }, {}]
      const w = overwriteWarning(rows, 'series')
      expect(w.rows).toBe(2)
      expect(w.distinct).toBe(2)
      expect(w.text).toMatch(/2 different values/)
    })
  })

  // ---- one column, two words for it -------------------------------------------
  //
  // A book's `series` is a Series and a film's is a Collection — which is what both
  // Details panels call them. The bulk editor said "Series" over a selection of
  // films, the one place in the app using the other side's word.
})

// WHAT A DUPLICATE CARRIES, pinned field by field.
//
// The menu row promises "the same note, tags, colour and locator", and a promise
// in a label is only as good as the mapping under it — this is that mapping. It
// is a pure function precisely so the promise can be checked without a screen.
//
// ONE CONVERSION IS LEFT, AND IT WAS TWO. A row's `chapter_no` is a number or
// null while every box holds a string — the kind of thing that "works" in a
// browser by coercion and then saves 0 for "no chapter". The other was `tags`:
// the old capture card kept them in a comma box so this joined the array, and the
// add-surface rework replaced that box with the token input the three edit forms
// have always used, which takes the array the row already carries.
describe('duplicate seed', () => {
  const FULL = {
    id: 7,
    quote: 'Manuscripts don’t burn.',
    note: 'Woland, to the Master.',
    chapter: 'Chapter Twenty-Four',
    chapter_no: 24,
    location: 'p.402',
    character: 'Woland',
    color: 'blue',
    tags: ['craft', 'fire'],
    // SEEDED NOW, AND THEY WERE NOT. The old capture card had no translation, no
    // language and no sticker box, so seeding them would have put values in a draft
    // nothing could show — the add surface's rework gave every quote form all
    // three, and a duplicate that dropped the translation is a copy whose meaning
    // has to be retyped.
    translation: 'পাণ্ডুলিপি পোড়ে না।',
    language: 'Bengali',
    sticker_id: 3,
    // Still not seeded: a duplicate is a NEW quote, so it starts unfavourited and
    // with no id of its own.
    favorite: 1,
    id_of_something_else: 99,
  }

  describe('the draft a duplicate opens on', () => {
    it('leaves a missing chapter number EMPTY rather than zero', () => {
      // A form field is a string. `String(null)` is "null" and `Number(null)` is 0,
      // and 0 is a real chapter — so "no chapter" has to arrive as no characters.
      expect(duplicateSeed({ ...FULL, chapter_no: null }).chapter_no).toBe('')
      expect(duplicateSeed({ ...FULL, chapter_no: 0 }).chapter_no).toBe('0')
    })
  })
})

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
describe('game details', () => {
  const keys = (mt) => specsFor(MOVIE_FIELDS, mt).map((s) => s.key)

  describe('which fields a medium shows', () => {
    it('gives a game the IGDB id and none of the film ids', () => {
      expect(keys('game')).toContain('igdb_id')
      for (const film of ['tmdb_id', 'tvdb_id', 'imdb_id']) {
        expect(keys('game'), `a game has no ${film}`).not.toContain(film)
      }
    })
  })
})
