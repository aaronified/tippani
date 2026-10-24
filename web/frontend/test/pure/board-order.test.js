// THE DIMENSIONS A FILM, A SHOW AND A GAME ORDER AND GROUP BY.
//
// WHY A SECOND ORDER FILE. annotation-order.test.js covers the book's — chapter,
// location, the three that can be absent — and it covered them against a sorter
// that only a book board called. The film board had its OWN comparator, which
// knew four dimensions, sent the other four to alphabetical-by-quote-text, and
// ran on the table view alone; the two views a reader actually reads in were
// served in whatever order the server sent. Folding the two means the film's
// dimensions are now the shared sorter's problem, and these are the cases that
// say so.
//
// THE DIMENSION LIST IS THE KIND'S. groupAnnotations refuses a dimension the kind
// did not declare, which is the guard that stops a film board grouping by
// chapter — so every case here passes the kind's own list rather than letting a
// default answer for it.

import { describe, expect, it } from 'vitest'

import { groupAnnotations, sortAnnotations } from '../../src/boardOrder.js'
import { KINDS } from '../../src/workKinds.js'

const SHOW = KINDS.show.groupDims
const GAME = KINDS.game.groupDims
const ids = (rows) => rows.map((r) => r.id)
const asc = (col) => ({ col, dir: 'asc' })
const desc = (col) => ({ col, dir: 'desc' })

describe('a run is ordered by season, then episode, then the clock', () => {
  const rows = [
    { id: 1, season: 2, episode: 1, timestamp: '00:10:00' },
    { id: 2, season: 1, episode: 10, timestamp: '00:05:00' },
    { id: 3, season: 1, episode: 2, timestamp: '00:30:00' },
    { id: 4, season: 1, episode: 2, timestamp: '00:01:00' },
    { id: 5, season: 0, episode: 1, timestamp: '00:00:30' },
  ]

  it('puts episode 10 after episode 2 and not between 1 and 2', () => {
    // The film board's own copy got this right; a string sort would not, which
    // is why the comparable pads.
    expect(ids(sortAnnotations(rows, asc('episode')))).toEqual([5, 4, 3, 2, 1])
  })
})

describe('grouping a board that is not a book', () => {
  it('makes a season and an episode one heading', () => {
    const g = groupAnnotations(
      [
        { id: 1, season: 2, episode: 3 },
        { id: 2, season: 1, episode: 3 },
        { id: 3, season: 1, episode: 3 },
        { id: 4 },
      ],
      'episode',
      SHOW,
    )
    // Season 1 episode 3 and season 2 episode 3 are two runs, not one.
    expect(g.filter((x) => !x.residual).length).toBe(2)
    expect(g[0].items.map((r) => r.id)).toEqual([2, 3])
    expect(g[0].label).toMatch(/1/)
    expect(g[0].label).toMatch(/3/)
    expect(g.at(-1).label).toBe('No episode')
  })
})
