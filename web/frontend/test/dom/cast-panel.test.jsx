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
let FILLED
let OK_IMAGE
let OK_PUT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.endsWith('/cast')) return { ok: true, data: { cast: CAST, actor_role: ROLE } }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (method === 'POST' && /^\/cast\/\d+\/image$/.test(path)) {
      const id = Number(path.split('/')[2])
      if (!OK_IMAGE) return { ok: true, data: { character_image_path: '' } }
      return { ok: true, data: { ...CAST.find((c) => c.id === id), character_image_path: `stored-${id}.jpg` } }
    }
    if (method === 'POST' && path.endsWith('/cast/tvdb')) return { ok: true, data: { title: 'Suicide Squad', cast: CAST } }
    if (method === 'PUT' && path.startsWith('/cast/')) return OK_PUT ? { ok: true, data: {} } : { ok: false, status: 500, data: {} }
    return { ok: true, data: {} }
  }),
}))

const probeMod = await import('../../src/cast.jsx')
const { CastFills, CastSection } = probeMod
const { UnsavedFieldsContext } = await import('../../src/ui.jsx')

const FILM = { id: 7, title: 'Suicide Squad', media_type: 'movie', tvdb_id: 297762 }
const GAME = { id: 8, title: 'The Witcher 3', media_type: 'game' }
const BOOK = { id: 9, title: 'Moby-Dick' }

const WITH_ART = [
  { id: 11, character: 'Amanda Waller', actor: 'Viola Davis', character_image_url: 'https://artworks.thetvdb.com/waller.jpg', character_image_path: '' },
  { id: 12, character: 'Harley Quinn', actor: 'Margot Robbie', character_image_url: '', character_image_path: '' },
]

const panel = (item = FILM, kind = 'movie') =>
  render(<CastSection kind={kind} item={item} onChanged={() => {}} />)

// THE PANEL IS NO LONGER BEHIND A PRESS. It opened collapsed for one release and
// the owner's report was "i cannot see any cast character" — a list you have to
// know to ask for is a list nobody knows about. So this waits for the load rather
// than triggering it.
const openPanel = async (item, kind) => {
  panel(item, kind)
  await waitFor(() => expect(CALLS.some(([m, p]) => m === 'GET' && p.endsWith('/cast'))).toBe(true))
}

const posted = (re) => CALLS.filter(([m, p]) => m === 'POST' && re.test(p))

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  CALLS = []
  CAST = WITH_ART.map((c) => ({ ...c }))
  ROLE = 'actor'
  FILLED = 0
  OK_IMAGE = true
  OK_PUT = true
})

describe('the people panel', () => {
  it('fetches its cast as soon as it renders', async () => {
    panel()
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'GET' && p === '/movies/7/cast')).toBe(true))
  })

  it('can be closed, and asks for nothing more once it is', async () => {
    await openPanel(FILM, 'movie')
    // Counted on the request that matters, not the total: usePeople's own GET
    // can land between the two reads and has nothing to do with this claim.
    const casts = () => CALLS.filter(([m, q]) => m === 'GET' && q === '/movies/7/cast').length
    const before = casts()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Amanda Waller')).toBeNull()
    expect(casts()).toBe(before)
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
    fireEvent.click(screen.getByRole('button', { name: /^Save / }))
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
    // EXACTLY WHAT WAS TYPED, like every other name box in the app: the
    // as-you-type capitaliser is gone and the keyboard hint replaced it.
    expect(body.character).toBe('the bartender')
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
    // THE FACE IS THE BUTTON. It used to be an unlabelled refresh arrow in the
    // row's action cluster, which is how "i cannot edit or see the character
    // images anywhere" happened: the thing you press to change a picture is the
    // picture. Same accessible name, so this line reads the same and points at a
    // different element.
    fireEvent.click(screen.getAllByRole('button', { name: /^Picture for / })[0])
    fireEvent.change(screen.getByLabelText('Image URL for Amanda Waller'), { target: { value: 'https://example.com/w.png' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      const withBody = posted(/^\/cast\/11\/image$/).filter(([, , b]) => b?.image_url)
      expect(withBody).toHaveLength(1)
      expect(withBody[0][2].image_url).toBe('https://example.com/w.png')
    })
  })

  it('a book has characters and no actors and nothing to fetch', async () => {
    ROLE = 'none'
    CAST = [{ id: 21, character: 'Ahab', actor: '', character_image_url: '', character_image_path: '' }]
    await openPanel(BOOK, 'book')
    expect(await screen.findByText('Ahab')).toBeTruthy()
    // And the actor box is ABSENT rather than disabled — the API refuses an actor
    // on a book rather than quietly clearing it (0047's line).
    fireEvent.click(screen.getByRole('button', { name: /^Edit / }))
    expect(screen.queryByLabelText(/^Actor$/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'Ishmael' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save / }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/cast/21')).toBe(true))
    expect(CALLS.find(([m, p]) => m === 'PUT' && p === '/cast/21')[2]).toEqual({ character: 'Ishmael' })
  })

  it('says so, rather than showing an empty list, when there is no cast', async () => {
    CAST = []
    await openPanel()
    expect(await screen.findByText(/No cast on file/)).toBeTruthy()
  })
})

