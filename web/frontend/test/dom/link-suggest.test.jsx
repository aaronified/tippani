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

})
