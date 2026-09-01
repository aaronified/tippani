// Every PUT in this app is full-state, so a field missing from the object a card
// saves is a field that request CLEARS.
//
// THIS IS A TEST FOR A BUG THAT WAS LIVE, not for a feature that is new.
// `annotationState` did not carry `character` from the release that added the
// column (0047) until 0051, which meant that recolouring a highlight — or
// hearting it, or dragging its sticker, or touching it from the selection bar —
// quietly threw away who said the line. `dialogueState` lost an episode's title
// and a game line's act and quest the same way. Nothing noticed, because every
// one of those saves answers 200 and the field it dropped was one the form
// showing it never had a box for.
//
// utteranceState has carried a comment saying "AND THIS IS A SILENT-LOSS SITE"
// since 0035 and has been correct ever since. The comment was not enough; the
// difference between that kind and the other two is that somebody wrote the
// sentence down on one of them. So this is the sentence as a test.
//
// WHY A LIST AND NOT INTROSPECTION. There is nothing on this side of the wire to
// introspect: the server's shape is the authority, and a browser test cannot ask
// it. So the list below is a hand-kept mirror of what each kind stores — which is
// exactly what makes it useful, because adding a column to the API and NOT
// arriving here is the failure, and the next person to add one has to come and
// argue with this file.

import { describe, expect, it } from 'vitest'
import { annotationState, bookState } from '../../src/Library.jsx'
import { dialogueState, movieState } from '../../src/Movies.jsx'
import { utteranceState } from '../../src/Quotes.jsx'
import { fullState } from '../../src/WorkDetails.jsx'

// What the server stores and accepts on each kind's PUT, as of 0051. Read-only
// columns are deliberately absent: `id`, `created_at`, `updated_at`, `source` and
// `noted_at` are create-only or server-owned, the parent id is in the path, and
// `actor` on a dialogue is DERIVED from the character via the cast — the one
// field the server would rather compute than be told.
const STORED = {
  annotation: [
    'quote', 'note', 'translation', 'color', 'tags', 'favorite',
    'chapter', 'chapter_no', 'location', 'character',
    'sticker_id', 'sticker_x', 'sticker_y',
  ],
  dialogue: [
    'quote', 'note', 'translation', 'color', 'tags', 'favorite',
    'character', 'actor', 'timestamp', 'season', 'episode',
    'episode_name', 'act', 'quest',
    'sticker_id', 'sticker_x', 'sticker_y',
  ],
  quote: [
    'quote', 'note', 'translation', 'color', 'tags', 'favorite',
    'speaker', 'occasion', 'occasion_date', 'place', 'medium',
    'category', 'language', 'board_id',
    'sticker_id', 'sticker_x', 'sticker_y',
  ],
  // THE WORKS THEMSELVES, added after the same defect was found on them — and it
  // had been live longer and cost more. `books.language` and `orig_language` have
  // been storable since 0047 and no client had ever sent them, so an import
  // filled them and the reader's next ♥ wiped both; `published_circa` and
  // `release_circa` went the same way, turning "c. 380 BCE" into "380 BCE".
  //
  // The shelf columns are absent for the reason the quote kinds' are: status,
  // progress and the read/watch log belong to PUT /:kind/:id/status, so an
  // ordinary save cannot rewrite a history.
  book: [
    'title', 'author', 'translator', 'editor', 'isbn', 'asin', 'description',
    'published_year', 'published_circa', 'language', 'orig_language',
    'genres', 'series', 'series_index', 'favorite',
  ],
  // imdb_id IS full-state and belongs here. tmdb_id / tvdb_id / igdb_id are
  // POINTERS in movieReq — nil leaves the column alone — so sending 0 for one is
  // how the API spells "clear it". Adding them here "for symmetry" would make
  // every ♥ on a film erase the ids it was looked up by, which is the opposite
  // of the repair this list exists for.
  movie: [
    'title', 'director', 'publisher', 'release_year', 'release_circa',
    'description', 'genres', 'media_type', 'series', 'series_index',
    'favorite', 'imdb_id',
  ],
}