// ---- the faces a WORK PAGE draws --------------------------------------------
//
// THE HALF THE PANEL DID NOT ANSWER. `POST /cast/{id}/image` was written so a
// client could call it "for every chip it is about to draw", and the People panel
// was the first caller — but the panel is not where character faces are drawn en
// masse. A film's dialogue board is, and a reader who never opened People went on
// seeing the actor fallback for ever.
//
// The hook is tested on its own rather than through Movies.jsx: the board pulls in
// half the app, and what is at issue is which requests are made and when.
describe('the character art a work page needs', () => {
  const Probe = ({ cast, workID = 7 }) => {
    const { useCharacterArt } = probeMod
    useCharacterArt('movie', workID, cast, () => { FILLED += 1 })
    return null
  }

  it('asks for the pictures the board is about to draw', async () => {
    // The work's own record already says which roles have a provider picture and
    // no file — that is what makes the check free.
    render(<Probe cast={[{ character_image_url: 'https://x/w.jpg', character_image_path: '' }]} />)
    await waitFor(() => expect(posted(/^\/cast\/11\/image$/)).toHaveLength(1))
    // And the page is told once, at the end, so it can refetch the rows whose
    // character_images the server resolves.
    await waitFor(() => expect(FILLED).toBe(1))
  })

  it('makes NO request at all when the art is already local', async () => {
    // The point of reading the work's own cast first: a film whose faces are
    // stored costs nothing on every visit.
    render(<Probe cast={[{ character_image_url: 'https://x/w.jpg', character_image_path: 'stored.jpg' }]} />)
    await flush()
    expect(CALLS).toEqual([])
  })

  it('makes no request when no role has a picture to fetch', async () => {
    render(<Probe cast={[{ character: 'Ahab', character_image_url: '', character_image_path: '' }]} />)
    await flush()
    expect(CALLS).toEqual([])
  })

  it('does not report back when nothing arrived', async () => {
    // A refetch that changes nothing is a request and a re-render for no reason.
    OK_IMAGE = false
    render(<Probe cast={[{ character_image_url: 'https://x/w.jpg', character_image_path: '' }]} />)
    await waitFor(() => expect(posted(/^\/cast\/11\/image$/)).toHaveLength(1))
    await flush()
    expect(FILLED).toBe(0)
  })
})

// ---- the panel's tick, and a row that is open -------------------------------
//
// The Details tick promises to commit what is open and close. A cast row saves
// through its own endpoint and cannot join the merged field patch, so it registers
// a `save` with the same registry instead — and without that, typing a corrected
// character name and pressing the tick closed the panel and threw the name away,
// under a control that had just said it saved.
describe('a cast row that is open when the tick is pressed', () => {
  const withHost = async (item = FILM) => {
    const entries = new Map()
    const host = { register: (id, entry) => (entry ? entries.set(id, entry) : entries.delete(id)) }
    render(
      <UnsavedFieldsContext.Provider value={host}>
        <CastSection kind="movie" item={item} onChanged={() => {}} />
      </UnsavedFieldsContext.Provider>,
    )
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'GET' && p.endsWith('/cast'))).toBe(true))
    return entries
  }

  it('registers nothing while it is merely open', async () => {
    const entries = await withHost()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    // An open row you have not changed is not unsaved work, which is the same rule
    // an InlineField follows.
    expect(entries.size).toBe(0)
  })

  it('registers a save once it is typed into, and the save writes', async () => {
    const entries = await withHost()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'A. Waller' } })
    await waitFor(() => expect(entries.size).toBe(1))
    const entry = [...entries.values()][0]
    // A `save` and no `key`: it contributes nothing to the field patch and
    // everything to the promise.
    expect(entry.key).toBeUndefined()
    expect(typeof entry.save).toBe('function')

    expect(await entry.save()).toBe(true)
    const put = CALLS.find(([m, p]) => m === 'PUT' && p === '/cast/11')
    expect(put, 'the tick did not save the open row').toBeTruthy()
    expect(put[2].character).toBe('A. Waller')
  })

  it('reports a refusal, so the panel does not close over it', async () => {
    const entries = await withHost()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'A. Waller' } })
    await waitFor(() => expect(entries.size).toBe(1))
    OK_PUT = false
    expect(await [...entries.values()][0].save()).toBe(false)
  })
})

