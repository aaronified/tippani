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
//   less of a table, and the coverage tiles become sentences — but the same five
//   sections, reachable, in the same order.
//
// AND ONE THAT IS ABOUT DAMAGE: a section name stored by an older build must not
// be able to render a blank page. localStorage outlives a release.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'

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
    if (method === 'GET' && (path === '/metadata/status' || path === '/admin/metadata-keys')) {
      return { ok: true, data: { tmdb: { source: 'builtin' }, books_lookup: { ok: true } } }
    }
    return { ok: true, data: { people: [], characters: [], groups: [] } }
  }),
}))

const { default: MetadataPage } = await import('../../src/MetadataPage.jsx')
const { useScreenBarState } = await import('../../src/ui.jsx')

// What the page hands the shell's dock, read through a probe rather than a getter
// so the test sees exactly what a subscriber sees.
let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

// A book with two gaps on it, so the overview has something to count.
const book = (id, title, cover = '') => ({
  id, title, author: 'Le Guin', series: '', isbn: '', asin: '',
  has_cover: !!cover, cover_path: cover, low_res_cover: false, has_ids: true, has_author: true,
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
  render(<><MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} /><Probe /></>)
  if (WIDTH <= 768) await screen.findByLabelText(/which metadata/i)
  else await screen.findAllByRole('tab')
}

// ── THE PHONE'S RAIL IS A FIELD. Five tabs on a 390px strip showed two and a
// half; the section a reader is not in was behind a scroll gesture with no
// arrow. So the phone's doors are options, and a test opens them the way a thumb
// does: press the field, then the row.
const openSections = async () => { await press(screen.getByLabelText(/which metadata/i)) }
const phoneDoors = async () => {
  await openSections()
  return screen.getAllByRole('option').map((o) => o.textContent)
}
const phoneDoor = async (name) => {
  await openSections()
  await press(screen.getByRole('option', { name }))
}
const rail = () => screen.getAllByRole('tab').map((b) => b.textContent)
const tab = (name) => screen.getByRole('tab', { name })

