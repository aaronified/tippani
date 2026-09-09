// THE DECADE SECTION DREW BOOKS AND FILMS AND NOTHING ELSE.
//
// The server-side gap is pinned in search_decade_test.go: searchDecadeFacet took
// two booleans, so the one kind of row carrying a date of its own — a standalone
// quote, dated by `occasion_date` — was the one kind it never queried. This is the
// other half. The section that renders the answer had the SAME shape of defect
// independently: it summed two arrays for its count and rendered two arrays in its
// body, so a payload carrying quotes would have arrived and drawn nothing, under a
// heading that under-counted the page it sat on.
//
// TWO IMPLEMENTATIONS OF ONE THING IS THE ROOT CAUSE. The date facet's section
// already handled all five kinds, correctly, thirty lines away. The repo's rule is
// that a control on two screens lives in one function — so the decade section is
// now the date section, and these cases run the SAME component both ways round.
//
// WHAT A TEST WRITER NEEDS TO KNOW: a structured facet payload may carry books,
// movies, annotations, dialogues and quotes. The first four bucket under a parent
// work; a standalone quote has no parent and renders as its own row.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FacetSection, facetCount } from '../../src/SearchPage.jsx'

const QUOTE = {
  id: 7,
  quote: 'The unexamined life is not worth living.',
  note: '',
  color: 'yellow',
  speaker: 'Socrates',
  occasion: 'his trial',
  occasion_date: '-0399',
  place: 'Athens',
  medium: '',
  kind: '',
  category: 'other',
  language: '',
  translation: '',
  tags: [],
}

const empty = { books: [], movies: [], annotations: [], dialogues: [], quotes: [] }

const mount = (over = {}) =>
  render(
    <FacetSection
      d={{ ...empty, ...over }}
      heading={(n) => `heading ${n}`}
      view="tiles"
      terms={[]}
      renderBook={(b) => <div key={`b${b.id}`}>book {b.title}</div>}
      renderMovie={(m) => <div key={`m${m.id}`}>film {m.title}</div>}
      onOpenQuote={() => {}}
      speakerMap={{}}
      creditSeps={[]}
    />,
  )

describe('a decade that holds a standalone quote', () => {
  it('draws it, which the decade section could not', () => {
    mount({ quotes: [QUOTE] })
    expect(screen.getByText(/unexamined life/)).toBeTruthy()
  })

  it('counts it in the heading', () => {
    mount({ quotes: [QUOTE] })
    // "2 works" over a page holding three things is the failure this replaces:
    // the old heading summed books and movies only.
    expect(screen.getByText('heading 1')).toBeTruthy()
  })

  it('still draws the works beside it', () => {
    mount({
      books: [{ id: 1, title: 'Meditations', author: '', cover_path: '', genres: [], published_year: 180, series: '', series_index: 0, review_excluded: false }],
      quotes: [QUOTE],
    })
    expect(screen.getByText('book Meditations')).toBeTruthy()
    expect(screen.getByText(/unexamined life/)).toBeTruthy()
    expect(screen.getByText('heading 2')).toBeTruthy()
  })
})

// The count is its own function because the heading is the thing that goes stale:
// a facet learns a kind, the body renders it, and the number above it does not.
describe('the count', () => {
  it('reaches every kind a structured facet can carry', () => {
    const one = (k) => facetCount({ ...empty, [k]: [{ id: 1 }] })
    for (const k of ['books', 'movies', 'annotations', 'dialogues', 'quotes']) {
      expect(one(k), k).toBe(1)
    }
    expect(facetCount(empty)).toBe(0)
    // A payload from an older server, missing keys entirely, must not throw.
    expect(facetCount({})).toBe(0)
  })
})
