// works.jsx — the shelf and grouping logic shared by Library and the Catalogue.
//
// groupWorks is the largest pure function in the frontend and it is used by two
// screens (the Library/Catalogue group-by and Search's grouped results), so one
// regression here shows up in two places that look unrelated. Its ordering rules
// are all different from each other on purpose — series and credit
// alphabetical, decade newest first, genre by size — and the residual bucket
// always sinks, which is the part most likely to get lost in a refactor.

import { describe, expect, it } from 'vitest'
import {
  SHELF_CAPS,
  activeStatusFor,
  capKeyFor,
  creditLabelFor,
  creditNounFor,
  decadeOf,
  groupWorks,
  isActive,
  moveLabel,
  personKindFor,
  pinInProgress,
  posUnitFor,
  positionLabel,
  shelfState,
  statusFilter,
  wishFilter,
} from '../../src/works.jsx'

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

  // D comes before A in the input. If members were ever sorted by title this
  // would read ['A','D'] — which is exactly what the old fixture asserted, and
  // why it could not tell the two apart.
  it('keeps members in the incoming order, not sorted', () => {
    const unsorted = [
      { title: 'D', series: 'Earthsea' },
      { title: 'A', series: 'Earthsea' },
    ]
    expect(titles(groupWorks(unsorted, 'series')[0])).toEqual(['D', 'A'])
  })

  it('marks the catch-all bucket as residual', () => {
    const g = groupWorks(list, 'series').find((x) => x.label === 'No series')
    expect(g.residual).toBe(true)
    expect(titles(g)).toEqual(['B'])
  })
})

describe('groupWorks — author', () => {
  const credit = (it) => it.author
  const list = [
    { title: 'A', author: 'Le Guin' },
    { title: 'B', author: '' },
    { title: 'C', author: 'Atwood' },
  ]

  it('groups by credit with the unknown bucket last', () => {
    expect(labels(groupWorks(list, 'author', { credit }))).toEqual(['Atwood', 'Le Guin', 'Unknown'])
  })

  it('takes a custom residual label', () => {
    const groups = groupWorks(list, 'author', { credit, creditResidual: 'No director' })
    expect(labels(groups)).toEqual(['Atwood', 'Le Guin', 'No director'])
  })

  // A joined credit puts the work in EVERY co-author's bucket — the same work
  // appears more than once, which is the whole point of splitting.
  it('files a joined credit under each name when splitting is on', () => {
    const joined = [{ title: 'Good Omens', author: 'Neil Gaiman & Terry Pratchett' }]
    const groups = groupWorks(joined, 'author', { credit, splitCredit: true })
    expect(labels(groups)).toEqual(['Neil Gaiman', 'Terry Pratchett'])
    expect(titles(groups[0])).toEqual(['Good Omens'])
    expect(titles(groups[1])).toEqual(['Good Omens'])
  })

  it('leaves a joined credit whole when splitting is off', () => {
    const joined = [{ title: 'Good Omens', author: 'Neil Gaiman & Terry Pratchett' }]
    expect(labels(groupWorks(joined, 'author', { credit }))).toEqual(['Neil Gaiman & Terry Pratchett'])
  })
})