// A row with something recognisable in every stored field, so a dropped one shows
// up as a missing key rather than as an empty string that might have been empty
// all along. The values are per-field on purpose: two fields sharing a value
// cannot catch a state function that copies one into the other's slot.
const filled = (fields) => {
  const row = { id: 7 }
  for (const f of fields) row[f] = `value-of-${f}`
  // The fields whose types matter to the state functions' own coercions: `??` vs
  // `||` on a zero, and Number() on a chapter number.
  Object.assign(row, {
    favorite: true, tags: ['a-tag'], chapter_no: 12.5,
    season: 0, episode: 0, board_id: 3,
    sticker_id: 4, sticker_x: 0.5, sticker_y: 0.25,
  })
  return row
}

// A LIST PER KIND, not one function. A book is saved by two different builders —
// bookState for the ♥ and the shelf, fullState for the Details panel — and they
// are written out separately in two files. Checking one and not the other leaves
// the other free to drift, which is how they came to disagree in the first place.
const STATE = {
  annotation: [annotationState],
  dialogue: [dialogueState],
  quote: [utteranceState],
  book: [bookState, (r) => fullState('book', r)],
  movie: [movieState, (r) => fullState('movie', r)],
}

// A builder's own name, for the failure message — an anonymous arrow says
// nothing about which of a kind's two builders dropped the field.
const NAMES = {
  book: ['bookState', "fullState('book')"],
  movie: ['movieState', "fullState('movie')"],
}
const nameOf = (kind, i) => NAMES[kind]?.[i] || STATE[kind][i].name || `builder ${i}`

describe('the object a card saves carries everything the row stores', () => {
  for (const [kind, fields] of Object.entries(STORED)) {
    it(`${kind}: no stored field is dropped`, () => {
      STATE[kind].forEach((build, i) => {
        const body = build(filled(fields))
        const missing = fields.filter((f) => !(f in body))
        expect(missing, `${nameOf(kind, i)} would clear these on every ♥, colour pick and drag`).toEqual([])
      })
    })

    // A key that is PRESENT but undefined is the same loss with extra steps: JSON
    // .stringify drops it, so the request body is identical to one that never
    // named the field.
    it(`${kind}: and none of them arrives as undefined`, () => {
      STATE[kind].forEach((build, i) => {
        const body = build(filled(fields))
        const vanishing = Object.keys(body).filter((k) => body[k] === undefined)
        expect(vanishing, `${nameOf(kind, i)}: JSON.stringify drops these, so the server never sees them`).toEqual([])
      })
    })
  }

  // A zero is a value. Season 0 is where a show keeps its specials, and a chapter
  // number is a real number — so `||` in place of `??` on either is a silent
  // rewrite of the row rather than a dropped field, which the presence checks
  // above cannot see.
  it('a zero survives, on the two fields where zero means something', () => {
    const d = dialogueState({ quote: 'x', season: 0, episode: 0 })
    expect(d.season, 'season 0 is where the specials live').toBe(0)
    expect(d.episode).toBe(0)
  })

  // An empty row must not throw: the review card edits a quote it holds only a
  // partial copy of, and a state function that assumed every key was present
  // would take the card down rather than send a blank field.
  it('a sparse row does not throw', () => {
    for (const kind of Object.keys(STATE)) {
      STATE[kind].forEach((build, i) => {
        expect(() => build({ id: 1, quote: 'just the words' }), nameOf(kind, i)).not.toThrow()
      })
    }
  })
})

describe('the translation reaches every kind (0051)', () => {
  it('is carried by all three, since a recolour must not erase it', () => {
    // The three QUOTE kinds. A book and a film have no translation column —
    // 0051 put it on the quote, not on the work it came from.
    for (const kind of ['annotation', 'dialogue', 'quote']) {
      const body = STATE[kind][0]({ quote: 'x', translation: 'what it says' })
      expect(body.translation, `${kind} drops the translation`).toBe('what it says')
    }
  })
})
