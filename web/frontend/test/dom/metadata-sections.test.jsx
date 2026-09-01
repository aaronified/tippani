// The metadata screen's sections, and the rail that names them.
//
// WHAT THIS SCREEN WAS: one scroll holding six consoles — a stats strip, the
// catalogue, duplicates, people, characters, a speaker remap — stacked in the
// order they happened to be written. Reaching the character list meant scrolling
// past four other consoles; nothing on screen said how many characters there
// were; and the phone answered the whole problem by rendering a different screen
// with three buttons on it and no browsable record at all.
//
// So there are three separate claims here and none of them is about layout:
//
//   ONE SECTION AT A TIME. A rail row is a door, not an anchor link. If two
//   sections render at once the rail is decoration and the scroll is back.
//
//   THE RAIL CARRIES THE NUMBER. That is the whole reason it is a rail and not a
//   tab strip: "People" makes a reader open it to find out whether it is worth
//   opening, and "People 9" does not. A count that is not loaded yet prints
//   nothing rather than a zero, because a 0 that becomes 41 a moment later is the
//   more misleading of the two.
//
//   THE PHONE GETS THE SAME DOORS. Not the same contents — a 390px column holds
//   less of a table, and the coverage tiles become sentences — but the same four
//   sections, reachable, in the same order.
//
// AND ONE THAT IS ABOUT DAMAGE: a section name stored by an older build must not
// be able to render a blank page. localStorage outlives a release.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

let LIB
let WIDTH = 1280

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === '/metadata/library') return { ok: true, data: LIB }
    if (method === 'GET' && path === '/characters') {
      return { ok: true, data: { characters: [{ id: 1, name: 'Woland', works: 2, sort_name: '' }, { id: 2, name: 'Ged', works: 0, sort_name: '' }] } }
    }
    if (method === 'GET' && path === '/people/records') {
      return { ok: true, data: { people: [{ id: 1, name: 'Le Guin' }, { id: 2, name: 'Bulgakov' }, { id: 3, name: 'Ray' }] } }
    }
    return { ok: true, data: { people: [], characters: [], groups: [] } }
  }),
}))

const { default: MetadataPage } = await import('../../src/MetadataPage.jsx')

// A book with two gaps on it, so the overview has something to count.
const book = (id, title) => ({
  id, title, author: 'Le Guin', series: '', isbn: '', asin: '',
  has_cover: false, low_res_cover: false, has_ids: true, has_author: true,
  has_series: false, has_year: true, has_genre: true, has_source: true, links: '',
})

beforeEach(() => {
  WIDTH = 1280
  localStorage.clear()
  LIB = { books: [book(1, 'A Wizard of Earthsea'), book(2, 'The Dispossessed')], movies: [] }
  // useIsMobileScreen reads matchMedia; jsdom's returns false for everything, so
  // the width is stated here rather than assumed.
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q) && WIDTH <= 768,
    media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  })
})
afterEach(() => cleanup())

const press = async (el) => { await act(async () => el.click()) }
const mount = async () => {
  render(<MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} />)
  await screen.findAllByRole('tab')
}
const rail = () => screen.getAllByRole('tab').map((b) => b.textContent)
const tab = (name) => screen.getByRole('tab', { name })

describe('the rail', () => {
  it('names every section, in the order of the question', async () => {
    await mount()
    // The words, not the counts: the order is the claim.
    expect(rail().map((s) => s.replace(/\d+$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters'])
  })

  it('carries each section’s own number', async () => {
    await mount()
    // Works is 2 books + 0 films; characters and people come from their own
    // reads, which is why they are here at all — the rail cannot print a number
    // the page has not got.
    expect(tab(/^Works/).textContent).toContain('2')
    expect(tab(/^Characters/).textContent).toContain('2')
    expect(tab(/^People/).textContent).toContain('3')
  })

  it('counts PROBLEMS on the overview, not records, and marks them', async () => {
    await mount()
    // Two books, each missing a cover and a series: four gaps. Not "2", which is
    // how many works there are — the overview row answers "how much is wrong".
    const el = tab(/^Overview/)
    expect(el.textContent).toContain('4')
    expect(el.querySelector('.meta-rail-count').className).toContain('is-warn')
  })

  it('says nothing where a count has not arrived', async () => {
    // A zero here would be a lie for as long as the fetch takes, and the lie is
    // the readable kind: "you have no characters" rather than "still loading".
    render(<MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} />)
    const el = screen.getAllByRole('tab').find((b) => /^Characters/.test(b.textContent))
    expect(el.querySelector('.meta-rail-count')).toBeNull()
  })
})

describe('a section at a time', () => {
  it('opens on the overview, with the catalogue not rendered at all', async () => {
    await mount()
    expect(tab(/^Overview/).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText(/A Wizard of Earthsea/)).toBeNull()
  })

  it('shows the works section only once its door is used', async () => {
    await mount()
    await press(tab(/^Works/))
    expect(await screen.findByText(/A Wizard of Earthsea/)).toBeTruthy()
    // And the overview is gone rather than merely scrolled past.
    expect(screen.queryByText(/all complete/i)).toBeNull()
  })

  it('puts the character list behind the character door and nowhere else', async () => {
    await mount()
    expect(screen.queryByText('Woland')).toBeNull()
    await press(tab(/^Characters/))
    expect(await screen.findByText('Woland')).toBeTruthy()
  })

  it('remembers which section, because it is a fact about this desk', async () => {
    await mount()
    await press(tab(/^Characters/))
    cleanup()
    await mount()
    expect(tab(/^Characters/).getAttribute('aria-selected')).toBe('true')
  })

  it('falls back rather than rendering nothing for a section that no longer exists', async () => {
    // The exact shape of the hazard: a build whose section list was different
    // wrote this key, and the reader upgrades. An unguarded switch renders a rail
    // with no row lit and a body with nothing in it.
    localStorage.setItem('tippani:metasection', JSON.stringify('sources'))
    await mount()
    expect(tab(/^Overview/).getAttribute('aria-selected')).toBe('true')
  })
})

describe('on a phone', () => {
  beforeEach(() => { WIDTH = 390 })

  it('gets the same four doors', async () => {
    await mount()
    expect(rail().map((s) => s.replace(/\d+$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters'])
  })

  it('can reach the character list, which used to be desktop-only', async () => {
    await mount()
    await press(tab(/^Characters/))
    expect(await screen.findByText('Woland')).toBeTruthy()
  })

  it('reads the coverage as sentences rather than as filter tiles', async () => {
    // A tile is a button that filters the catalogue beside it; there is no room
    // for the catalogue here, so a tile would be a button that appears to do
    // nothing. The numbers are the same numbers either way.
    await mount()
    expect(screen.getByText(/coverage/i)).toBeTruthy()
    expect(document.querySelector('.hand-card')).toBeTruthy() // the sweep cards
  })
})