// ---- what the panel tells its host, and with what --------------------------
//
// THE BUG THIS EXISTS FOR BLANKED THE WHOLE PAGE. The panel called
// `onChanged?.()` with no argument after every save, add and remove; the prop it
// was handed is the host's record SETTER (`onChanged={setMovie}` in Movies.jsx,
// `setBook` in Library.jsx), and both pages render behind `{movie && …}`. So
// correcting a character name called `setMovie(undefined)` and unmounted the film
// page and the dialog standing on it. Reload required.
//
// It survived two review passes because every test in this file stubbed the
// callback as `() => {}`, which cannot see what it was given. So this one looks at
// the ARGUMENT — the only assertion that could have caught it.
describe('what the panel hands back', () => {
  const seen = []
  const panelWithSpy = async () => {
    seen.length = 0
    render(<CastSection kind="movie" item={FILM} onCastChanged={(...args) => seen.push(args)} />)
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'GET' && p.endsWith('/cast'))).toBe(true))
  }

  it('hands over the new cast after a save', async () => {
    await panelWithSpy()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'A. Waller' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save / }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/cast/11')).toBe(true))
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    // NOT `[]`, which is what the first repair produced and what an earlier
    // version of this test asserted as correct: a callback that says nothing is a
    // callback the host cannot act on, and it left the boards showing the old
    // cast until the page was reloaded by hand.
    for (const args of seen) {
      expect(args).toHaveLength(1)
      expect(Array.isArray(args[0]), 'the panel did not hand over the cast').toBe(true)
    }
  })

  it('hands it over after an add too', async () => {
    await panelWithSpy()
    fireEvent.click(screen.getByRole('button', { name: 'Add a character' }))
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'the bartender' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    for (const args of seen) expect(Array.isArray(args[0])).toBe(true)
  })
})

// ---- the two cast fetches, on the fetch screen -----------------------------
//
// THEY MOVED OUT OF THE PANEL, at the owner's own suggestion: "there are two cast
// entries from IMDB and TVDB, which could probably be fit into the fetch /
// refetch metadata screens." Both ARE metadata fetches, and the screen they now
// sit on already holds "look this title up" and "re-pull everything" — so all
// three ways of asking a provider for something are in one place, instead of two
// of them hiding inside the editor for the rows they overwrite.
//
// Tested here rather than through WorkDetails because this is the component that
// makes the requests; that it is RENDERED on the fetch screen is asserted in
// details-save-all.test.jsx, which drives the real dialog.
describe('the cast fetches', () => {
  it('asks TheTVDB with no body — the id is on the record', async () => {
    render(<CastFills item={FILM} onFilled={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Cast from TheTVDB/ }))
    await waitFor(() => expect(posted(/^\/movies\/7\/cast\/tvdb$/)).toHaveLength(1))
    // NO BODY. A search here is where the wrong cast gets attached to the right
    // work, so the id comes from the row and nothing guesses.
    expect(posted(/^\/movies\/7\/cast\/tvdb$/)[0][2]).toBeUndefined()
  })

  it('hides TheTVDB for a game, which has no record there at all', () => {
    render(<CastFills item={GAME} onFilled={() => {}} />)
    expect(screen.queryByRole('button', { name: /Cast from TheTVDB/ })).toBeNull()
    // IMDb is what a game has, and it stays.
    expect(screen.getByRole('button', { name: /Cast from IMDb/ })).toBeTruthy()
  })

  // WHAT IT HANDS BACK IS THE CAST, not a bare "something changed". The caller is
  // a screen away from the panel that would otherwise reload it, and both
  // endpoints already reply with the merged list — so a callback that could not
  // say WHAT changed would cost the caller a round trip to find out.
  it('hands the caller the cast that came back', async () => {
    let got = null
    render(<CastFills item={FILM} onFilled={(c) => { got = c }} />)
    fireEvent.click(screen.getByRole('button', { name: /Cast from TheTVDB/ }))
    await waitFor(() => expect(got).not.toBeNull())
    expect(got.map((c) => c.character)).toEqual(['Amanda Waller', 'Harley Quinn'])
  })
})
