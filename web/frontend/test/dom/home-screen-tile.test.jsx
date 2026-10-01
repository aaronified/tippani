// Home's screen tile names the kinds it counts.
//
// THE OWNER'S REPORT: "the total section in the homepage lists games and shows as
// films as well. That card show all three (without changing the card size)." The
// tile printed the screen shelf's total over "films", whatever the shelf held.
//
// WHAT A READER GETS, read the way a screen reader reads the tile: its name. The
// big figure is every title; beside it, each kind the shelf holds is its figure and
// its glyph, and the glyph's name is the noun. A shelf of one kind needs no
// breakdown and keeps its word on the caption.
//
// DECLARED EXCEPTION: the network is replaced (api.js's `json`), and the counts
// arrive as the `stats` Home is handed by the shell. A journey could not choose a
// library with one kind only; the golden one holds all three.
//
// THE MUTATIONS, each made and run and put back:
//   - the breakdown never drawn: red, the mixed shelf's name has no "12 films";
//   - the caption always "titles": red, a films-only shelf reads "titles";
//   - a kind with none still drawn: red, "0 shows" in the name;
//   - the caption's noun taking no count (the plural always): red, "1 shows".

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async () => ({ ok: true, data: {} }),
}))

const { default: Home } = await import('../../src/Home.jsx')

afterEach(() => cleanup())

const mount = async (stats) => {
  render(
    <Home
      user={{ username: 'alice', preferences: {} }}
      stats={{ books: 2, annotations: 5, dialogues: 280, ...stats }}
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

// A name computed from inline content joins inline parts without a space, so
// jsdom reads a tally as "12films"; what matters is each figure meeting its noun.
const named = (...parts) => new RegExp(`^${parts.join('\\s*')}$`, 'i')

// The tile is the button whose name ends in its dialogue count.
const tile = () => screen.getByRole('button', { name: /280 dialogues$/i })
const nameOf = (el) => el.getAttribute('aria-label') || el.textContent

describe("Home's screen tile", () => {
  it('counts films, shows and games apart beside the total', async () => {
    await mount({ movies: 19, films: 12, shows: 4, games: 3 })
    expect(screen.getByRole('button', { name: named('19', '12', 'films', '4', 'shows', '3', 'games', 'titles · 280 dialogues') })).toBeTruthy()
    // The figures are text, so what a reader copies off the tile is right too.
    expect(tile().textContent).toMatch(/^19 12 4 3/)
  })

  it('leaves out a kind the shelf does not hold', async () => {
    await mount({ movies: 15, films: 12, shows: 0, games: 3 })
    expect(screen.getByRole('button', { name: named('15', '12', 'films', '3', 'games', 'titles · 280 dialogues') })).toBeTruthy()
  })

  it('keeps the word when the shelf holds one kind', async () => {
    await mount({ movies: 12, films: 12, shows: 0, games: 0 })
    expect(screen.getByRole('button', { name: '12 films · 280 dialogues' })).toBeTruthy()
    cleanup()
    await mount({ movies: 3, films: 0, shows: 0, games: 3 })
    expect(screen.getByRole('button', { name: '3 games · 280 dialogues' })).toBeTruthy()
    expect(nameOf(tile())).not.toMatch(/films/)
  })

  // The noun takes the plural of what the figure counts: a shelf of one show is
  // "1 show", where a caption written out per kind printed "1 shows".
  it('says "show" for a shelf of one show', async () => {
    await mount({ movies: 1, films: 0, shows: 1, games: 0 })
    expect(screen.getByRole('button', { name: '1 show · 280 dialogues' })).toBeTruthy()
  })
})
