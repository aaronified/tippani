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
import { BULK_QUOTE_FIELDS, BULK_WORK_FIELDS, bulkFieldBody, bulkFieldsFor, overwriteWarning } from '../../src/bulkOps.jsx'

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
    expect(keys('dialogue')).toEqual(
      expect.arrayContaining(['character', 'actor', 'timestamp', 'timestamp_end', 'act', 'quest', 'episode_name', 'dlc']),
    )
    // `kind` (0053) rather than the free-text `medium` it replaced: that field has
    // no box on any form now, and a bulk editor is the wrong place to keep one.
    expect(keys('quote')).toEqual(
      expect.arrayContaining(['speaker', 'occasion', 'place', 'kind', 'region', 'recipient', 'work_title', 'locator', 'source_author']),
    )
    expect(keys('quote'), 'the retired free-text field is still offered').not.toContain('medium')
  })

  // THE ONE FIELD ON ALL THREE KINDS. 0071 put `language` on annotations,
  // dialogues and utterances alike, and it is the most obviously bulk-settable
  // thing in the app — forty highlights out of one Bengali book is one value on
  // forty rows, which is what the changelog promised while no screen offered it.
  // bulk_fields_test.go now walks this list against the endpoint's own table.
  it('and the language on every kind that has one', () => {
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      expect(keys(kind), `${kind} must offer its language`).toContain('language')
    }
    // Not on a work: a book's `language` and `orig_language` are a different pair
    // of columns with their own controls, and this panel edits quotes.
    for (const kind of ['book', 'movie']) {
      expect(keys(kind)).not.toContain('language')
    }
  })

  // WHEN IT WAS SAID, AND WHETHER THAT IS A GUESS — one row in the panel and two
  // columns on the wire. The tick is drawn inside the date control, because the
  // owner ruled that a flag about a field belongs with the field; a second row
  // for it would put the qualifier on a different screen from the thing it
  // qualifies, which is the arrangement that ruling replaced.
  it('offers the quote date, on quotes only, carrying its circa tick', () => {
    expect(keys('quote'), 'a quote must be datable in bulk').toContain('occasion_date')
    // A highlight and a film line are placed by a chapter or a runtime; neither
    // table has the column, and offering it would be a 400 the panel sent itself.
    for (const kind of ['annotation', 'dialogue']) {
      expect(keys(kind), `${kind} has no occasion_date column`).not.toContain('occasion_date')
    }
    const f = BULK_QUOTE_FIELDS.find((x) => x.key === 'occasion_date')
    expect(f.circaKey, 'the tick must name the column it writes').toBe('occasion_circa')
    // Never a second row: the endpoint's own guard reads `circaKey` for exactly
    // this reason, so a stray entry here would mean the panel offered the tick
    // twice, once uselessly.
    expect(keys('quote').filter((k) => k === 'occasion_circa')).toHaveLength(0)
  })

  // THE PAIR TRAVELS TOGETHER, ALWAYS. A date set across a selection against each
  // row's OLD tick states the new date more or less precisely than it was meant —
  // per row, and with nothing on screen to say so.
  it('sends the tick with the date, touched or not', () => {
    const date = BULK_QUOTE_FIELDS.find((x) => x.key === 'occasion_date')
    expect(bulkFieldBody(date, '-0399', false)).toEqual({ occasion_date: '-0399', occasion_circa: false })
    expect(bulkFieldBody(date, '-0399', true)).toEqual({ occasion_date: '-0399', occasion_circa: true })
    // Clearing the date clears it, and the tick still travels: a row with no date
    // and a live "about" flag is a qualifier with nothing to qualify.
    expect(bulkFieldBody(date, '', false)).toEqual({ occasion_date: '', occasion_circa: false })
    // And a field with no companion sends exactly one key, or every other field
    // in the panel would quietly grow a second one.
    const speaker = BULK_QUOTE_FIELDS.find((x) => x.key === 'speaker')
    expect(bulkFieldBody(speaker, ' Ahab ', true)).toEqual({ speaker: 'Ahab' })
    // A number field sends a number: "3" in a *float64 is a 400.
    const year = BULK_WORK_FIELDS.find((x) => x.key === 'published_year')
    expect(bulkFieldBody(year, '1851', false)).toEqual({ published_year: 1851 })
  })

  // A number the import queue's own retarget already moves. Setting a season or an
  // episode across a mixed selection renumbers lines from different episodes alike
  // — a data change wearing the clothes of a correction.
  it('never a season or an episode number', () => {
    for (const key of ['season', 'episode']) {
      expect(keys('dialogue'), `${key} must not be bulk-settable`).not.toContain(key)
    }
  })

  // WHICH FIELDS ARE NOT NAMES, and the reason this lives here rather than in
  // name-casing.test.js: the bulk editor draws ONE input for whichever field the
  // reader picked, so its label is a variable and the source walk that polices
  // every other name box cannot see it. The decision has to come from this table,
  // and `nameCase={!spec?.number}` was making it — which capitalised a page
  // reference, a clock reading and "the funeral of his brother" per word, in the
  // one place the single-record forms deliberately do not.
  //
  // Each of the five is argued field-by-field in name-casing.test.js's PROSE_FIELDS.
  it('and knows which of them are not names', () => {
    const prose = ['location', 'locator', 'timestamp', 'timestamp_end', 'occasion']
    for (const key of prose) {
      const f = BULK_QUOTE_FIELDS.find((x) => x.key === key)
      expect(f, `${key} is not in the table at all`).toBeTruthy()
      expect(f.prose, `${key} would take per-word capitals`).toBe(true)
    }
    // And the other direction, which is what makes it a rule: a name must NOT
    // carry the flag, or a sweep that set it everywhere would pass half of this.
    for (const key of ['character', 'actor', 'speaker', 'recipient', 'work_title', 'source_author', 'region', 'place', 'chapter']) {
      const f = BULK_QUOTE_FIELDS.find((x) => x.key === key)
      expect(f, `${key} is not in the table at all`).toBeTruthy()
      expect(f.prose, `${key} is a name and must keep its capitals`).toBeFalsy()
    }
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

  // A DATE IS SHOWN THE WAY THE APP SHOWS DATES, not the way the column stores
  // them. `-0399` is the canonical form the board sorts on; a reader who typed
  // "399 BCE" has never seen it, so a warning printing it is the storage format
  // talking. The field carries its own renderer, and it reads the ROW as well as
  // the value because a partial date's precision lives in a second column.
  it('renders a stored date the way every other screen does', () => {
    const fmt = BULK_QUOTE_FIELDS.find((f) => f.key === 'occasion_date').format
    const rows = [{ occasion_date: '-0399', occasion_circa: false }]
    const w = overwriteWarning(rows, 'occasion_date', fmt)
    expect(w.text).toContain('399 BCE')
    expect(w.text, 'the stored form must not reach the reader').not.toContain('-0399')
    // And the tick changes what it says, which is why the row is passed at all:
    // two rows holding the same digits with different certainty are two answers.
    const mixed = [
      { occasion_date: '-0399', occasion_circa: false },
      { occasion_date: '-0399', occasion_circa: true },
    ]
    expect(overwriteWarning(mixed, 'occasion_date', fmt).distinct).toBe(2)
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