describe('the rail', () => {
  it('names every section, in the order of the question', async () => {
    await mount()
    // The words, not the counts: the order is the claim.
    expect(rail().map((s) => s.replace(/\d+$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters', 'Sources'])
  })

  it('leaves the sources door with no number, because it counts no records', async () => {
    // Every other door counts records or gaps. This one is a set of settings, and
    // "5 keys" answers a question nobody has — a number there would read as five
    // of something to work through.
    await mount()
    expect(tab(/^Sources/).querySelector('.meta-rail-count')).toBeNull()
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

  it('shows each work’s own cover, and marks the gap where there is none', async () => {
    // The list whose subject is the picture showed no pictures: two of its filters
    // are `no_cover` and `low_res`, and a reader checking a low-res flag had to
    // open every row to see the thing being flagged. The empty slot keeps its
    // space and says what it is, because here the absence IS the finding.
    // The console opens on the works that still need something, so both rows here
    // are missing their source — which is what keeps the one that HAS a cover in
    // the list at all, and is the case worth drawing: a row flagged for a reason
    // that is not its picture.
    LIB = {
      books: [
        { ...book(1, 'A Wizard of Earthsea', 'covers/earthsea.jpg'), has_ids: false },
        { ...book(2, 'The Dispossessed'), has_ids: false },
      ],
      movies: [],
    }
    await mount()
    await press(tab(/^Works/))
    const withArt = (await screen.findByText('A Wizard of Earthsea')).closest('div.flex')
    expect(withArt.querySelector('img.meta-row-art')).toBeTruthy()
    const without = screen.getByText('The Dispossessed').closest('div.flex')
    expect(without.querySelector('img.meta-row-art')).toBeNull()
    expect(within(without).getByLabelText(/No cover stored/)).toBeTruthy()
  })

  it('puts the API keys behind the sources door, which used to be a settings card', async () => {
    // The block moved whole: a reader looking at a work filtered by "no source"
    // had to leave the console, find a settings card, and come back to press
    // Fetch. It is the last door because it is a setting rather than a thing to
    // work on.
    await mount()
    expect(screen.queryByText('Metadata sources')).toBeNull()
    await press(tab(/^Sources/))
    expect(await screen.findByText('Metadata sources')).toBeTruthy()
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
    localStorage.setItem('tippani:metasection', JSON.stringify('quizzes'))
    await mount()
    expect(tab(/^Overview/).getAttribute('aria-selected')).toBe('true')
  })
})

describe('on a phone', () => {
  beforeEach(() => { WIDTH = 390 })

  it('gets the same five doors', async () => {
    await mount()
    // A field, not a strip: five tabs at 390px show two and a half of themselves.
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    const doors = await phoneDoors()
    expect(doors.map((s) => s.replace(/\s*·.*$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters', 'Sources'])
  })

  it('carries each door\u2019s number into the field, because that is why it is a rail', async () => {
    await mount()
    const doors = await phoneDoors()
    // The counts do not survive being turned into a dropdown — they are the
    // reason the rail is a rail and not a tab strip.
    expect(doors.find((d) => d.startsWith('Works'))).toMatch(/·\s*2/)
    expect(doors.find((d) => d.startsWith('Characters'))).toMatch(/·\s*2/)
    // Sources counts settings, not records, so it still carries none.
    expect(doors.find((d) => d.startsWith('Sources'))).toBe('Sources')
  })

  it('can reach the character list, which used to be desktop-only', async () => {
    await mount()
    await phoneDoor(/^Characters/)
    expect(await screen.findByText('Woland')).toBeTruthy()
  })

  // ── EVERYTHING THAT NEEDS WORK, from the dock.
  //
  // The desktop answers this with a wall of tiles, each a filter button into the
  // console beside it. The phone had the same numbers as sentences and nothing to
  // press — reading "1 with no series" and having no way to reach that one.
  describe('the issues sheet', () => {
    const dockKey = (id) => {
      const k = (BAR.keys || []).find((x) => x.id === id)
      expect(k, id).toBeTruthy()
      return k
    }

    it('publishes the two halves of this page\u2019s job to the dock', async () => {
      await mount()
      expect((BAR.keys || []).map((k) => k.id)).toEqual(['issues', 'fetch'])
    })

    it('offers no fetch to a reader who cannot run one', async () => {
      render(<><MetadataPage user={{ username: 'bob', is_admin: false }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} /><Probe /></>)
      await screen.findByLabelText(/which metadata/i)
      // Reading what is incomplete is a question anybody may ask; going out to
      // five providers and writing the answers back is not.
      //
      // AND THE SEAT FETCH LEAVES IS NOT A BLANK. A screen that publishes SOME
      // keys opts out of the shell's default pair wholesale, so this reader had
      // one verb and one empty seat beside it — the exact hole the default was
      // introduced to close. `nav` is the placeholder the shell swaps for its
      // boards key; what matters to this case is that fetch is not here.
      expect((BAR.keys || []).map((k) => k.id)).toEqual(['issues', 'nav'])
    })

    it('lists only what is actually wrong, and every row is a door', async () => {
      await mount()
      await act(async () => dockKey('issues').onClick())
      const rows = [...document.querySelectorAll('.meta-issue-row')].map((el) => el.textContent)
      // The fixture's two books have no cover and no series; everything else
      // about them is complete. Fourteen gap tokens exist and eleven of them are
      // zero — a sheet of zeroes is a sheet that teaches a reader to stop
      // reading it.
      expect(rows.filter((r) => /cover/i.test(r))).toHaveLength(1)
      expect(rows.filter((r) => /series/i.test(r))).toHaveLength(1)
      expect(rows.some((r) => /year|genre|author/i.test(r))).toBe(false)

      // AND IT IS A SUPERSET OF THE DESKTOP TILES. The three people in the
      // fixture have neither a portrait nor a link, which the coverage strip has
      // never counted — it only ever looked at the catalogue.
      expect(rows.some((r) => /portrait or link/i.test(r))).toBe(true)

      await press([...document.querySelectorAll('.meta-issue-row')].find((el) => /series/i.test(el.textContent)))
      // It lands on the works console, filtered to the gap it named.
      expect(screen.getByLabelText(/which metadata/i).textContent).toMatch(/^Works/)
    })
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
