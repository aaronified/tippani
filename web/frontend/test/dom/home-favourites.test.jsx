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

describe('the favourites wall', () => {
  it('shows a favourite of every kind, not just the two it started with', async () => {
    await mount()
    await waitFor(() => expect(screen.getByText(/A highlight from a book/)).toBeTruthy())
    expect(screen.getByText(/A line from a film/), 'a favourited film line is missing').toBeTruthy()
    // THE ONE THIS FILE EXISTS FOR. A standalone quote is the third kind and was
    // the one silently absent.
    expect(screen.getByText(/A quote from nowhere in particular/), 'a favourited standalone quote is missing').toBeTruthy()
  })

  it('reads the quotes response by its table name, not its route', async () => {
    // /quotes answers with `utterances` — the table, not the path. Reading
    // `.quotes` returns undefined, `|| []` swallows it, and the wall is silently
    // short by one kind with no error anywhere.
    UTTERANCES = [{ id: 3, quote: 'The only quote', speaker: 'Anon', favorite: 1, tags: [], color: 'yellow', kind: 'quote' }]
    await mount()
    await waitFor(() => expect(screen.getByText(/The only quote/)).toBeTruthy())
  })

  it('survives a 200 with no body without blanking the whole wall', async () => {
    // A reverse proxy answering the session-expiry redirect as a 200 HTML page
    // leaves .data null. Dereferencing it threw, and with no catch the ENTIRE
    // section went blank while the rest of Home rendered — which reads as "you
    // have no favourites".
    const api = await import('../../src/api.js')
    api.json.mockImplementation(async (method, path) => {
      if (path.startsWith('/movies')) return { ok: true, data: null }
      if (path.startsWith('/annotations')) return { ok: true, data: { annotations: ANNOTATIONS } }
      if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: DIALOGUES } }
      if (path.startsWith('/quotes')) return { ok: true, data: { utterances: UTTERANCES } }
      return { ok: true, data: {} }
    })
    await mount()
    await waitFor(() => expect(screen.getByText(/A highlight from a book/)).toBeTruthy())
    expect(screen.getByText(/A quote from nowhere in particular/)).toBeTruthy()
  })

  it('gives a standalone quote somewhere to go, and the other two their work', async () => {
    // Reversed once, deliberately. "Nothing to open" was true of a parent record
    // and false of a destination: a standalone quote lives on the Quotes screen,
    // and that is somewhere worth going from a tile here.
    await mount()
    await waitFor(() => expect(screen.getByText(/A highlight from a book/)).toBeTruthy())
    // The row of verbs only exists while a tile is open, which is already the
    // deliberate act a hover gate would be waiting for. So open each one.
    for (const [words, label] of [
      [/A highlight from a book/, 'Open this book'],
      [/A line from a film/, 'Open this film'],
      [/A quote from nowhere in particular/, 'Go to your quotes'],
    ]) {
      await act(async () => {
        screen.getByText(words).closest('button').click()
      })
      expect(screen.getByLabelText(label), `${label} is missing from the open tile`).toBeTruthy()
    }
  })

  it('offers copy and share on every kind of favourite', async () => {
    // FAV_KINDS reports an `actionKind` to the registry — annotation, dialogue,
    // quote — and never a WORK kind, because copy and share are gated off works:
    // a book has no words to put on the clipboard, its quotes do. A tile that
    // reported its own key through would ask the registry about "book" and come
    // back with an empty row.
    //
    // This used to be read out of Home.jsx as `actionKind:\s*'([a-z]+)'` and
    // `actionsFor(meta.actionKind,`. Both are true of code that never renders.
    await mount()
    await waitFor(() => expect(screen.getByText(/A highlight from a book/)).toBeTruthy())
    for (const words of [/A highlight from a book/, /A line from a film/, /A quote from nowhere in particular/]) {
      await act(async () => {
        screen.getByText(words).closest('button').click()
      })
      const tile = screen.getByText(words).closest('.hand-card')
      expect(within(tile).getByLabelText('Copy'), `no Copy on ${words}`).toBeTruthy()
      expect(within(tile).getByLabelText('Share'), `no Share on ${words}`).toBeTruthy()
    }
  })

  it('draws no glyph on a quote when the Quotes screen is switched off', async () => {
    // The one favourite whose destination is a SCREEN rather than a record — so
    // with that section hidden in Settings there is nowhere for it to go, and the
    // shell passes no callback. The old code called `onGoQuotes?.()`, which makes
    // a DEAD control out of a missing one: a glyph wearing a pointer that answers
    // a tap with nothing. A book and a film are unaffected, and that is the line
    // this is drawn on — their glyphs open a record, which hiding a section never
    // takes away.
    render(
      <Home
        user={{ username: 'alice', preferences: {} }}
        stats={{}}
        onOpenBook={() => {}}
        onOpenMovie={() => {}}
        onGoLibrary={() => {}}
        onGoMovies={() => {}}
        onPending={() => {}}
        onReviewImport={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText(/A quote from nowhere in particular/)).toBeTruthy())
    await act(async () => {
      screen.getByText(/A quote from nowhere in particular/).closest('button').click()
    })
    expect(screen.queryByLabelText('Go to your quotes'), 'a dead glyph on a quote with nowhere to go').toBeNull()
    // And the other two are untouched: their glyph opens a RECORD, which hiding a
    // section never takes away.
    await act(async () => {
      screen.getByText(/A highlight from a book/).closest('button').click()
    })
    expect(screen.getByLabelText('Open this book')).toBeTruthy()
  })

  it('offers exactly one Shuffle, above the cards the date gave you', async () => {
    // The other layout: with something from this date in another year, the same
    // button earns its rule and separates what the date gave you from what chance
    // did. Both layouts must draw ONE button and must show the shuffled card.
    const api = await import('../../src/api.js')
    api.json.mockImplementation(async (method, path) => {
      if (path.startsWith('/on-this-day')) {
        return { ok: true, data: { quotes: [{ id: 7, kind: 'quote', quote: 'What this day said before', speaker: 'Anon' }] } }
      }
      if (path.startsWith('/shuffle')) {
        return { ok: true, data: { quote: { id: 99, kind: 'quote', quote: 'A quote chance found', speaker: 'Anon' } } }
      }
      if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
      if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
      if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
      return { ok: true, data: {} }
    })
    await mount()
    await waitFor(() => expect(screen.getByText(/What this day said before/)).toBeTruthy())
    expect(screen.getAllByText('Shuffle'), 'two Shuffle buttons on one screen').toHaveLength(1)

    await act(async () => {
      screen.getByText('Shuffle').closest('button').click()
    })
    await waitFor(() => expect(screen.getByText(/A quote chance found/)).toBeTruthy())
    // Both are on screen: the date's card and chance's, which is what the rule
    // between them is for.
    expect(screen.getByText(/What this day said before/)).toBeTruthy()
  })

  it('does not move the Shuffle button when you press it', async () => {
    // THE BUG: the row picked between a centred layout and a left-aligned one with
    // `!today.length && !shuffled`. Pressing Shuffle sets `shuffled`, so the press
    // itself flipped the branch and the button jumped from the middle of the screen
    // to the left edge, under the reader's own thumb. On a phone that is the whole
    // width of the viewport away from where they tapped.
    //
    // ASSERTED ON THE RENDERED ROW, not on which expression chooses the branch.
    // The class that positions the button is what a reader sees move, and it
    // survives the component being renamed, re-extracted or rewritten — the
    // source scan this replaces survived none of those and measured nothing after
    // any of them.
    const api = await import('../../src/api.js')
    api.json.mockImplementation(async (method, path) => {
      if (path.startsWith('/on-this-day')) return { ok: true, data: { quotes: [] } }
      if (path.startsWith('/shuffle')) {
        return { ok: true, data: { quote: { id: 99, kind: 'quote', quote: 'A quote chance found', speaker: 'Anon' } } }
      }
      if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
      if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
      if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
      return { ok: true, data: {} }
    })
    await mount()
    // RE-QUERIED EITHER SIDE OF THE PRESS, never held across it. The two layouts
    // are different branches, so React unmounts one row and mounts the other —
    // and a handle kept from before the press points at a node that has left the
    // document and still reports the class it had. That reads as "nothing moved"
    // no matter what happened, which is the one answer this test must never give
    // by accident.
    const row = () => screen.getByText('Shuffle').closest('div.flex').className
    const before = row()

    await act(async () => {
      screen.getByText('Shuffle').closest('button').click()
    })
    await waitFor(() => expect(screen.getByText(/A quote chance found/)).toBeTruthy())

    expect(row(), 'the button moved as a result of being pressed').toBe(before)
  })
})
