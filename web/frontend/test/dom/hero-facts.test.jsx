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
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/books/1') return { ok: true, data: BOOK }
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    return { ok: true, data: { tags: [], stickers: [], people: [], items: [], annotations: [] } }
  }),
}))

const { default: Library } = await import('../../src/Library.jsx')
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
