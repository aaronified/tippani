// A work's people, in the Details panel.
//
// WHY THIS FILE EXISTS. Everything below the surface shipped releases ago: 0048
// built work_cast and six routes for it, 0049 and 0050 added the character image
// and somewhere to put it, and POST /cast/{id}/image was written so "a client may
// call this for every chip it is about to draw". No client ever called it, and
// there was no cast list at all — so a library could hold a full cast with a
// TheTVDB art URL on every row and the reader saw neither.
//
// So the assertions here are mostly about REQUESTS: which ones this panel makes,
// and — for the image fill — that it makes them at all.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let CAST
let ROLE

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: CAST, actor_role: ROLE } }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (method === 'POST' && /^\/cast\/\d+\/image$/.test(path)) {
      const id = Number(path.split('/')[2])
      return { ok: true, data: { ...CAST.find((c) => c.id === id), character_image_path: `stored-${id}.jpg` } }
    }
    if (method === 'POST' && path.endsWith('/cast/tvdb')) return { ok: true, data: { title: 'Suicide Squad', cast: CAST } }
    return { ok: true, data: {} }
  }),
}))

const { CastSection } = await import('../../src/cast.jsx')

const FILM = { id: 7, title: 'Suicide Squad', media_type: 'movie', tvdb_id: 297762 }
const GAME = { id: 8, title: 'The Witcher 3', media_type: 'game' }
const BOOK = { id: 9, title: 'Moby-Dick' }

const WITH_ART = [
  { id: 11, character: 'Amanda Waller', actor: 'Viola Davis', character_image_url: 'https://artworks.thetvdb.com/waller.jpg', character_image_path: '' },
  { id: 12, character: 'Harley Quinn', actor: 'Margot Robbie', character_image_url: '', character_image_path: '' },
]

const panel = (item = FILM, kind = 'movie') =>
  render(<CastSection kind={kind} item={item} onChanged={() => {}} />)

const openPanel = async (item, kind) => {
  panel(item, kind)
  // Exact, not a regex: the info dot beside it is named "About people".
  fireEvent.click(screen.getByRole('button', { name: 'People' }))
  await waitFor(() => expect(CALLS.some(([m, p]) => m === 'GET' && p.endsWith('/cast'))).toBe(true))
}

const posted = (re) => CALLS.filter(([m, p]) => m === 'POST' && re.test(p))

beforeEach(() => {
  CALLS = []
  CAST = WITH_ART.map((c) => ({ ...c }))
  ROLE = 'actor'
})

