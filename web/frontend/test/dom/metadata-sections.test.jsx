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
import React from 'react'
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
    // Three records with nothing fetched yet, so the server says each lacks a
    // link and a photo — no_links and no_photo are its word for that, not this
    // page's to work out.
    if (method === 'GET' && path === '/people/records') {
      const bare = { no_links: true, no_photo: true }
      return { ok: true, data: { people: [{ id: 1, name: 'Le Guin', ...bare }, { id: 2, name: 'Bulgakov', ...bare }, { id: 3, name: 'Ray', ...bare }] } }
    }
    if (method === 'GET' && (path === '/metadata/status' || path === '/admin/metadata-keys')) {
      // THE SUPPLIER ROWS THE STATUS NAMES, one of them TMDB: a key opens from its
      // supplier's row.
      return { ok: true, data: { tmdb: { source: 'builtin' }, books_lookup: { ok: true }, sources: [{ source: 'tmdb', state: 'builtin', areas: ['films'], fields: 0, works: 0, people: 0 }] } }
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
// ROUTED mounts the page the way the shell does: the section is an address held
// outside it. The issue sheet's press has to be tested through that path — with
// Overview gone the sheet's target, Works, is also the remembered default, so an
// unrouted page has no change of value to enter a section on, and the shell is the
// only place a phone reader ever meets the sheet.
function Routed() {
  const [sect, setSect] = React.useState(null)
  return <MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} section={sect} onSection={setSect} />
}

const mount = async ({ routed = false } = {}) => {
  render(<>{routed ? <Routed /> : <MetadataPage user={{ username: 'alice', is_admin: true }} onOpenBook={() => {}} onOpenMovie={() => {}} onSearch={() => {}} />}<Probe /></>)
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
// EVERY BUTTON ON THE INDEX, WHICH IS NO LONGER ONE PER SECTION. Each card now
// carries its section's headline verb beside the row that opens it, so the list
// this returns interleaves doors and verbs — and the test below names both,
// rather than filtering, because "what can be pressed here" is the thing worth
// pinning and a filter would stop a stray control being noticed at all.
//
// A FILTER WAS TRIED AND IT WAS WRONG. Keeping only the buttons with an
// `aria-label` looked like it named the rows: `countedName` puts "Works — 3 with
// issues" on a row, because a figure beside a word needs its noun said. But it
// returns nothing for a row with no count, so four real doors — Tags, Languages,
// Colours, Sources — vanished from the list and the test read four doors where
// the screen plainly draws eight.
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

describe('a section at a time', () => {

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
    expect(tab(/^Works/).getAttribute('aria-selected')).toBe('true')
  })

})

describe('on a phone', () => {
  beforeEach(() => { WIDTH = 390 })

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

  })
})
