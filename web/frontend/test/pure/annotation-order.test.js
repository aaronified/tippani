// Ordering and grouping a book's board of quotes.
//
// THE STATE THIS REPLACES. There was no grouping at all, and the sort was the
// TABLE's alone — clickable column headers on the one view a reader does not
// read in. Three hundred highlights sat in whatever order they were saved, in
// both card views, with nothing on screen offering another.
//
// These are pure because the defect is entirely in two functions: what a
// dimension is ordered BY, and where a quote with no value for it goes. A render
// test would need the whole board to prove less.
import { describe, expect, it } from 'vitest'
import { GROUP_DIMS, SORT_DIMS, groupAnnotations, sortAnnotations } from '../../src/Library.jsx'

const rows = [
  { id: 1, quote: 'aaaa', chapter: 'Ten', chapter_no: 10, location: 'p.300', color: 'blue', tags: ['craft'], created_at: '2024-03-01 10:00:00' },
  { id: 2, quote: 'aa', chapter: 'Two', chapter_no: 2, location: 'p.40', color: 'yellow', tags: ['craft', 'truth'], created_at: '2024-01-01 10:00:00' },
  { id: 3, quote: 'aaaaaa', chapter: 'Preface', color: 'pink', tags: [], created_at: '2024-02-01 10:00:00' },
  { id: 4, quote: 'a', color: 'yellow', tags: [], created_at: '2024-01-01 18:00:00' },
]
const ids = (list) => list.map((a) => a.id)

describe('ordering a board', () => {
  it('leaves the server order alone by default, and reverses it on the other arrow', () => {
    expect(ids(sortAnnotations(rows, { col: 'default', dir: 'asc' }))).toEqual([1, 2, 3, 4])
    expect(ids(sortAnnotations(rows, { col: 'default', dir: 'desc' }))).toEqual([4, 3, 2, 1])
  })

  // NUMBERED CHAPTERS FIRST, IN ORDER. Text put chapter 10 between 1 and 2, which
  // is the whole reason chapter_no is a separate column.
  it('reads chapters in reading order, with the named ones after the numbered', () => {
    // Two, then Ten (a text sort puts Ten between One and Two), then the named
    // Preface, then the quote with no chapter at all.
    expect(ids(sortAnnotations(rows, { col: 'chapter', dir: 'asc' }))).toEqual([2, 1, 3, 4])
  })

  // MISSING SINKS IN BOTH DIRECTIONS, which is why it is a partition and not a
  // sentinel: a sentinel puts every unchaptered quote on top of the other end the
  // moment you flip the arrow, which is the same complaint in a mirror.
  it('sinks the quotes with nothing to order by, whichever way the arrow points', () => {
    expect(ids(sortAnnotations(rows, { col: 'chapter', dir: 'asc' })).pop()).toBe(4)
    expect(ids(sortAnnotations(rows, { col: 'chapter', dir: 'desc' })).pop()).toBe(4)
    // And a locator, which is the other dimension a quote can simply not have.
    expect(ids(sortAnnotations(rows, { col: 'location', dir: 'asc' })).slice(-2)).toEqual([3, 4])
    expect(ids(sortAnnotations(rows, { col: 'location', dir: 'desc' })).slice(-2)).toEqual([3, 4])
  })

  it('sorts a location on its number, not on its text', () => {
    // p.40 before p.300, which a text sort reverses.
    const got = ids(sortAnnotations(rows, { col: 'location', dir: 'asc' }))
    expect(got.indexOf(2)).toBeLessThan(got.indexOf(1))
  })

  // LENGTH IS OF THE WORDS. A note is not part of how long a quote is.
  it('measures length by the quote and not by the row', () => {
    const noted = [{ id: 9, quote: 'a', note: 'x'.repeat(500) }, { id: 8, quote: 'aaa', note: '' }]
    expect(ids(sortAnnotations(noted, { col: 'length', dir: 'asc' }))).toEqual([9, 8])
  })

  // THE COLOUR WHEEL'S ORDER, not the word's: the swatches are drawn in that
  // order everywhere else, and a category list running blue-orange-pink-yellow
  // would be a second answer to "which order are the colours in".
  it('orders categories by the wheel rather than alphabetically', () => {
    const got = ids(sortAnnotations(rows, { col: 'category', dir: 'asc' }))
    // yellow (0) then blue (1) then pink (2).
    expect(got).toEqual([2, 4, 1, 3])
  })

  it('breaks every tie on the id, so a board is stable', () => {
    const same = [{ id: 5, quote: 'aa' }, { id: 3, quote: 'aa' }, { id: 4, quote: 'aa' }]
    expect(ids(sortAnnotations(same, { col: 'length', dir: 'asc' }))).toEqual([3, 4, 5])
    expect(ids(sortAnnotations(same, { col: 'length', dir: 'desc' }))).toEqual([3, 4, 5])
  })

  it('never mutates what it was given', () => {
    const before = ids(rows)
    sortAnnotations(rows, { col: 'length', dir: 'desc' })
    expect(ids(rows)).toEqual(before)
  })
})

describe('grouping a board', () => {
  it('answers null when grouping is off, so a caller has one branch', () => {
    expect(groupAnnotations(rows, 'none')).toBeNull()
    expect(groupAnnotations(rows, 'nonsense')).toBeNull()
  })

  it('buckets chapters in reading order, with the unchaptered last', () => {
    const g = groupAnnotations(rows, 'chapter')
    expect(g.map((x) => x.label)).toEqual(['Two', 'Ten', 'Preface', 'No chapter'])
    expect(g[g.length - 1].residual).toBe(true)
    expect(ids(g[0].items)).toEqual([2])
  })

  it('buckets categories in the wheel order and names them', () => {
    const g = groupAnnotations(rows, 'color')
    // Named by the reader's own category names, not by the colour word.
    expect(g).toHaveLength(3)
    expect(ids(g[0].items)).toEqual([2, 4])
    expect(g.some((x) => x.residual)).toBe(false)
  })

  // A QUOTE WITH SEVERAL TAGS APPEARS UNDER EACH, exactly as a book with several
  // genres does — and the biggest bucket leads, because tags have no order of
  // their own.
  it('puts a multi-tagged quote in every one of its buckets', () => {
    const g = groupAnnotations(rows, 'tag')
    const craft = g.find((x) => x.label === 'craft')
    const truth = g.find((x) => x.label === 'truth')
    expect(ids(craft.items)).toEqual([1, 2])
    expect(ids(truth.items)).toEqual([2])
    // The residual sinks whatever its size — here it holds two of the four.
    expect(g[g.length - 1].residual).toBe(true)
    expect(g[g.length - 1].items).toHaveLength(2)
  })

  // BY DAY, NOT BY INSTANT. Grouping on the timestamp would make every group hold
  // one quote, which is a list with headings.
  it('buckets dates by day, newest first', () => {
    const g = groupAnnotations(rows, 'date')
    expect(g).toHaveLength(3)
    expect(ids(g[0].items)).toEqual([1])
    // The two saved on the same day are one group, in board order.
    expect(ids(g[2].items)).toEqual([2, 4])
  })

  it('offers exactly the dimensions the control does', () => {
    expect(GROUP_DIMS).toEqual(['none', 'chapter', 'color', 'tag', 'date'])
    expect(SORT_DIMS).toEqual(['default', 'date', 'chapter', 'location', 'length', 'category'])
  })
})
