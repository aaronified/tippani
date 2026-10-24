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
import { groupAnnotations, sortAnnotations } from '../../src/Library.jsx'

const rows = [
  { id: 1, quote: 'aaaa', chapter: 'Ten', chapter_no: 10, location: 'p.300', color: 'blue', tags: ['craft'], created_at: '2024-03-01 10:00:00' },
  { id: 2, quote: 'aa', chapter: 'Two', chapter_no: 2, location: 'p.40', color: 'yellow', tags: ['craft', 'truth'], created_at: '2024-01-01 10:00:00' },
  { id: 3, quote: 'aaaaaa', chapter: 'Preface', color: 'pink', tags: [], created_at: '2024-02-01 10:00:00' },
  { id: 4, quote: 'a', color: 'yellow', tags: [], created_at: '2024-01-01 18:00:00' },
]
const ids = (list) => list.map((a) => a.id)

describe('ordering a board', () => {
  // NUMBERED CHAPTERS FIRST, IN ORDER. Text put chapter 10 between 1 and 2, which
  // is the whole reason chapter_no is a separate column.
  it('reads chapters in reading order, with the named ones after the numbered', () => {
    // Two, then Ten (a text sort puts Ten between One and Two), then the named
    // Preface, then the quote with no chapter at all.
    expect(ids(sortAnnotations(rows, { col: 'chapter', dir: 'asc' }))).toEqual([2, 1, 3, 4])
  })
})

describe('grouping a board', () => {
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
})
