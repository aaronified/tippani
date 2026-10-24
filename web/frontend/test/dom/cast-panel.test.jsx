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
//
// SINCE 3.1.0 THE FILL IS ONE REQUEST PER WORK: `POST /{books|movies}/{id}/cast/art`
// fetches the work's missing character art and the headshots for the names the
// page sends, on the server, and answers how many of each arrived. The panel
// and the film board share it while it is out. What the page decides — whether
// to ask at all, which names, whether to re-read — is what these cases hold.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS
let CAST
let ROLE
let FILLED
let OK_IMAGE
let OK_PUT
let IMAGES
let IMAGE_SOURCES
let TVDB_NEEDS_ID
let PREVIEW = null
let LOOKUP
// The cast/art request waits on this, so a case can hold it in flight.
let ART_GATE

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
    // The work's pictures, fetched by the server: every role with a provider
    // picture and no file gets one, and the answer counts them.
    if (method === 'POST' && /^\/(books|movies)\/\d+\/cast\/art$/.test(path)) {
      await ART_GATE
      if (!OK_IMAGE) return { ok: true, data: { character_images: 0, portraits: 0 } }
      let n = 0
      CAST = CAST.map((c) => {
        if (!c.character_image_url || c.character_image_path) return c
        n += 1
        return { ...c, character_image_path: `stored-${c.id}.jpg` }
      })
      return { ok: true, data: { character_images: n, portraits: 0 } }
    }
    if (method === 'POST' && path.endsWith('/cast/tvdb')) {
      // The server refuses a row with no TheTVDB id until the reader names one.
      if (TVDB_NEEDS_ID && !body?.tvdb_id) return { ok: false, status: 409, data: { error: 'this title has no TheTVDB id' } }
      return { ok: true, data: { title: 'Suicide Squad', cast: CAST } }
    }
    if (path === '/movies/lookup') return { ok: true, data: { candidates: LOOKUP } }
    if (path === '/images/search') return { ok: true, data: { images: IMAGES, sources: IMAGE_SOURCES } }
    // Unless a case gives it a picture, a preview is an empty answer, which keeps a pick going by
    // its address exactly as it did before the preview existed.
    if (path === '/images/preview') return { ok: true, data: PREVIEW || {} }
    if (method === 'PUT' && path.startsWith('/cast/')) return OK_PUT ? { ok: true, data: {} } : { ok: false, status: 500, data: {} }
    return { ok: true, data: {} }
  }),
  upload: vi.fn(async (path) => {
    CALLS.push(['UPLOAD', path, null])
    return { ok: true, data: { character_image_path: 'framed.jpg', path: 'framed.jpg' } }
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
  TVDB_NEEDS_ID = false
  LOOKUP = []
  OK_PUT = true
  IMAGES = []
  IMAGE_SOURCES = { google: false, amazon: false }
  ART_GATE = Promise.resolve()
})

describe('the people panel', () => {

  it('asks once for the whole work, never once per row', async () => {
    // Twenty roles were twenty requests from here, each an outbound fetch from a
    // self-hosted box the moment somebody opened a panel. The server walks the
    // roles now; the page makes one request.
    await openPanel()
    await waitFor(() => expect(posted(/^\/movies\/7\/cast\/art$/)).toHaveLength(1))
    await flush()
    expect(posted(/^\/cast\/\d+\/image$/).filter(([, , b]) => !b), 'a per-row fetch was made').toEqual([])
    expect(posted(/cast\/art$/)).toHaveLength(1)
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

  it('confirms before removing a row, because a deletion leaves a tombstone', async () => {
    await openPanel()
    await screen.findByText('Amanda Waller')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Amanda Waller' }))
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/cast/11')).toBe(true))
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

// ---- the panel's tick, and a row that is open -------------------------------
//
// The Details tick promises to commit what is open and close. A cast row saves
// through its own endpoint and cannot join the merged field patch, so it registers
// a `save` with the same registry instead — and without that, typing a corrected
// character name and pressing the tick closed the panel and threw the name away,
// under a control that had just said it saved.

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

// ── THE FACE LADDER, and the middle rung is the one the merge needed.
//
// The owner's report: a character whose default picture was set on one book, then
// merged with the same character in another, drew a face on the first book and
// nothing on the second. The row carries what is stored at each grain — this
// work's picture of the role, and the record's own default — and this panel
// decides which to draw.

// A PICTURE CHOSEN ON A CAST LIST IS FRAMED LIKE EVERY OTHER. This row had no upload route in
// the client (the identity sheet has had one for the same row all along), so what it picked went
// by its address, unframed, while the docs said every place a picture is kept was framed. What
// the test knows, declared: the preview address (POST /images/preview), the upload it keeps a
// framed picture by (POST /cast/{id}/image/upload), and that jsdom decodes nothing, so Image is
// stubbed to give a picture a size. `form.frame-form` is the one class it reads, to find the
// frame dialog's own tick among the panel's.
