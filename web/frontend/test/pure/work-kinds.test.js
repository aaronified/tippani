// THE SWEEP INVARIANT FOR THE KIND TABLE.
//
// workKinds.js exists so that one work-detail screen can serve a book, a film, a
// show and a game — which means the screen stops asking "am I a film?" and starts
// asking the table. The failure mode that replaces the old one is therefore not a
// screen that drifted; it is a ROW THAT IS HALF FILLED IN. Add a fifth media type,
// forget its `quoteUnit`, and the board's counts say `undefined` in a language
// nobody has; forget its `capWords` and the cap dialog opens blank.
//
// So this file asks three things of the table and nothing about taste:
//
//   1. EVERY WORK KIND ANSWERS EVERY FIELD the shared screen will read. Not a
//      hand-written list of kinds against a hand-written list of fields — the
//      fields are taken from the `book` row, which is the one the merged screen
//      was lifted out of, so a field that screen comes to need is a field this
//      test starts demanding of the other three the moment it is added to book.
//
//   2. THE KEY SETS AGREE WITH works.jsx. ACTIVE_STATUS, SHELF_CAPS and this
//      table are three tables keyed the same way, and the in-progress word and
//      the cap number stay in works.jsx because the server mirrors them. Three
//      tables keyed the same way is exactly the shape where a fifth kind gets
//      added to two of them.
//
//   3. EVERY LOCALE KEY THE TABLE NAMES EXISTS. locale-complete already fails on
//      a key the source asks for and en.txt lacks, but it scans for key-SHAPED
//      literals — and it cannot tell that `spec.detail.export` is reached through
//      t(). Reading the table structurally is the only way to know that the
//      field a screen will index actually resolves.
//
// WHAT THIS DOES NOT ASSERT: that the values are the RIGHT ones. That the book
// board sorts by six dimensions and the film by six is a fact about the boards,
// and the board tests drive the real controls to prove it. This file proves the
// table is complete and internally consistent, which is the property no rendered
// test can see.

import { describe, expect, it } from 'vitest'
import { KINDS, WORK_KINDS, bookGenres, locatorsFor, specFor } from '../../src/workKinds.js'
import { ACTIVE_STATUS, SHELF_CAPS } from '../../src/works.jsx'
import { EN } from '../locale-file.js'

const enHas = (k) => Object.prototype.hasOwnProperty.call(EN.keys, k)

// The resolved spec for each kind, which is what a screen actually holds.
const resolved = Object.fromEntries(
  WORK_KINDS.map((k) => [k, specFor(KINDS[k].side, { media_type: KINDS[k].mediaType })]),
)
// Every row including the card-only one, which inherits nothing and is already
// whole.
const specOf = { ...KINDS, ...resolved }

describe('the four work kinds', () => {
  it('are the four the shelf tables are keyed by, and no others', () => {
    expect(WORK_KINDS).toEqual(['book', 'movie', 'show', 'game'])
    // Keyed the same way, or the cap dialog and the in-progress word disagree
    // with the screen that draws them.
    expect(Object.keys(ACTIVE_STATUS).sort()).toEqual([...WORK_KINDS].sort())
    expect(Object.keys(SHELF_CAPS).sort()).toEqual([...WORK_KINDS].sort())
  })

  it('leaves the card-only quote row out of the work sweep', () => {
    // Quotes.jsx is not part of the work-detail merge, and a sweep that included
    // it would demand a workPath of a thing that has no page.
    expect(KINDS.quote.hasWorkPage).toBe(false)
    expect(WORK_KINDS).not.toContain('quote')
    expect(KINDS.quote.card).toBeTruthy() // but the card still gets its answer
  })

  // The field list is the book row's, on purpose: see the header. Functions and
  // explicit nulls both count as answered — `origLanguage: null` is the film
  // saying "no such fact", which is an answer.
  const FIELDS = Object.keys(KINDS.book)
  it.each(WORK_KINDS)('%s answers every field the book row declares', (kind) => {
    const spec = resolved[kind]
    const unanswered = FIELDS.filter((f) => f !== 'inherits' && spec[f] === undefined)
    expect(unanswered, `${kind} has no answer for: ${unanswered.join(', ')}`).toEqual([])
  })

  it.each(WORK_KINDS)('%s names itself consistently', (kind) => {
    const spec = resolved[kind]
    expect(spec.kind).toBe(kind)
    // The side is the endpoint family; three kinds share one.
    expect(['book', 'movie']).toContain(spec.side)
    expect(spec.mediaType === null || spec.mediaType === kind).toBe(true)
  })
})

