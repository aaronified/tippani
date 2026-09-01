// The in-progress cap dialog, on the Catalogue's third medium.
//
// Games are movies-table rows (media_type = 'game', migration 0040) with a cap of
// their own — SHELF_CAPS.game is 3 — so starting a fourth game really does open
// this dialog. Every word in it was a film's: "Already Watching 3", "The shelf
// holds 3 films at a time", and three buttons reading "Mark as watched". The pool
// it lists was the right pool; only the words were wrong, which is why nothing
// looked broken.
//
// ASSERTED THROUGH THE SCREEN, not on a helper. The bug was in the props the
// detail passes — `verb` hard-coded to the film label, `noun` falling back to
// unit.film.* with no game arm — so a test of InProgressCapDialog itself would
// have been green the whole time, the same trap shelf-menu.test.jsx describes for
// moveLabel: the correction has to be watched arriving at the dialog.

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The row the detail opens, and the rows already holding its shelf. Set per test,
// read by the mock at call time.
let ROW
let POOL

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === `/movies/${ROW.id}`) return { ok: true, data: ROW }
    // pick() reads the whole catalogue and filters it to this row's own pool.
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [ROW, ...POOL] } }
    // Everything else the detail loads on the way in — its lines, their tags,
    // the seals, the actor faces. Empty, but empty of the right SHAPE: several
    // of these are read as `r.data.x` straight into a map(), so a bare {} is a
    // render crash rather than a quiet nothing.
    return { ok: true, data: { dialogues: [], tags: [], stickers: [], people: [], items: [] } }
  }),
}))

const Movies = (await import('../../src/Movies.jsx')).default

const inProgress = (n, media_type, status) =>
  Array.from({ length: n }, (_, i) => ({ id: 100 + i, title: `Other ${i + 1}`, media_type, status }))

// Open the detail and start it, which is where a reader meets the cap.
//
// THROUGH THE STATE CHIP, and it moved there: the header used to carry a standing
// "Mark as watching" button beside four others, and the header now carries two
// verbs — Details and Practise — because five buttons in a row that splits its
// width evenly is five squashed buttons. The shelf move was the right one to lose
// from that row: the chip's own popover holds the WHOLE lifecycle rather than one
// step of it, and it sits two inches above where the button was.
//
// This test still drives the screen rather than the dialog, which is the point of
// it (the bug was in the props the detail passes, so a test of
// InProgressCapDialog alone would have been green throughout). It just takes the
// route a reader takes.
async function start() {
  render(
    <Movies openId={ROW.id} onOpen={() => {}} onClose={() => {}} creditSeparators=",;&" onAdd={() => {}} dataNonce={0} />,
  )
  // A row with no lines and no status reads as Wishlist; the chip is the one
  // transitions surface, so it opens whatever state the row is in.
  fireEvent.click(await screen.findByRole('button', { name: /Wishlist|Shelve/ }))
  // The transitions are menuitems inside the chip's popover, not buttons in a
  // row — which is the difference this route is testing as much as the words.
  fireEvent.click(await screen.findByRole('menuitem', { name: /^Mark as (playing|watching)$/ }))
}

beforeEach(() => {
  ROW = null
  POOL = []
})

describe('the shelf cap over a game', () => {
  beforeEach(() => {
    ROW = { id: 7, title: 'Outer Wilds', media_type: 'game', status: '', director: 'Mobius Digital', release_year: 2019 }
    POOL = inProgress(3, 'game', 'playing')
  })

  it('counts games, in the word a game is played in', async () => {
    await start()
    expect(await screen.findByText('Already Playing 3')).toBeTruthy()
    expect(screen.getByText(/holds 3 games at a time/)).toBeTruthy()
    expect(screen.queryByText('Already Watching 3')).toBeNull()
    expect(screen.queryByText(/3 films at a time/)).toBeNull()
  })

  it('settles one as played, not as watched', async () => {
    await start()
    await screen.findByText('Already Playing 3')
    expect(screen.getAllByRole('button', { name: 'Mark as played' })).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Mark as watched' })).toBeNull()
  })
})

describe('the shelf cap over a film', () => {
  beforeEach(() => {
    // The other half, so neither side can be satisfied by rewording the other.
    // Two, because SHELF_CAPS.movie is 2.
    ROW = { id: 8, title: 'Solaris', media_type: 'movie', status: '', director: 'Tarkovsky', release_year: 1972 }
    POOL = inProgress(2, 'movie', 'watching')
  })

  it('still counts films, and still settles them as watched', async () => {
    await start()
    expect(await screen.findByText('Already Watching 2')).toBeTruthy()
    expect(screen.getByText(/holds 2 films at a time/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Mark as watched' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Mark as played' })).toBeNull()
  })
})