describe('groupWorks — decade', () => {
  const year = (it) => it.year
  const list = [
    { title: 'A', year: 1954 },
    { title: 'B', year: null },
    { title: 'C', year: 2001 },
    { title: 'D', year: 1959 },
  ]

  it('orders newest first, unknown last', () => {
    expect(labels(groupWorks(list, 'decade', { year }))).toEqual(['2000s', '1950s', 'Unknown year'])
  })

  it('buckets by the full four-digit year, not the last two', () => {
    const old = [{ title: 'X', year: 1850 }, { title: 'Y', year: 1950 }]
    expect(labels(groupWorks(old, 'decade', { year }))).toEqual(['1950s', '1850s'])
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

  it('orders by size, then alphabetically, with no-genre last', () => {
    expect(labels(groupWorks(list, 'genre', { genres }))).toEqual(['SF', 'Fantasy', 'No genre'])
  })

  it('breaks a size tie on the label', () => {
    const tied = [{ title: 'A', genres: ['Zoology'] }, { title: 'B', genres: ['Archery'] }]
    expect(labels(groupWorks(tied, 'genre', { genres }))).toEqual(['Archery', 'Zoology'])
  })

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

  it('counts a multi-genre work once per genre when sizing the buckets', () => {
    const groups = groupWorks(list, 'genre', { genres })
    expect(groups.map((g) => g.items.length)).toEqual([3, 2, 1])
  })
})

describe('groupWorks — general', () => {
  it('returns nothing for an empty list', () => {
    expect(groupWorks([], 'series')).toEqual([])
  })

  it('sorts members when asked, but never the residual bucket', () => {
    const list = [
      { title: 'B', series: 'S' },
      { title: 'A', series: 'S' },
      { title: 'Z', series: null },
      { title: 'Y', series: null },
    ]
    const groups = groupWorks(list, 'series', {
      sortMembers: (items) => [...items].sort((a, b) => a.title.localeCompare(b.title)),
    })
    expect(titles(groups[0])).toEqual(['A', 'B'])
    // The residual bucket is deliberately left in incoming order.
    expect(titles(groups[1])).toEqual(['Z', 'Y'])
  })

  // The contract is sortMembers(members, dim), and BOTH production callers
  // branch on dim — Library and Movies pass
  //   (items, dim) => dim === 'series' ? [...items].sort(bySeries) : items
  // so if dim stopped being passed, series group-by would silently stop sorting
  // its members on both screens with nothing to notice.
  it('passes the dimension to sortMembers', () => {
    const seen = []
    groupWorks([{ title: 'A', series: 'S' }], 'series', {
      sortMembers: (items, dim) => {
        seen.push(dim)
        return items
      },
    })
    expect(seen).toEqual(['series'])
  })

  it('passes the dimension for every dimension, not just series', () => {
    const seen = []
    const opts = {
      credit: (it) => it.author,
      year: (it) => it.year,
      genres: (it) => it.genres || [],
      sortMembers: (items, dim) => {
        seen.push(dim)
        return items
      },
    }
    const one = [{ title: 'A', series: 'S', author: 'X', year: 1990, genres: ['SF'] }]
    for (const dim of ['series', 'author', 'decade', 'genre']) groupWorks(one, dim, opts)
    expect(seen).toEqual(['series', 'author', 'decade', 'genre'])
  })
})

describe('shelfState', () => {
  // One test over all five rows rather than four: every case is the same
  // shelfState(kind, row) call with different arguments, so the aggregate names
  // every row that reads wrong at once instead of dying on the first.
  it('prefers an explicit status, then reads its own side’s count', () => {
    const cases = [
      { name: 'prefers an explicit status', kind: 'book', row: { status: 'paused', annotation_count: 0 }, want: 'paused' },
      { name: 'reads an unquoted book with no status as a wishlist entry', kind: 'book', row: { annotation_count: 0 }, want: 'wishlist' },
      { name: 'reads an unquoted film with no status as a wishlist entry', kind: 'movie', row: { dialogue_count: 0 }, want: 'wishlist' },
      { name: 'reads a quoted work with no status as plainly in the library', kind: 'book', row: { annotation_count: 3 }, want: null },
      // The two sides count different columns; reading the wrong one would make
      // every film look like a wishlist entry.
      { name: 'counts dialogues for the screen side, not annotations', kind: 'movie', row: { annotation_count: 5, dialogue_count: 0 }, want: 'wishlist' },
    ]
    const got = cases.map(({ name, kind, row }) => [name, shelfState(kind, row)])
    expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
  })
})

describe('wishFilter', () => {
  const count = (it) => it.n
  const list = [{ n: 0, title: 'empty' }, { n: 3, title: 'quoted' }]

  // One test over all three modes rather than three: each case is the same
  // wishFilter(list, mode, count) call over the same fixture, and the aggregate
  // names every mode that keeps the wrong rows at once. The no-mode row compares
  // titles rather than only counting them, which asserts strictly more.
  it('keeps the works the chip’s mode asks for', () => {
    const cases = [
      { name: 'passes everything through with no mode', mode: '', want: ['empty', 'quoted'] },
      { name: 'keeps only unquoted works for wishlist', mode: 'wishlist', want: ['empty'] },
      { name: 'keeps only quoted works for annotated', mode: 'annotated', want: ['quoted'] },
    ]
    const got = cases.map(({ name, mode }) => [name, wishFilter(list, mode, count).map((x) => x.title)])
    expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
  })

  // Documented in works.jsx: the filter keys on the count, NOT shelfState. A
  // book you are reading with no quotes yet draws the reading mark but is still
  // un-annotated, and the two chips must not disagree about the same row.
  it('hides a reading-but-unquoted book from annotated', () => {
    const reading = [{ n: 0, status: 'reading', title: 'started' }]
    expect(wishFilter(reading, 'annotated', count)).toHaveLength(0)
    expect(wishFilter(reading, 'wishlist', count)).toHaveLength(1)
  })
})

describe('statusFilter', () => {
  const list = [{ status: 'reading' }, { status: 'paused' }, { status: undefined }]

  // One test over all four rows rather than three: every case is the same
  // statusFilter(list, selection) call over the same fixture, so the aggregate
  // names every selection that keeps the wrong number at once.
  it('keeps the works whose state the selection names', () => {
    const cases = [
      { name: 'treats an empty selection as every state', selection: [], want: 3 },
      { name: 'treats a missing selection as every state', selection: undefined, want: 3 },
      { name: 'matches statusless works under "none"', selection: ['none'], want: 1 },
      { name: 'keeps the selected states', selection: ['reading', 'paused'], want: 2 },
    ]
    const got = cases.map(({ name, selection }) => [name, statusFilter(list, selection).length])
    expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
  })
})

describe('pinInProgress', () => {
  it('floats the active work to the front, keeping both blocks in order', () => {
    const list = [{ id: 1 }, { id: 2, status: 'reading' }, { id: 3 }, { id: 4, status: 'reading' }]
    expect(pinInProgress(list, 'book').map((x) => x.id)).toEqual([2, 4, 1, 3])
  })

  it('returns the list untouched when nothing or everything is active', () => {
    const none = [{ id: 1 }, { id: 2 }]
    const all = [{ id: 1, status: 'reading' }, { id: 2, status: 'reading' }]
    expect(pinInProgress(none, 'book')).toBe(none)
    expect(pinInProgress(all, 'book')).toBe(all)
  })

  // Only the active state pins. Paused, abandoned and completed are not what
  // you are on with right now.
  // The name of this test used to claim abandoned and the fixture did not
  // contain one, so isActive could have started matching it freely.
  it('does not pin paused, abandoned or completed', () => {
    const list = [
      { id: 1 },
      { id: 2, status: 'paused' },
      { id: 3, status: 'completed' },
      { id: 4, status: 'abandoned' },
    ]
    expect(pinInProgress(list, 'book').map((x) => x.id)).toEqual([1, 2, 3, 4])
    for (const status of ['paused', 'completed', 'abandoned', 'wishlist', undefined]) {
      expect(isActive('book', { status })).toBe(false)
    }
  })

  it('pins on watching for the screen side', () => {
    const list = [{ id: 1 }, { id: 2, status: 'watching' }]
    expect(pinInProgress(list, 'movie').map((x) => x.id)).toEqual([2, 1])
    expect(isActive('movie', { status: 'watching' })).toBe(true)
    expect(isActive('book', { status: 'watching' })).toBe(false)
  })

  // A game is PLAYED. isActive used to key on the kind alone, so a game — which
  // is a movies-table row — would have been measured against 'watching' and
  // never pinned to the top of its own board, with nothing raised.
  it('pins on playing for a game, not watching', () => {
    const game = { id: 2, media_type: 'game', status: 'playing' }
    expect(isActive('movie', game)).toBe(true)
    expect(pinInProgress([{ id: 1 }, game], 'movie').map((x) => x.id)).toEqual([2, 1])
    // The film's word must NOT count as active on a game, or a stale 'watching'
    // left on a game row would pin it.
    expect(isActive('movie', { media_type: 'game', status: 'watching' })).toBe(false)
    // And the reverse: a film is not active because it says 'playing'.
    expect(isActive('movie', { media_type: 'movie', status: 'playing' })).toBe(false)
  })

  it('gives each media type its own in-progress word', () => {
    expect(activeStatusFor('book', {})).toBe('reading')
    expect(activeStatusFor('movie', {})).toBe('watching')
    expect(activeStatusFor('movie', { media_type: 'show' })).toBe('watching')
    expect(activeStatusFor('movie', { media_type: 'game' })).toBe('playing')
  })
})

// The shelf caps mirror shelfCap() in internal/httpapi/shelf.go, which ends in a
// NAMED arm per media type rather than a bare default — a game inheriting the
// film cap of two was the failure that guard exists for.
describe('SHELF_CAPS', () => {
  it('gives games their own cap rather than the film default', () => {
    expect(SHELF_CAPS.book).toBe(5)
    expect(SHELF_CAPS.movie).toBe(2)
    expect(SHELF_CAPS.show).toBe(5)
    expect(SHELF_CAPS.game).toBe(3)
  })

  it('has a cap for every cap key capKeyFor can produce', () => {
    for (const item of [{}, { media_type: 'show' }, { media_type: 'game' }]) {
      expect(SHELF_CAPS[capKeyFor('movie', item)]).toBeGreaterThan(0)
    }
    expect(SHELF_CAPS[capKeyFor('book', {})]).toBeGreaterThan(0)
  })
})

describe('credit vocabulary by media type', () => {
  // One definition each, because these were four inline ternaries across the add
  // form, the edit form and the detail header before games existed.
  it('names the primary credit', () => {
    expect(creditNounFor('movie')).toBe('Director')
    expect(creditNounFor('show')).toBe('Creator')
    expect(creditNounFor('game')).toBe('Studio')
    expect(creditNounFor(undefined)).toBe('Director')
  })

  it('labels the credit line', () => {
    expect(creditLabelFor('movie')).toBe('DIR.')
    expect(creditLabelFor('show')).toBe('CREATED BY')
    expect(creditLabelFor('game')).toBe('STUDIO')
  })

  // A studio and a director share movies.director and are told apart only by
  // media_type — so the people-console kind has to follow the media type, or a
  // studio is looked up among the film directors and renamed across the wrong
  // half of the catalogue.
  it('routes a game credit to the studio kind', () => {
    expect(personKindFor('game')).toBe('studio')
    expect(personKindFor('movie')).toBe('director')
    expect(personKindFor('show')).toBe('director')
  })
})

describe('moveLabel', () => {
  // One test over all eight rows rather than two: every case is the same
  // moveLabel(kind, from, to) call with no setup, and holding the game rows and
  // the film/book rows in one table keeps the property and its converse side by
  // side — the aggregate names every label that drifted, in both halves at once.
  it('uses play wording for a game and leaves the film and book wording alone', () => {
    const cases = [
      // uses play wording for a game
      { name: 'game · nothing → playing', args: ['movie', '', 'playing'], want: 'Mark as playing' },
      { name: 'game · completed → playing', args: ['movie', 'completed', 'playing'], want: 'Play it again' },
      { name: 'game · paused → playing', args: ['movie', 'paused', 'playing'], want: 'Carry on playing' },
      { name: 'game · playing → completed', args: ['movie', 'playing', 'completed'], want: 'Mark as played' },
      // leaves the film and book wording alone
      { name: 'film · nothing → watching', args: ['movie', '', 'watching'], want: 'Mark as watching' },
      { name: 'film · watching → completed', args: ['movie', 'watching', 'completed'], want: 'Mark as watched' },
      { name: 'book · nothing → reading', args: ['book', '', 'reading'], want: 'Mark as reading' },
      { name: 'book · reading → completed', args: ['book', 'reading', 'completed'], want: 'Mark as read' },
    ]
    const got = cases.map(({ name, args }) => [name, moveLabel(...args)])
    expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
  })
})

describe('positionLabel', () => {
  // One test over all nine rows rather than five: every case is the same
  // positionLabel(row) call on a pure function with no setup, and the aggregate
  // names every row that formats wrong at once instead of dying on the first.
  // Each row keeps the rule it was written for as its name.
  it('formats a position per unit, or says nothing at all', () => {
    const cases = [
      { name: 'reads a book position in pages', row: { pos_unit: 'page', pos: 128, pos_total: 320 }, want: 'p. 128 of 320' },
      // Both halves are padded to the same width so a column of these cannot rag,
      // and two digits is the floor even when the total needs one.
      { name: 'zero-pads an episode pair to a common width', row: { pos_unit: 'episode', pos: 6, pos_total: 10, season: 2, season_total: 3 }, want: 'E06/10 · S02/03' },
      { name: 'pads the episode to the width of a three-digit run', row: { pos_unit: 'episode', pos: 6, pos_total: 456 }, want: 'E006/456' },
      { name: 'pads a two-digit episode to the same three', row: { pos_unit: 'episode', pos: 11, pos_total: 123 }, want: 'E011/123' },
      { name: 'drops the season when there is no run to place it in', row: { pos_unit: 'episode', pos: 3, pos_total: 8 }, want: 'E03/08' },
      // season and season_total are separate fields, so "I know it runs to three
      // series, I have not said which I am on" is a real shape. It defaults to the
      // first, not to a zeroth that does not exist.
      { name: 'defaults to season one when the run is known but the position is not', row: { pos_unit: 'episode', pos: 6, pos_total: 10, season_total: 3 }, want: 'E06/10 · S01/03' },
      { name: 'is empty for a work tracked as a bare percentage', row: { pos: 40 }, want: '' },
      { name: 'is empty for no work at all', row: null, want: '' },
      { name: 'is empty for a unit with no total to measure against', row: { pos_unit: 'page', pos: 10 }, want: '' },
    ]
    const got = cases.map(({ name, row }) => [name, positionLabel(row)])
    expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
  })
})

describe('decadeOf / capKeyFor / posUnitFor', () => {
  it('floors a year to its decade', () => {
    expect(decadeOf(1954)).toBe(1950)
    expect(decadeOf(2000)).toBe(2000)
    expect(decadeOf(null)).toBe(null)
    expect(decadeOf(0)).toBe(null)
  })

  it('separates films from shows and games for the shelf cap', () => {
    expect(capKeyFor('book', {})).toBe('book')
    expect(capKeyFor('movie', { media_type: 'show' })).toBe('show')
    expect(capKeyFor('movie', { media_type: 'game' })).toBe('game')
    expect(capKeyFor('movie', {})).toBe('movie')
  })

  it('names the unit a work is counted in', () => {
    expect(posUnitFor('book', {})).toBe('page')
    expect(posUnitFor('movie', { media_type: 'show' })).toBe('episode')
    expect(posUnitFor('movie', {})).toBe('')
  })
})

// The generic facet dimension: any dim that is not one of the four known ones is
// a caller-defined single-value bucket. Added for the Quotes screen, which
// groups by medium and by place — both exactly the shape 'series' has, and
// neither a series.
describe('groupWorks — a caller-defined facet', () => {
  const list = [
    { title: 'A', medium: 'radio' },
    { title: 'B', medium: 'speech' },
    { title: 'C', medium: 'radio' },
    { title: 'D', medium: '' },
  ]
  const opts = { facet: (it, dim) => it[dim], facetResidual: (dim) => `No ${dim}` }

  it('buckets by the accessor, alphabetically, residual last', () => {
    expect(labels(groupWorks(list, 'medium', opts))).toEqual(['radio', 'speech', 'No medium'])
  })

  it('passes the dimension to the accessor', () => {
    // Without the dim the accessor cannot serve two facets, and the Quotes
    // screen offers three. It would silently group everything as residual.
    const seen = []
    groupWorks(list, 'medium', { facet: (it, dim) => { seen.push(dim); return it[dim] } })
    expect(new Set(seen)).toEqual(new Set(['medium']))
  })

  it('names the residual bucket per dimension', () => {
    expect(groupWorks(list, 'medium', opts).at(-1).label).toBe('No medium')
    expect(groupWorks([{ place: '' }], 'place', opts).at(-1).label).toBe('No place')
  })

  it('defaults the residual label rather than throwing', () => {
    expect(groupWorks([{ medium: '' }], 'medium').at(-1).label).toBe('None')
  })

  it('leaves the four known dimensions alone', () => {
    // The facet branch is an `else`, so a bug there would capture 'series' and
    // 'genre' and quietly change two shipped screens.
    const works = [{ title: 'A', series: 'S', published_year: 1999 }]
    expect(labels(groupWorks(works, 'series'))).toEqual(['S'])
    expect(labels(groupWorks(works, 'decade', { year: (w) => w.published_year }))).toEqual(['1990s'])
  })
})