describe('specFor', () => {
  it('reads a book from its side alone, because a book has no media_type', () => {
    expect(specFor('book', null).kind).toBe('book')
    expect(specFor('book', { id: 1 }).kind).toBe('book')
  })

  it('tells a film, a show and a game apart by media_type', () => {
    expect(specFor('movie', { media_type: 'movie' }).kind).toBe('movie')
    expect(specFor('movie', { media_type: 'show' }).kind).toBe('show')
    expect(specFor('movie', { media_type: 'game' }).kind).toBe('game')
  })

  // The row is not loaded on the first render, and the screen still has to draw.
  it('stands the side in for the kind before the row has arrived', () => {
    expect(specFor('movie', null).kind).toBe('movie')
    expect(specFor('movie', {}).kind).toBe('movie')
  })

  it('resolves a show and a game to a complete spec, not a patch', () => {
    const show = specFor('movie', { media_type: 'show' })
    // Restated by the show row.
    expect(show.unit.one).toBe('unit.show.one')
    expect(show.credits[0].labelKey).toBe('common.badge.created-by')
    // Inherited from the film row, and this is the half a patch would lose.
    expect(show.workPath).toBe('movies')
    expect(show.seenKind).toBe('screen')
    expect(show.board.filterTitle).toBe('film.lines.filter.title')
    expect(show.card.skin).toBe('frame')
  })

  it('does not let a show or game mutate the film row it inherits', () => {
    specFor('movie', { media_type: 'show' }).kind = 'tampered'
    expect(KINDS.movie.kind).toBe('movie')
  })
})

describe('the locale keys the table names', () => {
  // Walk the table structurally. A string that looks like a key IS one here —
  // the table holds nothing else that is dotted and lower-kebab.
  const KEYISH = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\.[a-z0-9-]+$/
  // Values that are deliberately not locale keys: wire words, storage keys,
  // field names and the two enumerations.
  const NOT_KEYS = new Set([
    'kind', 'side', 'mediaType', 'workPath', 'workListKey', 'quotePath', 'quoteListKey',
    'quoteParam', 'addTarget', 'practiseParam', 'seedField', 'seenKind', 'workActionKind',
    'quoteActionKind', 'selectKind', 'screenLabel', 'scrollKey', 'shelfKind', 'statusFields',
    'facts', 'factDoors', 'requires', 'stateBuilder', 'carried', 'cleared', 'meta', 'views',
    'sortDims', 'groupDims', 'defaultSort', 'card', 'countsTone', 'yearField', 'circaField',
    'persist', 'field', 'personKind', 'suggest', 'input', 'options', 'key', 'fillsFrom',
    'requiredFor', 'faceFallback', 'family', 'inherits',
  ])

  function walk(node, path, out) {
    if (typeof node === 'string') {
      if (KEYISH.test(node)) out.push([path, node])
      return out
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, out))
      return out
    }
    if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) {
        if (NOT_KEYS.has(k)) continue
        walk(v, `${path}.${k}`, out)
      }
    return out
  }

  // THE RESOLVED SPEC, not the raw row. A show and a game are written as patches
  // over the film, so their own rows name a fraction of the keys their screen
  // will index — and it is the inherited half that a broken `inherits` would
  // silently drop. What must resolve is what a screen holds.
  it.each(Object.keys(KINDS))('%s names only keys en.txt has', (kind) => {
    const named = walk(specOf[kind], kind, [])
    // A floor, because a walk that finds nothing passes the real assertion below
    // vacuously. Per row rather than one number: the card-only quote row names
    // six keys and a work page names dozens, and a floor set for the second
    // would have to be lowered to the first to be true of both.
    const floor = KINDS[kind].hasWorkPage ? 20 : 5
    expect(named.length, `${kind}: the walk found ${named.length} keys — broken?`).toBeGreaterThanOrEqual(floor)
    const absent = named.filter(([, k]) => !enHas(k))
    expect(absent.map(([p, k]) => `${p} = ${k}`)).toEqual([])
  })

  it('reads the whole table, not one corner of it', () => {
    const all = Object.keys(KINDS).flatMap((k) => walk(specOf[k], k, []))
    expect(all.length).toBeGreaterThan(100)
  })

  // The two shapes the app asks a plural in. `family` is for t(family, {count}),
  // which resolves .one or .other by the active language's own rules — so both
  // English forms must exist for the family to be answerable here.
  it.each(Object.keys(KINDS))('%s can be counted in both forms', (kind) => {
    const spec = resolved[kind] || KINDS[kind]
    for (const u of [spec.unit, spec.quoteUnit].filter(Boolean)) {
      expect(enHas(u.one), `${kind}: ${u.one}`).toBe(true)
      expect(enHas(u.other), `${kind}: ${u.other}`).toBe(true)
      expect(u.one).toBe(`${u.family}.one`)
      expect(u.other).toBe(`${u.family}.other`)
    }
  })
})

