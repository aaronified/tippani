// THE FACTS BESIDE THE KIND ARE DOORS, and not one of them was.
//
// The pack's rule: "year and language are stored, shared and searchable, so each
// is a way into a filtered search rather than a caption." HeroFact has rendered a
// button when handed an onClick and a flat span when not, since it was written —
// and the book page handed it none, so every fact fell through to the span. The
// comment that stood over that call site claimed the language was a link
// "because there is a board behind it", which was the opposite of the truth.
//
// AND THE SHELF STRIP UNDER THE COVER was accent-coloured and gated on progress,
// so a paused book and a reading one looked identical and a completed book had no
// bar at all.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let BOOK
let FILM
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/books/1') return { ok: true, data: BOOK }
    if (path === '/movies/7') return { ok: true, data: FILM }
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [], dialogues: [], books: [], movies: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
const { default: Movies } = await import('../../src/Movies.jsx')
const { takeSearchSeed } = await import('../../src/facets.js')

const searched = []
const page = () =>
  render(
    <Library
      openId={1}
      onOpen={() => {}}
      onClose={() => {}}
      creditSeparators=",;&"
      onAdd={() => {}}
      onSearch={() => searched.push(takeSearchSeed())}
      dataNonce={0}
    />,
  )

const base = {
  id: 1,
  title: 'The Dispossessed',
  author: 'Ursula K. Le Guin',
  published_year: 1974,
  language: 'Russian',
  series: 'Hainish',
  genres: ['Science Fiction'],
  status: 'reading',
  progress: 62,
}

describe('a book’s facts', () => {
  it('open a search on the year, across the library and not inside this book', async () => {
    BOOK = base
    searched.length = 0
    page()
    const year = await screen.findByRole('button', { name: '1974' })
    fireEvent.click(year)
    await waitFor(() => expect(searched.length).toBe(1))
    // ONE CHIP. A year door that also carried `book:this` would search one book
    // for the year it was published in — a question with one answer.
    expect(searched[0]).toEqual([{ field: 'year', value: '1974', label: '1974' }])
  })

})

describe('the strip welded to the cover', () => {
  const strip = () => document.querySelector('.work-hero-shelfbar-wrap [role=img]')

  it('is drawn for a completed book, which has no percentage to report', async () => {
    BOOK = { ...base, status: 'completed', progress: 0 }
    page()
    const bar = await waitFor(() => {
      const el = strip()
      expect(el, 'a completed book has no strip').toBeTruthy()
      return el
    })
    // Solid, because every settled state is: there is no partial "completed".
    expect(bar.firstChild.style.width).toBe('100%')
  })

})

// ── AND NOW THE SAME SCREEN, FROM THE OTHER SIDE.
//
// Every case above was a book's, because until the two work pages became one
// WorkDetail there was nothing on the catalogue side to assert: MovieDetail took
// an `onSearch` prop and never called it, its kind row passed no onClick and its
// hero got no onGenre. So a film's year, series and genre rendered through the
// same HeroFact as a book's, looked exactly as pressable, and were not.
//
// These are therefore not "the film's copy of the book's tests" — they are the
// proof that the merge actually reached the film, which is the one claim a
// refactor of this shape can make falsely and still look finished. The book
// cases above are the other half: they must pass UNCHANGED, because the book is
// the screen the merged component was lifted out of.

const filmSearched = []
const filmPage = () =>
  render(
    <Movies
      openId={7}
      onOpen={() => {}}
      onClose={() => {}}
      creditSeparators=",;&"
      onAdd={() => {}}
      onSearch={() => filmSearched.push(takeSearchSeed())}
      dataNonce={0}
    />,
  )

const film = {
  id: 7,
  title: 'Stalker',
  director: 'Andrei Tarkovsky',
  release_year: 1979,
  series: 'Strugatsky',
  genres: ['Science Fiction'],
  media_type: 'movie',
  status: 'watching',
  progress: 40,
  // NOT A REAL COLUMN. The catalogue table has no language, and this is here so
  // the case below cannot pass by there being nothing to draw: if `language`
  // ever joins the catalogue row's facts, a fact appears and the test says so.
  language: 'Russian',
  orig_language: 'Russian',
}

