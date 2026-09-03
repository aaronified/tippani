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
  fireEvent.click(screen.getByRole('button', { name: /^Edit links$/i }))
  // TWO BUTTONS SAY IT ON AN EMPTY COLUMN — the header verb and the empty state's
  // own labelled one, deliberately (a panel whose only affordance is a 34px key in
  // the corner is a panel a reader leaves again). Either opens this panel; the
  // header verb is the one that exists in both states, so it is the one pressed.
  const add = await waitFor(() => {
    const b = screen.getAllByRole('button', { name: /^Add a link$/i })[0]
    expect(b).toBeTruthy()
    return b
  })
  fireEvent.click(add)
  return waitFor(() => {
    expect(document.querySelector('.tp-panel input.tp-input')).toBeTruthy()
  })
}

const offers = () => [...document.querySelectorAll('.work-link-offer')]

describe('the pages a record can already address', () => {
  it('are offered as presses, with each site own mark', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    // The app's provider order, not the row's column order.
    expect(offers().map((b) => b.querySelector('.mono-label').textContent))
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
  it('close the panel, landing back on the list they were added to', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    fireEvent.click(offers()[3])
    await waitFor(() => {
      expect(document.querySelector('.tp-panel input.tp-input')).toBeNull()
      expect(document.querySelector('.work-link-row')).toBeTruthy()
    })
  })

  it('drop out once linked, rather than drawing as ticked', async () => {
    await open(FILM, 'movie')
    await waitFor(() => expect(offers().length).toBe(4))
    fireEvent.click(offers()[0])
    // The pick pops the panel AFTER its save resolves, so waiting on the write
    // alone races the pop — wait for the list to be back under us.
    await waitFor(() => expect(document.querySelector('.work-link-row')).toBeTruthy())
    expect(PUTS.length).toBe(1)
    // Back into the panel: the one just added is gone from the offers and is a
    // stored row instead. A row you cannot press is the roster of absences again.
    fireEvent.click(screen.getAllByRole('button', { name: /^Add a link$/i })[0])
    await waitFor(() => expect(offers().length).toBe(3))
    expect(offers().map((b) => b.querySelector('.mono-label').textContent))
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
    const box = document.querySelector('.tp-panel input.tp-input')
    fireEvent.change(box, { target: { value: 'letterboxd.com/film/the-matrix/' } })
    // The reading still appears, and the box still stores what it read — the
    // derived list is another way in, not a replacement.
    await waitFor(() => expect(document.body.textContent).toMatch(/Reads as Letterboxd/i))
    fireEvent.submit(box.closest('form'))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.links).toBe('https://letterboxd.com/film/the-matrix/')
  })
})