describe('the shelf', () => {
  it.each(WORK_KINDS)('%s carries the status fields its own PUT sends', (kind) => {
    const spec = resolved[kind]
    // progress and the position are the four every side sends; a field missing
    // from this list is a field the full-state PUT would clear.
    expect(spec.statusFields).toContain('progress')
    expect(spec.statusFields).toContain('pos')
    expect(spec.statusFields).toContain('pos_total')
    expect(spec.statusFields).toContain('pos_unit')
  })

  // The catalogue's three kinds are one table, and the server derives a show's
  // percentage from its season. A book has no season column at all.
  it('sends a season from the catalogue side and never from the books side', () => {
    expect(resolved.book.statusFields).not.toContain('season')
    for (const k of ['movie', 'show', 'game']) {
      expect(resolved[k].statusFields, k).toContain('season')
      expect(resolved[k].statusFields, k).toContain('season_total')
    }
  })

  it('gives every kind the three dates a transition can ask for', () => {
    for (const k of WORK_KINDS) {
      const d = resolved[k].shelfDate
      expect(Object.keys(d).sort(), k).toEqual(['abandoned', 'active', 'completed'])
    }
  })

  // A game is played, not watched, and the cap dialog's settled word is shared
  // with the transitions menu on purpose so the two cannot disagree.
  it('names a game in the words a game is played in', () => {
    expect(ACTIVE_STATUS.game).toBe('playing')
    expect(resolved.game.capWords.one).toBe('unit.game.one')
    expect(resolved.game.capWords.past).toBe('common.shelf.move.completed.played.label')
    expect(resolved.game.capWords.past).not.toBe(resolved.movie.capWords.past)
  })
})

describe('locatorsFor', () => {
  const book = resolved.book
  const movie = resolved.movie
  const show = resolved.show
  const game = resolved.game
  const keys = (spec, row) => locatorsFor(spec, row).map((l) => l.key)

  it('is this kind own locators when the row carries nothing else', () => {
    expect(keys(book, { chapter: 'One' })).toEqual(['chapter_no', 'chapter', 'location'])
    expect(keys(movie, { timestamp: '01:12' })).toEqual(['timestamp'])
    expect(keys(show, {})).toEqual(['season', 'episode', 'timestamp'])
    expect(keys(game, {})).toEqual(['act', 'quest'])
  })

  // A work's media_type can be changed after its lines were captured, and the
  // reader must be able to see and clear what the row still holds.
  it('shows a stray field a flipped work still carries', () => {
    expect(keys(movie, { timestamp: '01:12', season: 2, episode: 6 })).toEqual([
      'timestamp', 'season', 'episode',
    ])
    expect(keys(game, { act: 'II', quest: 'The Ashes' })).toEqual(['act', 'quest'])
  })

  it('does not offer a box for a field this kind server clears', () => {
    // A game's timestamp is cleared on save, so a box for it would promise a
    // value that will not survive — worse than not showing it.
    expect(keys(game, { timestamp: '01:12', act: 'II' })).toEqual(['act', 'quest'])
    // A film's IS its own locator, so the same value is shown there.
    expect(keys(movie, { timestamp: '01:12' })).toContain('timestamp')
  })

  it('ignores an empty or absent stray rather than drawing an empty box', () => {
    expect(keys(movie, { season: '', episode: null, act: undefined })).toEqual(['timestamp'])
    expect(keys(movie, null)).toEqual(['timestamp'])
  })

  // Season 0 is a real season, and a chapter numbered 0 is a prologue.
  it('treats zero as a value', () => {
    expect(keys(movie, { season: 0 })).toContain('season')
    expect(keys(game, { chapter_no: 0 })).toContain('chapter_no')
  })

  it('never lists a locator twice, even though three kinds declare a timestamp', () => {
    const k = keys(book, { timestamp: '01:12', season: 1, episode: 2, act: 'I', quest: 'q' })
    expect(k.length).toBe(new Set(k).size)
  })
})

describe('bookGenres', () => {
  // Moved here from Library.jsx so the table is self-contained; these cases are
  // the ones its comment describes.
  it('splits a comma-joined member, title-cases it, and dedupes', () => {
    expect(bookGenres({ genres: ['science fiction, FANTASY'] })).toEqual(['Science Fiction', 'Fantasy'])
    expect(bookGenres({ genres: ['fantasy', 'Fantasy'] })).toEqual(['Fantasy'])
  })

  it('is empty for a book with none', () => {
    expect(bookGenres({})).toEqual([])
    expect(bookGenres({ genres: [] })).toEqual([])
    expect(bookGenres({ genres: ['', '  '] })).toEqual([])
  })
})
