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

  it('treats season 0 as a real season, ahead of season 1', () => {
    // Specials are season 0. Sinking them to the end would be treating a real
    // value as absent.
    expect(ids(sortAnnotations(rows, asc('episode')))[0]).toBe(5)
  })

  it('breaks a tie on the episode with the clock', () => {
    const [, second, third] = sortAnnotations(rows, asc('episode'))
    expect([second.id, third.id]).toEqual([4, 3])
  })

  it('sinks a line with no episode at BOTH ends of the arrow', () => {
    const withGap = [...rows, { id: 9, timestamp: '00:02:00' }]
    expect(ids(sortAnnotations(withGap, asc('episode'))).pop()).toBe(9)
    expect(ids(sortAnnotations(withGap, desc('episode'))).pop()).toBe(9)
  })

  it('sinks a half-located line within its season rather than off the board', () => {
    // A season with no episode is located — just not fully. The film board's
    // copy used Infinity for the missing half, which is this behaviour, and the
    // fold had to keep it.
    const half = [{ id: 7, season: 1 }, { id: 8, season: 1, episode: 3 }, { id: 6, season: 2, episode: 1 }]
    expect(ids(sortAnnotations(half, asc('episode')))).toEqual([8, 7, 6])
  })
})

describe('the other dimensions a line carries', () => {
  const lines = [
    { id: 1, character: 'HAL', timestamp: '00:30:00', act: 'Two', quest: 'The Ashes' },
    { id: 2, character: 'Dave', timestamp: '00:10:00', act: 'One', quest: 'A Bell' },
    { id: 3, quote: 'unattributed' },
  ]

  it.each(['character', 'timestamp', 'act', 'quest'])('orders by %s and sinks the row without one', (col) => {
    expect(ids(sortAnnotations(lines, asc(col)))).toEqual([2, 1, 3])
    // Missing sinks rather than floats, in both directions.
    expect(ids(sortAnnotations(lines, desc(col))).pop()).toBe(3)
  })

  it('answers the four dimensions the film board used to send to alphabetical', () => {
    // default | date | length | category are all declared in the kind table and
    // none of them existed in the film's own comparator.
    const rows = [
      { id: 1, quote: 'aaa', color: 'blue', created_at: '2024-03-01' },
      { id: 2, quote: 'bb', color: 'yellow', created_at: '2024-01-01' },
    ]
    expect(ids(sortAnnotations(rows, asc('default')))).toEqual([1, 2])
    expect(ids(sortAnnotations(rows, desc('default')))).toEqual([2, 1])
    expect(ids(sortAnnotations(rows, asc('date')))).toEqual([2, 1])
    expect(ids(sortAnnotations(rows, asc('length')))).toEqual([2, 1])
    // The colour WHEEL's order: yellow is slot 1, blue slot 2.
    expect(ids(sortAnnotations(rows, asc('category')))).toEqual([2, 1])
  })
})

describe('grouping a board that is not a book', () => {
  it('refuses a dimension the kind never declared', () => {
    // A show has no chapters. The guard is what stops a film board grouping by
    // one because the constant it used to read was the book's.
    expect(groupAnnotations([{ id: 1, chapter: 'Ten' }], 'chapter', SHOW)).toBeNull()
    expect(groupAnnotations([{ id: 1, quest: 'The Ashes' }], 'quest', SHOW)).toBeNull()
    expect(groupAnnotations([{ id: 1, quest: 'The Ashes' }], 'quest', GAME)).not.toBeNull()
  })

  it('buckets by character, folding two spellings into one', () => {
    const g = groupAnnotations(
      [{ id: 1, character: 'HAL' }, { id: 2, character: 'hal' }, { id: 3, character: 'Dave' }, { id: 4 }],
      'character',
      SHOW,
    )
    expect(g.map((x) => x.label)).toEqual(['Dave', 'HAL', 'No character'])
    // The heading reads the way the reader wrote it, not the way it was folded.
    expect(g[1].items.map((r) => r.id)).toEqual([1, 2])
    // The row with none is the residual and sinks to the end.
    expect(g.at(-1).residual).toBe(true)
  })

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

  it('names an episode with no season by its number alone', () => {
    const g = groupAnnotations([{ id: 1, episode: 4 }], 'episode', SHOW)
    expect(g[0].label).toBe('Episode 4')
  })

  it('buckets a game by act and by quest', () => {
    const rows = [{ id: 1, act: 'Two', quest: 'The Ashes' }, { id: 2, act: 'One' }, { id: 3 }]
    expect(groupAnnotations(rows, 'act', GAME).map((x) => x.label)).toEqual(['One', 'Two', 'No act'])
    expect(groupAnnotations(rows, 'quest', GAME).map((x) => x.label)).toEqual(['The Ashes', 'No quest'])
  })
})
