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
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

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
  if (WIDTH <= 768) await screen.findByRole('navigation', { name: /which metadata/i })
  else await screen.findAllByRole('tab')
}

// ── THE PHONE'S RAIL IS AN INDEX. Five tabs on a 390px strip showed two and a
// half; the section a reader is not in was behind a scroll gesture with no arrow.
// It was a FIELD for a while, and the owner rejected that — a dropdown hides every
// section behind a press and shows one word, where the pack draws a list of
// shortcuts that IS the navigation. So the phone's doors are rows on the screen,
// and a test opens one the way a thumb does: press it.
// The index is a navigation landmark and its rows are buttons — both of which
// they have to be: an explicit list role would replace the implicit button one
// and stop a row being announced as pressable at all.
const index = () => screen.getByRole('navigation', { name: /which metadata/i })
const phoneDoors = async () =>
  within(index()).getAllByRole('button').map((o) => o.textContent)
const phoneDoor = async (name) => {
  const rows = within(index()).getAllByRole('button')
  await press(rows.filter((r) => new RegExp(name).test((r.textContent || '').trim())).at(-1))
}
// Back out of a section to the index, the way the drill-down's own arrow does.
const phoneBack = async () => { await press(screen.getByLabelText(/back to/i)) }
const rail = () => screen.getAllByRole('tab').map((b) => b.textContent)
const tab = (name) => screen.getByRole('tab', { name })

describe('the rail', () => {
  it('names every section, in the order of the question', async () => {
    await mount()
    // The words, not the counts: the order is the claim. TAGS JOINED THEM, between
    // Characters and Sources — it was a tab of its own and is a section here now, and
    // it sits with the other lists of what is written across the library rather than
    // beside the keys, which are settings.
    // LANGUAGES JOINED THEM, between Tags and Sources. The v3 pack draws no such
    // section and its own Settings prototype depends on one — it says the quote
    // faces are read from "the metadata language table, which is the only place a
    // quote's language is defined". The table existed; it was a pop-up behind a
    // button inside Sources, which is not somewhere another screen can point.
    expect(rail().map((s) => s.replace(/\d+$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters', 'Tags', 'Languages', 'Colours', 'Sources'])
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
    //
    // WAITED FOR RATHER THAN READ ONCE, because mount() resolves when the tabs
    // EXIST and the counts arrive from three later fetches — the same race the
    // sibling test one block down asserts the other side of. Read as a snapshot
    // this passes on whichever fetch happened to land first.
    await waitFor(() => {
      expect(tab(/^Works/).textContent).toContain('2')
      expect(tab(/^Characters/).textContent).toContain('2')
      expect(tab(/^People/).textContent).toContain('3')
    })
  })

  it('counts PROBLEMS on the overview, not records, and marks them', async () => {
    await mount()
    // Two books, each missing a cover and a series: four gaps. Not "2", which is
    // how many works there are — the overview row answers "how much is wrong".
    // Waited for, per the note above: this one was observed failing as
    // "expected 'Overview0' to contain '4'" — the rail drawn from a library read
    // that had not landed yet.
    await waitFor(() => expect(tab(/^Overview/).textContent).toContain('4'))
    expect(tab(/^Overview/).querySelector('.meta-rail-count').className).toContain('is-warn')
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
    // THE CARD'S OWN ROWS, NOT ITS TITLE. The title said "Metadata sources" under a
    // tab that had just said "Sources", so it went; a key row is what this card is.
    expect(screen.queryByText('TMDB key')).toBeNull()
    await press(tab(/^Sources/))
    expect(await screen.findByText('TMDB key')).toBeTruthy()
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

  it('gets the same eight doors', async () => {
    await mount()
    // An index, not a strip: eight tabs at 390px show two and a half of themselves.
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    const doors = await phoneDoors()
    expect(doors.map((s) => s.replace(/\d+$/, ''))).toEqual(['Overview', 'Works', 'People', 'Characters', 'Tags', 'Languages', 'Colours', 'Sources'])
  })

  it('carries each door\u2019s number onto its row, because that is why it is a rail', async () => {
    await mount()
    const doors = await phoneDoors()
    // The counts ride on the rows — they are the reason the rail is a rail and
    // not a tab strip, and a number you can see without opening anything.
    expect(doors.find((d) => d.startsWith('Works'))).toMatch(/2$/)
    expect(doors.find((d) => d.startsWith('Characters'))).toMatch(/2$/)
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
      await screen.findByRole('navigation', { name: /which metadata/i })
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
      // The drill-down names the section it opened; there is no field to read it
      // off any more, and the heading is what a reader actually sees.
      expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toMatch(/^Works/)
    })
  })

  it('makes every coverage number a door, the way the tiles on a desk are', async () => {
    // THE HALF THAT WAS MISSING. The sentences said "22 with no cover" and there
    // was no way to reach those 22 — the desktop's tiles filtered the console and
    // the phone's numbers did nothing, which is one control with two behaviours.
    // The old reason was that a phone had no console beside them to filter; a
    // section opens as its own screen now, so it has.
    await mount()
    await phoneDoor('Overview')
    const gap = (await screen.findAllByRole('button')).find((b) => /no cover/i.test(b.textContent || ''))
    expect(gap, 'the coverage numbers should be pressable').toBeTruthy()
    await press(gap)
    // It lands in the works console — the same place the desktop tile lands.
    expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toMatch(/^Works/)
  })

  it('reads the coverage as sentences rather than as filter tiles', async () => {
    // A tile is a button that filters the catalogue beside it; there is no room
    // for the catalogue here, so a tile would be a button that appears to do
    // nothing. The numbers are the same numbers either way.
    await mount()
    // THE PHONE OPENS ON THE INDEX, so the coverage is one press away rather than
    // already on screen — which is the whole point of the index and is what a
    // reader does to reach it.
    await phoneDoor('Overview')
    // `find`, not `get`. `mount()` waits for the index, which is drawn
    // before the counts behind it arrive — so this line raced the fetch, and
    // under a full suite's load it lost: the case failed with "Unable to find
    // /coverage/i" over a screen that was still loading. That is a measurement
    // of the machine rather than of the code, and it passed on its own every
    // time, which is the shape of failure this config's own header warns about.
    expect(await screen.findByText(/coverage/i)).toBeTruthy()
    expect(document.querySelector('.hand-card')).toBeTruthy() // the sweep cards
  })
})
