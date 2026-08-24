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

import { describe, expect, it } from 'vitest'
import { BULK_QUOTE_FIELDS, BULK_WORK_FIELDS, bulkFieldsFor, overwriteWarning } from '../../src/bulkOps.jsx'

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

  // Not taste: isbn, tmdb_id, tvdb_id and igdb_id each carry a UNIQUE index per
  // user, so a bulk set is a constraint violation — and where it did not fail it
  // would point five records at one supplier record, which every later re-sync
  // would then rewrite all five from.
  it('and never a supplier id, which is unique per row', () => {
    const all = [...BULK_WORK_FIELDS, ...BULK_QUOTE_FIELDS].map((f) => f.key)
    for (const id of ['isbn', 'asin', 'tmdb_id', 'tvdb_id', 'igdb_id', 'imdb_id', 'google_id']) {
      expect(all, `${id} cannot be set in bulk`).not.toContain(id)
    }
  })

  it('but everything else the record has', () => {
    expect(keys('book')).toEqual(
      expect.arrayContaining(['author', 'translator', 'editor', 'published_year', 'series', 'description']),
    )
    expect(keys('movie')).toEqual(
      expect.arrayContaining(['director', 'media_type', 'release_year', 'series', 'description']),
    )
    expect(keys('annotation')).toEqual(expect.arrayContaining(['note', 'chapter', 'chapter_no', 'location']))
    expect(keys('dialogue')).toEqual(expect.arrayContaining(['character', 'actor', 'timestamp']))
    // `kind` (0053) rather than the free-text `medium` it replaced: that field has
    // no box on any form now, and a bulk editor is the wrong place to keep one.
    expect(keys('quote')).toEqual(expect.arrayContaining(['speaker', 'occasion', 'place', 'kind']))
    expect(keys('quote'), 'the retired free-text field is still offered').not.toContain('medium')
  })

  // A field offered to a kind with no such column would be a 400 from the
  // server, which is right — but the panel should never send one.
  it('offering each kind only the columns it has', () => {
    expect(keys('annotation')).not.toContain('character')
    expect(keys('quote')).not.toContain('chapter')
    expect(keys('book')).not.toContain('director')
    expect(keys('movie')).not.toContain('author')
  })
})

describe('the per-field warning', () => {
  it('says nothing when the field is empty across the whole selection', () => {
    const rows = [{ series: '' }, { series: null }, {}, { series: undefined }]
    expect(overwriteWarning(rows, 'series')).toBeNull()
  })

  it('counts only the rows that would actually lose something', () => {
    const rows = [{ series: 'Hainish' }, { series: '' }, { series: 'Earthsea' }, {}]
    const w = overwriteWarning(rows, 'series')
    expect(w.rows).toBe(2)
    expect(w.distinct).toBe(2)
    expect(w.text).toMatch(/2 different values/)
  })

  // "overwrites 12" and "overwrites 12 different answers" are different sizes of
  // mistake, so the copy distinguishes them.
  it('and says so differently when they all already agree', () => {
    const rows = [{ author: 'Le Guin' }, { author: 'Le Guin' }, { author: '' }]
    const w = overwriteWarning(rows, 'author')
    expect(w.rows).toBe(2)
    expect(w.distinct).toBe(1)
    expect(w.text).toContain('Le Guin')
  })

  // 0 and false are VALUES. A year of 0 is "no year"; a favourite of false is a
  // real answer. Only "", null and undefined are empty — treating 0 as empty
  // would silently skip the warning on a numeric field.
  it('treats 0 and false as values, not as blanks', () => {
    expect(overwriteWarning([{ series_index: 0 }], 'series_index')).not.toBeNull()
    expect(overwriteWarning([{ favorite: false }], 'favorite')).not.toBeNull()
    expect(overwriteWarning([{ series_index: '' }], 'series_index')).toBeNull()
  })

  it('and survives an empty selection', () => {
    expect(overwriteWarning([], 'series')).toBeNull()
    expect(overwriteWarning(null, 'series')).toBeNull()
  })
})

// ---- one column, two words for it -------------------------------------------
//
// A book's `series` is a Series and a film's is a Collection — which is what both
// Details panels call them. The bulk editor said "Series" over a selection of
// films, the one place in the app using the other side's word.
describe('the word a kind uses for its own column', () => {
  const labels = (kind) => bulkFieldsFor(kind).map((f) => f.label)

  it('calls it a series for a book and a collection for a film', () => {
    expect(labels('book')).toContain('Series')
    expect(labels('book')).not.toContain('Collection')
    expect(labels('movie')).toContain('Collection')
    expect(labels('movie')).not.toContain('Series')
  })

  it('offers each of them exactly once', () => {
    // Two entries share the `series` key; `bulkFieldsFor` filters by kind, so a
    // dropdown that listed both would be two rows doing one thing.
    for (const kind of ['book', 'movie']) {
      expect(bulkFieldsFor(kind).filter((f) => f.key === 'series')).toHaveLength(1)
      expect(bulkFieldsFor(kind).filter((f) => f.key === 'series_index')).toHaveLength(1)
    }
  })
})
