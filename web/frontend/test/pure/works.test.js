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
  capKeyFor,
  decadeOf,
  groupWorks,
  isActive,
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

  it('keeps members in the incoming order', () => {
    const g = groupWorks(list, 'series').find((x) => x.label === 'Earthsea')
    expect(titles(g)).toEqual(['A', 'D'])
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
})

describe('shelfState', () => {
  it('prefers an explicit status', () => {
    expect(shelfState('book', { status: 'paused', annotation_count: 0 })).toBe('paused')
  })

  it('reads an unquoted work with no status as a wishlist entry', () => {
    expect(shelfState('book', { annotation_count: 0 })).toBe('wishlist')
    expect(shelfState('movie', { dialogue_count: 0 })).toBe('wishlist')
  })

  it('reads a quoted work with no status as plainly in the library', () => {
    expect(shelfState('book', { annotation_count: 3 })).toBe(null)
  })

  // The two sides count different columns; reading the wrong one would make
  // every film look like a wishlist entry.
  it('counts dialogues for the screen side, not annotations', () => {
    expect(shelfState('movie', { annotation_count: 5, dialogue_count: 0 })).toBe('wishlist')
  })
})

describe('wishFilter', () => {
  const count = (it) => it.n
  const list = [{ n: 0, title: 'empty' }, { n: 3, title: 'quoted' }]

  it('passes everything through with no mode', () => {
    expect(wishFilter(list, '', count)).toHaveLength(2)
  })

  it('keeps only unquoted works for wishlist', () => {
    expect(wishFilter(list, 'wishlist', count).map((x) => x.title)).toEqual(['empty'])
  })

  it('keeps only quoted works for annotated', () => {
    expect(wishFilter(list, 'annotated', count).map((x) => x.title)).toEqual(['quoted'])
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

  it('treats an empty selection as every state', () => {
    expect(statusFilter(list, [])).toHaveLength(3)
    expect(statusFilter(list, undefined)).toHaveLength(3)
  })

  it('matches statusless works under "none"', () => {
    expect(statusFilter(list, ['none'])).toHaveLength(1)
  })

  it('keeps the selected states', () => {
    expect(statusFilter(list, ['reading', 'paused'])).toHaveLength(2)
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
  it('does not pin paused, abandoned or completed', () => {
    const list = [{ id: 1 }, { id: 2, status: 'paused' }, { id: 3, status: 'completed' }]
    expect(pinInProgress(list, 'book').map((x) => x.id)).toEqual([1, 2, 3])
  })

  it('pins on watching for the screen side', () => {
    const list = [{ id: 1 }, { id: 2, status: 'watching' }]
    expect(pinInProgress(list, 'movie').map((x) => x.id)).toEqual([2, 1])
    expect(isActive('movie', { status: 'watching' })).toBe(true)
    expect(isActive('book', { status: 'watching' })).toBe(false)
  })
})

describe('positionLabel', () => {
  it('reads a book position in pages', () => {
    expect(positionLabel({ pos_unit: 'page', pos: 128, pos_total: 320 })).toBe('p. 128 of 320')
  })

  // Both halves are padded to the same width so a column of these cannot rag,
  // and two digits is the floor even when the total needs one.
  it('zero-pads an episode pair to a common width', () => {
    expect(positionLabel({ pos_unit: 'episode', pos: 6, pos_total: 10, season: 2, season_total: 3 }))
      .toBe('E06/10 · S02/03')
    expect(positionLabel({ pos_unit: 'episode', pos: 6, pos_total: 456 })).toBe('E006/456')
    expect(positionLabel({ pos_unit: 'episode', pos: 11, pos_total: 123 })).toBe('E011/123')
  })

  it('drops the season when there is no run to place it in', () => {
    expect(positionLabel({ pos_unit: 'episode', pos: 3, pos_total: 8 })).toBe('E03/08')
  })

  it('is empty for a work tracked as a bare percentage', () => {
    expect(positionLabel({ pos: 40 })).toBe('')
    expect(positionLabel(null)).toBe('')
    expect(positionLabel({ pos_unit: 'page', pos: 10 })).toBe('')
  })
})

describe('decadeOf / capKeyFor / posUnitFor', () => {
  it('floors a year to its decade', () => {
    expect(decadeOf(1954)).toBe(1950)
    expect(decadeOf(2000)).toBe(2000)
    expect(decadeOf(null)).toBe(null)
    expect(decadeOf(0)).toBe(null)
  })

  it('separates films from shows for the shelf cap', () => {
    expect(capKeyFor('book', {})).toBe('book')
    expect(capKeyFor('movie', { media_type: 'show' })).toBe('show')
    expect(capKeyFor('movie', {})).toBe('movie')
  })

  it('names the unit a work is counted in', () => {
    expect(posUnitFor('book', {})).toBe('page')
    expect(posUnitFor('movie', { media_type: 'show' })).toBe('episode')
    expect(posUnitFor('movie', {})).toBe('')
  })
})
