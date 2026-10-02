// Appending a provider by picking it from a list — handoff §1.3's last clause.
//
// WHAT THE LIST IS, AND WHAT IT IS NOT. The pack asks for a list of providers to
// pick from; a list of the twelve marks with "not linked" beside eight of them is
// the roster of absences §1.3 was written to avoid — a panel made mostly of
// absences decides for the reader which sites their record may have and is wrong
// about it. So the list is the pages this record's own pinned ids can ALREADY
// address, one press appends, and a site with no id in the row is simply not in
// it. Those are the two halves pinned here: what the list contains, and that the
// paste box behind it is untouched.
//
// DECLARED EXCEPTION: `.src-mark`, a site's mark, which is a CSS mask on a span
// with no name. Everything else goes by role, name and title.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS
let STORED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      STORED = { ...STORED, ...body }
      return { ok: true, data: STORED }
    }
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) return { ok: true, data: STORED }
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: [], actor_role: 'none' } }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

// A FILM PINNED TO THREE SUPPLIERS AND ONE WIKI, which is an ordinary record:
// one lookup pins TMDB or TheTVDB, the IMDb id rides along with it, and 0055
// remembers the wiki the first time a character picture is searched for.
const FILM = {
  id: 11, title: 'The Matrix', director: '', description: '', media_type: 'movie',
  release_year: 1999, tmdb_id: 603, tvdb_id: 71663, imdb_id: 'tt0133093',
  fandom_wiki: 'matrix', links: '', genres: [], series: '', favorite: false,
}

const BOOK_UNPINNED = {
  id: 12, title: 'A Novel', author: '', translator: '', editor: '', isbn: '', asin: '',
  description: '', published_year: 0, published_circa: false, language: '', orig_language: '',
  subtitle: '', publisher: '', pages: 0, links: '', genres: [], series: '', series_index: 0,
  favorite: false,
}

beforeEach(() => {
  PUTS = []
  resetPanelHistory()
})

const open = async (rec, kind) => {
  STORED = { ...rec }
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind, item: rec, onChanged: () => {}, onDelete: null })}
    />,
  )
  await waitFor(() => expect(screen.getByRole('button', { name: /^Edit title$/i })).toBeTruthy())
// THE LINKS SCREEN IS BEHIND THE ＋ AT THE END OF THE PILL ROW, and the paste box
// is on it. It was one press further in, behind a list that was empty on most
// works, until the owner: "add has a middleman screen with nothing, that can be
// skipped."
  fireEvent.click(plus())
  return waitFor(() => {
    expect(box()).toBeTruthy()
  })
}

const plus = () => screen.getByRole('button', { name: 'Add a link' })
const box = () => screen.queryByRole('textbox', { name: 'Add a link' })

// Each offer is a button titled "Add the <site> page for this record"; the site
// is read back out of that title.
const offers = () => screen.queryAllByTitle(/^Add the .* page for this record$/)
const site = (b) => b.getAttribute('title').replace(/^Add the (.*) page for this record$/, '$1')

describe('the pages a record can already address', () => {
  it('are offered as presses, with each site own mark', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    // The app's provider order, not the row's column order.
    expect(offers().map(site))
      .toEqual(['IMDb', 'TMDB', 'TheTVDB', 'Fandom'])
    // A MARK PER ROW. The name alone is what the app had before it carried the
    // site marks, and a list of twelve names is the thing marks were vendored for.
    for (const b of offers()) {
      expect(b.querySelector('.src-mark'), 'every offer wears its mark').toBeTruthy()
    }
  })

  it('show the whole address before it is added', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    // This is a link about to be stored, so the reader reads it first — the same
    // rule the paste box's "reads as" line keeps, and never truncated.
    expect(offers()[1].textContent).toContain('https://www.themoviedb.org/movie/603')
  })

  it('append on one press, writing the whole column', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    fireEvent.click(offers()[0])
    await waitFor(() => expect(PUTS.length).toBe(1))
    // The column is free text and is written whole, which is what every other
    // writer of it does — the panel does not learn a second storage shape.
    expect(PUTS[0].body.links).toBe('https://www.imdb.com/title/tt0133093/')
  })

  // A PICK CLOSES ITS PANEL (§1.11). There is nothing left to type and nothing to
  // confirm, so leaving it open asks the reader to find the ✕ for a finished job.
  it('close the panel, landing back on the row they were added to', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    fireEvent.click(offers()[3])
    await waitFor(() => expect(PUTS.length).toBe(1))
    const url = PUTS[0].body.links
    await waitFor(() => {
      expect(box()).toBeNull()
      expect(screen.queryAllByRole('link').some((a) => a.getAttribute('href') === url), 'the pick was saved and the row behind does not show it').toBe(true)
    })
  })

  it('drop out once linked, rather than drawing as ticked', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    fireEvent.click(offers()[0])
    // The pick pops the panel AFTER its save resolves, so waiting on the write
    // alone races the pop — wait for the panel to be gone.
    await waitFor(() => expect(box()).toBeNull())
    expect(PUTS.length).toBe(1)
    // Back into the panel: the one just added is gone from the offers and is a
    // stored row instead. A row you cannot press is the roster of absences again.
    fireEvent.click(plus())
    await waitFor(() => expect(offers().length).toBe(3))
    expect(screen.getAllByRole('button', { name: /^Remove the .* link$/ })).toHaveLength(1)
    expect(offers().map(site))
      .toEqual(['TMDB', 'TheTVDB', 'Fandom'])
  })

  it('are absent altogether on a record with nothing pinned', async () => {
    await open(BOOK_UNPINNED, 'book')
    // NOT AN EMPTY LIST WITH A HEADING OVER IT. A record the app cannot address
    // anywhere gets the panel it had before this feature: one box.
    expect(offers().length).toBe(0)
    expect(document.body.textContent).not.toMatch(/pages this record has/i)
  })

  it('leave the paste box working for a site no id can reach', async () => {
    await open(FILM, 'movie')
    fireEvent.change(box(), { target: { value: 'letterboxd.com/film/the-matrix/' } })
    // The reading still appears, and the box still stores what it read — the
    // derived list is another way in, not a replacement.
    await waitFor(() => expect(document.body.textContent).toMatch(/Reads as Letterboxd/i))
    fireEvent.submit(box().closest('form'))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.links).toBe('https://letterboxd.com/film/the-matrix/')
  })
})
