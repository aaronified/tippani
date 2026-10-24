// works.jsx — the shelf and grouping logic shared by Library and the Catalogue.
//
// groupWorks is the largest pure function in the frontend and it is used by two
// screens (the Library/Catalogue group-by and Search's grouped results), so one
// regression here shows up in two places that look unrelated. Its ordering rules
// are all different from each other on purpose — series and credit
// alphabetical, decade newest first, genre by size — and the residual bucket
// always sinks, which is the part most likely to get lost in a refactor.

import { describe, expect, it } from 'vitest'
import { groupWorks, pinInProgress } from '../../src/works.jsx'

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
})

describe('pinInProgress', () => {
  it('floats the active work to the front, keeping both blocks in order', () => {
    const list = [{ id: 1 }, { id: 2, status: 'reading' }, { id: 3 }, { id: 4, status: 'reading' }]
    expect(pinInProgress(list, 'book').map((x) => x.id)).toEqual([2, 4, 1, 3])
  })
})
