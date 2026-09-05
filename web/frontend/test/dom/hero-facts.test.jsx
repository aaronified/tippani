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

  it('open a search on the series', async () => {
    BOOK = base
    searched.length = 0
    page()
    fireEvent.click(await screen.findByRole('button', { name: /Hainish/ }))
    await waitFor(() => expect(searched.length).toBe(1))
    expect(searched[0][0].field).toBe('series')
  })

  it('open a search on a genre', async () => {
    BOOK = base
    searched.length = 0
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Science Fiction' }))
    await waitFor(() => expect(searched.length).toBe(1))
    expect(searched[0]).toEqual([{ field: 'genre', value: 'Science Fiction', label: 'Science Fiction' }])
  })

  it('leave the language flat, because the server has no facet for it', async () => {
    BOOK = base
    page()
    // Not a defect and not an omission: a language door would be a control that
    // can only fail. Adding the facet is the missing half of it.
    const lang = await waitFor(() => {
      const el = [...document.querySelectorAll('.work-hero-metalink')].find((e) => /Russian/i.test(e.textContent))
      expect(el, 'no language fact drawn').toBeTruthy()
      return el
    })
    expect(lang.tagName).toBe('SPAN')
    expect(lang.className).toContain('work-hero-metalink-flat')
  })

  it('draw nothing pressable for a fact the book does not have', async () => {
    BOOK = { ...base, series: '', published_year: null, genres: [] }
    page()
    await screen.findByText('The Dispossessed')
    // A door to "everything from no year" is a control that can only fail.
    expect(screen.queryByRole('button', { name: '1974' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Hainish/ })).toBeNull()
  })
})

describe('the strip welded to the cover', () => {
  const strip = () => document.querySelector('.work-hero-shelfbar-wrap [role=img]')

  it('takes the shelf’s own colour, not the accent', async () => {
    BOOK = base
    page()
    const bar = await waitFor(() => {
      const el = strip()
      expect(el, 'no shelf strip').toBeTruthy()
      return el
    })
    // "An accent-coloured bar says 'this is Tippani', which the reader already
    // knows, instead of 'you are reading this'."
    expect(bar.style.background).not.toContain('--accent')
    expect(bar.getAttribute('aria-label')).toMatch(/62/)
  })

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

  it('is drawn on the wishlist too, where the old bar vanished', async () => {
    BOOK = { ...base, status: 'wishlist', progress: 0 }
    page()
    await waitFor(() => expect(strip()).toBeTruthy())
  })

  it('falls back to the neutral strip when a book is on no shelf at all', async () => {
    BOOK = { ...base, status: '', progress: 40 }
    page()
    await waitFor(() => expect(document.querySelector('.work-hero-shelfbar')).toBeTruthy())
    // There is no state for it to be the colour of, so it is not pretending.
    expect(strip()).toBeNull()
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

describe('a film’s facts, which were flat text until the two screens became one', () => {
  it('open a search on the year', async () => {
    FILM = film
    filmSearched.length = 0
    filmPage()
    fireEvent.click(await screen.findByRole('button', { name: '1979' }))
    await waitFor(() => expect(filmSearched.length).toBe(1))
    // The same one chip, and across the catalogue rather than inside this film.
    expect(filmSearched[0]).toEqual([{ field: 'year', value: '1979', label: '1979' }])
  })

  it('open a search on the series', async () => {
    FILM = film
    filmSearched.length = 0
    filmPage()
    fireEvent.click(await screen.findByRole('button', { name: /Strugatsky/ }))
    await waitFor(() => expect(filmSearched.length).toBe(1))
    expect(filmSearched[0][0].field).toBe('series')
  })

  it('open a search on a genre', async () => {
    FILM = film
    filmSearched.length = 0
    filmPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Science Fiction' }))
    await waitFor(() => expect(filmSearched.length).toBe(1))
    expect(filmSearched[0]).toEqual([{ field: 'genre', value: 'Science Fiction', label: 'Science Fiction' }])
  })

  // Not "flat, like a book's language" — ABSENT. The movies table has no language
  // column at all, so there is no fact to draw rather than a fact with no door,
  // and the kind row is simply shorter. That is the whole mechanism by which one
  // hero serves four kinds without a conditional per fact.
  it('draw no language fact at all, because the catalogue has no such column', async () => {
    FILM = film
    filmPage()
    await screen.findByText('Stalker')
    const facts = [...document.querySelectorAll('.work-hero-metalink')].map((e) => e.textContent)
    expect(facts.some((f) => /1979/.test(f)), 'no year fact drawn — the row is not being read').toBe(true)
    expect(facts.some((f) => /Russian/.test(f)), 'a language fact on a table with no language column').toBe(false)
    expect(facts.some((f) => /orig\./i.test(f))).toBe(false)
  })

  it('name the board it came from with the nav tab’s own word', async () => {
    FILM = film
    filmPage()
    // It read "← Movies" for a release after the board was renamed, because the
    // word was typed into the screen instead of read from the one place that
    // holds it. Now the link and the tab cannot disagree.
    // FOUND BY WHAT IT IS, not by the character it used to start with. It led
    // with a typed `←`; it leads with the app's own back glyph now, and a test
    // keyed to the character would go red on a change no reader can see. What
    // makes this button the back link is that it names a nav tab.
    const back = await waitFor(() => {
      const el = [...document.querySelectorAll('button')]
        .find((b) => b.querySelector('svg') && /Catalogue|Movies/.test(b.textContent))
      expect(el, 'no back link').toBeTruthy()
      return el
    })
    expect(back.textContent).toMatch(/Catalogue/)
    expect(back.textContent).not.toMatch(/Movies/)
  })

  // A person is an object with a border and its own door — never a name in a
  // sentence with a middle dot doing the distinguishing. The film's credit row
  // was the sentence form: underlined names with a comma between them.
  it('draw the credit as a person chip, not as a sentence', async () => {
    FILM = film
    filmPage()
    await screen.findByText('Stalker')
    const chip = [...document.querySelectorAll('.person-chip')].find((c) => /Tarkovsky/.test(c.textContent))
    expect(chip, 'the director is not a chip').toBeTruthy()
  })
})

describe('the two columns, which the catalogue side never had', () => {
  // At 1180px and up a book got a fixed hero column beside a scrolling quote
  // column, each remembering its own place; a film got a page you scrolled past
  // the poster to reach the lines. The stylesheet's rules were kind-agnostic the
  // whole time — this was a screen not asking for what the CSS already offered.
  const asWide = () => {
    window.matchMedia = (media) => ({
      matches: media === '(min-width: 1180px)', media, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })
  }

  it('frames a film exactly as it frames a book', async () => {
    asWide()
    FILM = film
    filmPage()
    await screen.findByText('Stalker')
    expect(document.querySelector('.tp-detail-hero'), 'a film is still one stacked column').toBeTruthy()
    expect(document.querySelector('.tp-detail-stream')).toBeTruthy()
    // And the back link goes: at two columns the crumb and the rail already say
    // where you are, so a third way out earns nothing but a row.
    expect([...document.querySelectorAll('button')].find((b) => /^←/.test(b.textContent.trim()))).toBeFalsy()
  })

  it('still frames a book that way', async () => {
    asWide()
    BOOK = base
    page()
    await screen.findByText('The Dispossessed')
    expect(document.querySelector('.tp-detail-hero')).toBeTruthy()
  })
})
