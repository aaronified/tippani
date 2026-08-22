// The two marks a work in progress wears — the badge ON the artwork and the
// colour bar UNDER it — read out loud.
//
// Both are drawn by ui.jsx from a `kind` the tile hands down, and both were
// asking the wrong thing:
//
//   ReadingBadge was a two-way isBook split, and the Catalogue passes the literal
//   'movie' for every tile it deals. A game you are playing announced itself as
//   "Currently watching".
//
//   StatusBar called shelfLabel(state) with no kind at all, and shelfLabel
//   defaults to the books side — so a film you are watching announced itself as
//   "Reading — 40%".
//
// Neither is visible on screen: they are an accessible name and a tooltip, which
// is exactly the class of bug a screenshot cannot catch and nobody reports. So the
// assertions here are on the name a reader hears, per medium, from the row — the
// same "ask the row, do not infer" rule capKeyFor and moveLabel already follow.

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShelfControl, WorkCard } from '../../src/works.jsx'

// One tile, as a board deals it. `kind` is the BOARD's kind, which is the whole
// point: 'movie' is what the Catalogue passes for a film, a show and a game
// alike, so the medium can only come from the row.
const tile = (kind, item) =>
  render(<WorkCard kind={kind} item={{ id: 1, title: 'x', ...item }} index={0} onOpen={() => {}} />)

// The bar is the only role="img" on a tile — every glyph in the app is
// aria-hidden — and its accessible name is the string under test.
const barName = () => screen.getByRole('img').getAttribute('aria-label')

describe('the badge on the artwork of something in progress', () => {
  it('calls a game you are playing playing', () => {
    tile('movie', { media_type: 'game', status: 'playing' })
    expect(screen.getByLabelText('Currently playing')).toBeTruthy()
    expect(screen.queryByLabelText('Currently watching')).toBeNull()
  })

  it('leaves a film watching', () => {
    tile('movie', { status: 'watching' })
    expect(screen.getByLabelText('Currently watching')).toBeTruthy()
    expect(screen.queryByLabelText('Currently playing')).toBeNull()
  })

  it('leaves a show watching too', () => {
    // A show is a movies row as well, and it settles as watched — so the row it
    // must NOT fall through to is the book one.
    tile('movie', { media_type: 'show', status: 'watching' })
    expect(screen.getByLabelText('Currently watching')).toBeTruthy()
    expect(screen.queryByLabelText('Currently reading')).toBeNull()
  })

  it('leaves a book reading', () => {
    tile('book', { status: 'reading' })
    expect(screen.getByLabelText('Currently reading')).toBeTruthy()
  })
})

describe('the colour bar under the artwork', () => {
  it('says Watching over a film, not Reading', () => {
    tile('movie', { status: 'watching', progress: 40 })
    expect(barName()).toBe('Watching — 40%')
  })

  // THE THREE BELOW PASS WITH THE FIX REVERTED, and that is what they are for
  // rather than a flaw in them. The bar's defect was one word — a film and a show
  // announced themselves as "Reading" — and these pin the cases that were already
  // right, so a later change cannot fix one word by breaking three.
  //
  // The game is in that group and not in the fixed one, which is worth saying
  // plainly because it is easy to assume otherwise: `common.shelf.playing.book`
  // and `.film` are both the single word "Playing", so a game's bar read correctly
  // even while it was being asked the wrong question. The bug was real and the
  // symptom was not, and a case named as though it had been would be a claim
  // nobody can check.
  it('leaves a game saying Playing, as it already did', () => {
    tile('movie', { media_type: 'game', status: 'playing', progress: 30 })
    expect(barName()).toBe('Playing — 30%')
  })

  it('leaves a book reading', () => {
    tile('book', { status: 'reading', progress: 20 })
    expect(barName()).toBe('Reading — 20%')
  })

  it('and names a settled state without a percentage', () => {
    tile('movie', { status: 'completed' })
    expect(barName()).toBe('Completed')
  })

  it('carries the same word onto the track on a detail page', () => {
    // ShelfProgress draws the same bar under the state chip, and it was dropping
    // the kind one frame above the bug — the shape shelf-menu.test.jsx exists to
    // stop for the transitions menu.
    render(
      <ShelfControl kind="movie" item={{ id: 1, media_type: 'movie' }} status="watching" progress={55} onSelect={() => {}} />,
    )
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Watching — 55%')
  })
})
