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
import { annotationState } from '../../src/Library.jsx'
import { dialogueState } from '../../src/Movies.jsx'
import { utteranceState } from '../../src/Quotes.jsx'

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

const STATE = {
  annotation: annotationState,
  dialogue: dialogueState,
  quote: utteranceState,
}

describe('the object a card saves carries everything the row stores', () => {
  for (const [kind, fields] of Object.entries(STORED)) {
    it(`${kind}: no stored field is dropped`, () => {
      const body = STATE[kind](filled(fields))
      const missing = fields.filter((f) => !(f in body))
      expect(missing, `${kind} would clear these on every ♥, colour pick and drag`).toEqual([])
    })

    // A key that is PRESENT but undefined is the same loss with extra steps: JSON
    // .stringify drops it, so the request body is identical to one that never
    // named the field.
    it(`${kind}: and none of them arrives as undefined`, () => {
      const body = STATE[kind](filled(fields))
      const vanishing = Object.keys(body).filter((k) => body[k] === undefined)
      expect(vanishing, `${kind}: JSON.stringify drops these, so the server never sees them`).toEqual([])
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
      expect(() => STATE[kind]({ id: 1, quote: 'just the words' }), kind).not.toThrow()
    }
  })
})

describe('the translation reaches every kind (0051)', () => {
  it('is carried by all three, since a recolour must not erase it', () => {
    for (const kind of Object.keys(STATE)) {
      const body = STATE[kind]({ quote: 'x', translation: 'what it says' })
      expect(body.translation, `${kind} drops the translation`).toBe('what it says')
    }
  })
})