describe('the people panel', () => {
  it('fetches nothing until it is opened', () => {
    panel()
    // A film page opening a cast list nobody asked for is a request per work
    // browsed. The panel is behind one press for that reason.
    expect(CALLS.filter(([, p]) => p.endsWith('/cast'))).toEqual([])
  })

  it('lists the characters and who plays them', async () => {
    await openPanel()
    expect(await screen.findByText('Amanda Waller')).toBeTruthy()
    expect(screen.getByText('Viola Davis')).toBeTruthy()
  })

  it('asks for the character pictures that are not local yet', async () => {
    // THE REGRESSION. The route has existed since 0050 and nothing had ever
    // called it, so no character art had ever reached a reader's disk.
    await openPanel()
    await waitFor(() => expect(posted(/^\/cast\/11\/image$/)).toHaveLength(1))
    // With NO body: an empty call means "make sure this is local", and a body
    // would mean "replace it with this", which is a different thing.
    expect(posted(/^\/cast\/11\/image$/)[0][2]).toBeUndefined()
    // And the row it fetched now draws the stored file rather than the fallback.
    await waitFor(() => expect(document.querySelector('img.cast-face')).toBeTruthy())
  })

  it('does not ask for a picture the provider does not have', async () => {
    // Most roles have no art of their own even on TheTVDB, and every TMDB row has
    // none by definition. Asking anyway would be a request per row per opening
    // whose only possible answer is "there is nothing".
    await openPanel()
    await waitFor(() => expect(posted(/^\/cast\/11\/image$/)).toHaveLength(1))
    expect(posted(/^\/cast\/12\/image$/)).toEqual([])
  })

  it('does not ask again for one it already has', async () => {
    CAST = [{ ...WITH_ART[0], character_image_path: 'already.jpg' }]
    await openPanel()
    await waitFor(() => expect(screen.getByText('Amanda Waller')).toBeTruthy())
    expect(posted(/\/image$/)).toEqual([])
  })

  it('saves both names of a corrected row in one request', async () => {
    await openPanel()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'A. Waller' } })
    fireEvent.change(screen.getByLabelText(/^Actor$/i), { target: { value: 'V. Davis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/cast/11')).toBe(true))
    const [, , body] = CALLS.find(([m, p]) => m === 'PUT' && p === '/cast/11')
    expect(body).toEqual({ character: 'A. Waller', actor: 'V. Davis' })
  })

  it('adds a character the provider never listed', async () => {
    // The endpoint 0048 was built for: a game whose Wikidata lookup came back
    // empty had no way to name a voice actor at all.
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Add a character' }))
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'the bartender' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/movies/7/cast')).toBe(true))
    const [, , body] = CALLS.find(([m, p]) => m === 'POST' && p === '/movies/7/cast')
    // Capitalised as you type, like every other name box in the app.
    expect(body.character).toBe('The Bartender')
  })

  it('confirms before removing a row, because a deletion leaves a tombstone', async () => {
    await openPanel()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Amanda Waller' }))
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/cast/11')).toBe(true))
  })

  it('sets a picture the reader chose, through the same route', async () => {
    await openPanel()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Picture for / })[0])
    fireEvent.change(screen.getByLabelText('Image URL for Amanda Waller'), { target: { value: 'https://example.com/w.png' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      const withBody = posted(/^\/cast\/11\/image$/).filter(([, , b]) => b?.image_url)
      expect(withBody).toHaveLength(1)
      expect(withBody[0][2].image_url).toBe('https://example.com/w.png')
    })
  })

  it('offers TheTVDB for a film and not for a game', async () => {
    await openPanel(FILM, 'movie')
    expect(screen.getByRole('button', { name: /Cast from TheTVDB/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cast from TheTVDB/ }))
    await waitFor(() => expect(posted(/^\/movies\/7\/cast\/tvdb$/)).toHaveLength(1))
    // It takes NO body: the id is on the record, and a search here is where the
    // wrong cast gets attached to the right work.
    expect(posted(/^\/movies\/7\/cast\/tvdb$/)[0][2]).toBeUndefined()
  })

  it('hides TheTVDB for a game, which has no record there at all', async () => {
    await openPanel(GAME, 'movie')
    expect(screen.queryByRole('button', { name: /Cast from TheTVDB/ })).toBeNull()
    // IMDb is what a game has, and it stays.
    expect(screen.getByRole('button', { name: /Cast from IMDb/ })).toBeTruthy()
  })

  it('a book has characters and no actors and nothing to fetch', async () => {
    ROLE = 'none'
    CAST = [{ id: 21, character: 'Ahab', actor: '', character_image_url: '', character_image_path: '' }]
    await openPanel(BOOK, 'book')
    expect(await screen.findByText('Ahab')).toBeTruthy()
    // Neither fill applies: a book's cast is people the reader names.
    expect(screen.queryByRole('button', { name: /Cast from/ })).toBeNull()
    // And the actor box is ABSENT rather than disabled — the API refuses an actor
    // on a book rather than quietly clearing it (0047's line).
    fireEvent.click(screen.getByRole('button', { name: /^Edit / }))
    expect(screen.queryByLabelText(/^Actor$/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'Ishmael' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/cast/21')).toBe(true))
    expect(CALLS.find(([m, p]) => m === 'PUT' && p === '/cast/21')[2]).toEqual({ character: 'Ishmael' })
  })

  it('says so, rather than showing an empty list, when there is no cast', async () => {
    CAST = []
    await openPanel()
    expect(await screen.findByText(/No cast on file/)).toBeTruthy()
  })
})
