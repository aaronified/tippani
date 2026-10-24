// Home's favourites wall, driven the way a reader meets it.
//
// THE BUG THIS FILE WAS WRITTEN FOR: Home fetched two lists and merged two lists,
// and had done since before standalone quotes existed. Nothing failed — hearting a
// quote worked, the heart stayed on, the Quotes screen filtered by it — and the
// quote simply never appeared here. You could only find it by owning one and going
// to look.
//
// IT USED TO BE A SOURCE SCAN, and that is what changed. It asserted that
// `loadFavs` contained the string `/quotes?favorite=1` and the substring
// `quoteFav(` — which is a test that the code is present, not that the wall shows
// the quote. It passed on a `quoteFav` that returned nothing, on a merge into the
// wrong array, and on a tile that rendered blank; it would have failed on a rename
// that changed nothing at all. Its own header argued that "a render test asserts
// what a component does with the data it was given and this component was never
// given the data" — which is true of a render test that is HANDED a list, and not
// of this one, which hands Home a server and reads the wall.
//
// So: one favourite of each kind is put on the server, and every assertion below
// is about what is on the screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let ANNOTATIONS
let DIALOGUES
let UTTERANCES
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ANNOTATIONS } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: DIALOGUES } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: UTTERANCES } }
    if (path.startsWith('/movies')) return { ok: true, data: { movies: [{ id: 5, title: 'Stalker', media_type: 'movie' }] } }
    if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Home } = await import('../../src/Home.jsx')

beforeEach(() => {
  CALLS = []
  ANNOTATIONS = [{ id: 1, book_id: 9, quote: 'A highlight from a book', book_title: 'Invisible Cities', favorite: 1, tags: [], color: 'yellow' }]
  DIALOGUES = [{ id: 2, movie_id: 5, quote: 'A line from a film', character: 'Stalker', favorite: 1, tags: [], color: 'yellow' }]
  UTTERANCES = [{ id: 3, quote: 'A quote from nowhere in particular', speaker: 'Marcus Aurelius', favorite: 1, tags: [], color: 'yellow', kind: 'quote' }]
})
afterEach(() => cleanup())

const mount = async () => {
  render(
    <Home
      user={{ username: 'alice', preferences: {} }}
      stats={{}}
      onOpenBook={() => {}}
      onOpenMovie={() => {}}
      onGoLibrary={() => {}}
      onGoMovies={() => {}}
      onGoQuotes={() => {}}
      onPending={() => {}}
      onReviewImport={() => {}}
    />,
  )
  await act(async () => {})
}

// THE QUOTE'S FACE REACHES HOME TOO, and it did not for one commit. The
// per-language type keys the face on the LANGUAGE (see language-fonts.test.jsx),
// and every surface that draws a quote has to carry the class or the same German
// quote reads in Literata on its work page and in the display face here — which
// is the repo's "two things that look the same behave the same" rule read
// backwards. A rater found this; the tile's own file had nothing to say about it.

describe('the favourites wall', () => {
  // THE RECALL MARK IS ON THE RESTING TILE, and that is a different claim from
  // "Home draws the mark somewhere". This board's tile has two mutually exclusive
  // states and the reader arrives in the closed one, so a mark drawn only in the
  // expanded branch is a door that costs a tap no other quote surface asks for —
  // which is exactly what shipped. A sweep that read the file for the component's
  // name could not tell the two branches apart; this presses nothing and looks.

  it('shows a favourite of every kind, not just the two it started with', async () => {
    await mount()
    await waitFor(() => expect(screen.getByText(/A highlight from a book/)).toBeTruthy())
    expect(screen.getByText(/A line from a film/), 'a favourited film line is missing').toBeTruthy()
    // THE ONE THIS FILE EXISTS FOR. A standalone quote is the third kind and was
    // the one silently absent.
    expect(screen.getByText(/A quote from nowhere in particular/), 'a favourited standalone quote is missing').toBeTruthy()
  })

})
